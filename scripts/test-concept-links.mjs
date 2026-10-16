#!/usr/bin/env node
/**
 * Checks for the knowledge graph's topic links (Learning OS 1.1): the links
 * file is sound, and (with a local Supabase) the database keeps it sound.
 *
 *   npm run test:concept-links
 */

import { readFileSync } from "node:fs";
import { flattenCurriculum } from "../src/lib/curriculum.ts";
import { expandLinks, findPrerequisiteCycle, linkProblems, prerequisitesOf } from "../src/lib/conceptGraph.ts";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const curriculum = flattenCurriculum(JSON.parse(readFileSync(new URL("../src/data/curriculum/kh-grade12.json", import.meta.url), "utf8")));
const topicIds = new Set(curriculum.chapters.flatMap((chapter) => chapter.topics.map((topic) => topic.id)));
const seed = JSON.parse(readFileSync(new URL("../src/data/curriculum-links/kh-grade12-math.json", import.meta.url), "utf8"));
const links = expandLinks(seed);
const T = (short) => `kh-grade12-science-mathematics-${short}`;

await check("the links file names real topics, has no duplicates or cycles, and is provisional", async () => {
  const problems = linkProblems(links, topicIds);
  assert(!problems.length, problems.join("; "));
  assert(seed.verification === "provisional" && seed.source.length > 10, "the draft links must be labelled provisional with a note");
  return `${links.length} links`;
});

await check("cycle detection finds a loop", async () => {
  const loop = [
    { fromTopic: "a", toTopic: "b", kind: "prerequisite" },
    { fromTopic: "b", toTopic: "c", kind: "prerequisite" },
    { fromTopic: "c", toTopic: "a", kind: "prerequisite" },
  ];
  assert(findPrerequisiteCycle(loop)?.length === 4, JSON.stringify(findPrerequisiteCycle(loop)));
  assert(findPrerequisiteCycle(loop.slice(0, 2)) === null, "a chain was called a cycle");
});

await check("prerequisites of integration by parts go back to limits, nearest first", async () => {
  const chain = prerequisitesOf(T("integrals-by-parts"), links).map((item) => `${item.distance}:${item.topicId.replace(T(""), "")}`);
  assert(chain[0] === "1:integrals-definite" && chain.includes("3:derivatives-rules") && chain.at(-1) === "4:limits-continuity-limits", chain.join(", "));
  assert(prerequisitesOf(T("limits-continuity-limits"), links).length === 0, "the first topic has prerequisites");
});

const target = localTarget();
if (!target) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test");
  finish();
}
if (sql("select count(*) from public.concept_links") === "0") {
  skip("database checks", "the links are not loaded (run supabase/setup-all.sql)");
  finish();
}

const people = accounts(target, "links");
const { anon } = people;
const student = await people.create("s");
const admin = await people.create("a", { admin: true });

await check("everyone reads the links; the seed is all there", async () => {
  const { data } = await anon.from("concept_links").select("id").like("from_topic", "kh-grade12-science-mathematics-%");
  assert(data?.length >= links.length, `${data?.length} links visible`);
});

await check("only admins change links", async () => {
  const row = { from_topic: T("conics-parabola"), to_topic: T("vectors-space-dot-product"), kind: "prerequisite" };
  assert((await anon.from("concept_links").insert(row)).error, "a visitor added a link");
  assert((await student.client.from("concept_links").insert(row)).error, "a student added a link");
  const added = await admin.client.from("concept_links").insert(row).select("id").single();
  assert(!added.error, added.error?.message);
  const removed = await student.client.from("concept_links").delete().eq("id", added.data.id).select();
  assert(!removed.data?.length, "a student removed a link");
  assert(!(await admin.client.from("concept_links").delete().eq("id", added.data.id)).error, "the admin could not remove it");
});

await check("the database refuses cycles, self links, unordered related pairs and unsourced 'verified'", async () => {
  const bad = [
    { from_topic: T("integrals-volume"), to_topic: T("limits-continuity-limits"), kind: "prerequisite" },
    { from_topic: T("conics-parabola"), to_topic: T("conics-parabola"), kind: "related" },
    { from_topic: T("probability-events"), to_topic: T("conics-parabola"), kind: "related" },
    { from_topic: T("conics-parabola"), to_topic: T("probability-events"), kind: "prerequisite", verification: "verified", source: " " },
    { from_topic: T("limits-continuity-limits"), to_topic: T("derivatives-rules"), kind: "prerequisite" },
  ];
  for (const row of bad) assert((await admin.client.from("concept_links").insert(row)).error, `accepted ${JSON.stringify(row)}`);
});

await people.cleanUp();
finish();
