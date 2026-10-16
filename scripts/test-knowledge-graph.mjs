#!/usr/bin/env node
/**
 * Knowledge graph queries (Learning OS 2.1) on the real links file, and the
 * per-topic results rule in both its forms (TypeScript and, with a local
 * Supabase, my_topic_results()).
 *
 *   npm run test:knowledge-graph
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { flattenCurriculum } from "../src/lib/curriculum.ts";
import { dependentsOf, expandLinks, missingPrerequisites, prerequisiteLevels, relatedTo, studyOrder } from "../src/lib/conceptGraph.ts";
import { topicResultsFromEvents, topicStatus } from "../src/lib/learningProfile.ts";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const curriculum = flattenCurriculum(JSON.parse(readFileSync(new URL("../src/data/curriculum/kh-grade12.json", import.meta.url), "utf8")));
const topicIds = curriculum.chapters.flatMap((chapter) => chapter.topics.map((topic) => topic.id));
const links = expandLinks(JSON.parse(readFileSync(new URL("../src/data/curriculum-links/kh-grade12-math.json", import.meta.url), "utf8")));
const T = (short) => `kh-grade12-science-mathematics-${short}`;
const short = (id) => id.replace(T(""), "");

await check("dependents: limits open up most of the course, nearest first", async () => {
  const after = dependentsOf(T("limits-continuity-limits"), links);
  assert(after[0].distance === 1 && after.some((item) => short(item.topicId) === "integrals-volume"), after.map((i) => short(i.topicId)).join());
  assert(dependentsOf(T("integrals-volume"), links).length === 0, "the last topic opens something");
});

await check("related links work in both directions", async () => {
  assert(relatedTo(T("conics-parabola"), links).map(short).join() === "conics-ellipse,conics-hyperbola", relatedTo(T("conics-parabola"), links).map(short).join());
  assert(relatedTo(T("function-study-graphs"), links).map(short).join() === "derivatives-tangent", "tangent ↔ graphs missing");
});

await check("study order keeps every prerequisite first and otherwise the curriculum's order", async () => {
  const order = studyOrder(topicIds, links);
  assert(order.length === topicIds.length && new Set(order).size === topicIds.length, "topics lost or repeated");
  const at = new Map(order.map((id, index) => [id, index]));
  const broken = links.filter((link) => link.kind === "prerequisite" && at.get(link.fromTopic) > at.get(link.toTopic));
  assert(!broken.length, `out of order: ${broken.map((l) => `${short(l.fromTopic)}→${short(l.toTopic)}`).join(", ")}`);
  assert(order[0] === topicIds[0], `starts with ${short(order[0])}`);
});

await check("levels: starting points are 0, each topic is after all its prerequisites", async () => {
  const level = prerequisiteLevels(topicIds, links);
  assert(level.get(T("limits-continuity-limits")) === 0 && level.get(T("probability-counting")) === 0, "starting points");
  const bad = links.filter((link) => link.kind === "prerequisite" && level.get(link.fromTopic) >= level.get(link.toTopic));
  assert(!bad.length, `levels out of step: ${bad.length}`);
  return `deepest level ${Math.max(...level.values())}`;
});

await check("missing prerequisites: the ones not shown yet, nearest first", async () => {
  const known = { [T("integrals-definite")]: "going-well", [T("integrals-antiderivatives")]: "work-on" };
  const missing = missingPrerequisites(T("integrals-by-parts"), links, (id) => known[id] ?? "unknown");
  assert(missing[0].topicId === T("integrals-antiderivatives") && missing[0].status === "work-on", JSON.stringify(missing[0]));
  assert(!missing.some((item) => item.topicId === T("integrals-definite")), "a topic going well was called missing");
});

await check("topic results: first attempt per question per day; status needs 3 answers", async () => {
  const at = (iso) => iso;
  const event = (resourceId, correct, createdAt, eventType = "question_attempted") => ({ id: randomUUID(), eventType, resourceType: "question", resourceId, topicId: "t", chapterId: "c", data: { correct }, createdAt });
  const results = topicResultsFromEvents([
    event("q1", false, at("2026-10-16T01:00:00Z")),
    event("q1", true, at("2026-10-16T02:00:00Z")),
    event("q1", true, at("2026-10-16T03:00:00Z"), "mistake_reviewed"),
    event("q2", true, at("2026-10-16T04:00:00Z")),
    event("q1", true, at("2026-10-17T05:00:00Z")),
    { ...event("q3", true, at("2026-10-16T06:00:00Z")), topicId: null },
  ]);
  assert(results.length === 1 && results[0].answered === 3 && results[0].correct === 2, JSON.stringify(results));
  assert(topicStatus(undefined) === "unknown" && topicStatus({ answered: 2, correct: 2 }) === "unknown", "too little evidence classified");
  assert(topicStatus({ answered: 3, correct: 0 }) === "work-on" && topicStatus({ answered: 4, correct: 4 }) === "going-well" && topicStatus({ answered: 6, correct: 4 }) === "practising", "status thresholds");
});

const target = localTarget();
if (!target) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test");
  finish();
}
const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const q3 = demo.papers.find((paper) => paper.year === 2024).questions[2];
if (sql(`select count(*) from public.questions where id = '${q3.id}'`) !== "1") {
  skip("database checks", "the demo papers are not loaded");
  finish();
}
const people = accounts(target, "graph");
const me = await people.create("s");
const other = await people.create("o");

await check("my_topic_results(): retries the same day count once; private to the caller", async () => {
  for (const answer of ["1", "2", "12"]) await me.client.rpc("record_practice_answer", { question: q3.id, answer, request: randomUUID() });
  const { data, error } = await me.client.rpc("my_topic_results");
  if (error) throw new Error(error.message);
  const row = data.find((item) => item.topic_id === q3.topicId);
  assert(row?.answered === 1 && row.correct === 0, JSON.stringify(row));
  const theirs = await other.client.rpc("my_topic_results");
  assert(!theirs.data?.length, "another student sees these results");
});

await people.cleanUp();
finish();
