#!/usr/bin/env node
/**
 * Checks for the revision queue (Learning OS 7.1, 7.2): src/lib/revision.ts
 * with src/data/learning/revision-rules.json (unit), and with a local
 * Supabase the postpone rules in postpone_review().
 *
 *   npm run test:revision
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expandLinks } from "../src/lib/conceptGraph.ts";
import { buildRevisionQueue } from "../src/lib/revision.ts";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const rules = read("../src/data/learning/revision-rules.json");
const links = expandLinks(read("../src/data/curriculum-links/kh-grade12-math.json"));
const T = (short) => `kh-grade12-science-mathematics-${short}`;
const NOW = new Date("2026-10-17T05:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const review = (id, topic, dueDaysAgo, extra = {}) => ({ questionId: id, topicId: topic ? T(topic) : null, nextReviewAt: dueDaysAgo === null ? null : daysAgo(dueDaysAgo), timesWrong: 1, postponed: 0, ...extra });
const m = (topic, score, label) => ({ topicId: T(topic), score, evidence: 5, correct: 1, lastAt: daysAgo(1), confidence: 0.5, confidenceLevel: "medium", label, version: 2 });
const queue = (reviews, extra = {}) => buildRevisionQueue({ reviews, mastery: [], links, examDate: null, now: NOW, ...extra }, rules);

await check("due reviews only, most overdue first; finished ones never; later ones listed as coming up within 7 days", async () => {
  const { due, upcoming } = queue([review("a", "conics-ellipse", 0), review("b", "conics-ellipse", 5), review("c", "conics-ellipse", null), review("d", "conics-ellipse", -2), review("e", "conics-ellipse", -9)]);
  assert(due.map((i) => i.id).join() === "b,a", due.map((i) => i.id).join());
  assert(due[0].reasons[0].code === "overdue" && due[0].reasons[0].days === 5, JSON.stringify(due[0].reasons));
  assert(upcoming.map((i) => i.id).join() === "d", upcoming.map((i) => i.id).join());
});

await check("repeated mistakes, weak topics and prerequisites of weak topics come first, saying why", async () => {
  const mastery = [m("integrals-by-parts", 20, "needs-foundation")];
  const { due } = queue(
    [review("plain", "conics-ellipse", 1), review("again", "conics-ellipse", 1, { timesWrong: 3 }), review("weak", "integrals-by-parts", 1), review("root", "integrals-antiderivatives", 1)],
    { mastery },
  );
  assert(due.at(-1).id === "plain", due.map((i) => `${i.id}:${i.priority}`).join());
  assert(due.find((i) => i.id === "again").reasons.some((r) => r.code === "repeated" && r.times === 3), "repeated reason");
  assert(due.find((i) => i.id === "weak").reasons.some((r) => r.code === "weak-topic" && r.label === "needs-foundation"), "weak reason");
  const root = due.find((i) => i.id === "root");
  assert(root.reasons.some((r) => r.code === "needed-for" && r.topicId === T("integrals-by-parts")), JSON.stringify(root.reasons));
});

await check("an exam within 60 days raises every due review and says so", async () => {
  const base = queue([review("a", "conics-ellipse", 2)]).due[0];
  const soon = queue([review("a", "conics-ellipse", 2)], { examDate: "2026-11-16" }).due[0];
  assert(soon.priority > base.priority && soon.reasons.some((r) => r.code === "exam-soon" && r.days === 30), JSON.stringify(soon));
});

await check("postponing is offered until it has been used 5 times; ties are deterministic", async () => {
  const { due } = queue([review("x", "conics-ellipse", 1, { postponed: 4 }), review("y", "conics-ellipse", 1, { postponed: 5 })]);
  assert(due.find((i) => i.id === "x").canPostpone && !due.find((i) => i.id === "y").canPostpone, "postpone limit");
  assert(due.map((i) => i.id).join() === "x,y" && queue([...[review("y", "conics-ellipse", 1, { postponed: 5 }), review("x", "conics-ellipse", 1, { postponed: 4 })]]).due.map((i) => i.id).join() === "x,y", "ties");
  assert(rules.postponeDays.join() === "1,3,7" && rules.maxPostpones === 5, "rules match postpone_review()");
});

const target = localTarget();
if (!target) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}
const demo = read("../src/data/demo/kh-grade12-math-papers.json");
const question = demo.papers.flatMap((p) => p.questions).find((q) => q.id.endsWith("2403"));
if (sql(`select count(*) from public.questions where id = '${question.id}'`) !== "1") {
  skip("database checks", "run supabase/setup-all.sql first (demo papers)");
  finish();
}
const people = accounts(target, "revision");
const me = await people.create("s");
const other = await people.create("o");
await me.client.rpc("record_practice_answer", { question: question.id, answer: "99999", request: randomUUID() });
const nextReview = () => sql(`select extract(epoch from next_review_at)::bigint || ':' || postponed from public.mistakes where user_id = '${me.id}' and question_id = '${question.id}'`);

await check("the database postpones from the later of now and the due date, only by 1, 3 or 7 days", async () => {
  const [due] = nextReview().split(":").map(Number);
  const { data, error } = await me.client.rpc("postpone_review", { question: question.id, days: 3 });
  assert(!error, error?.message);
  const [after, count] = nextReview().split(":").map(Number);
  assert(Math.abs(after - (due + 3 * 86400)) <= 2 && count === 1 && Math.abs(Date.parse(data) / 1000 - after) <= 1, `${due} → ${after} (${count})`);
  assert((await me.client.rpc("postpone_review", { question: question.id, days: 30 })).error, "postponed by 30 days");
  assert((await me.client.rpc("postpone_review", { question: question.id, days: 0 })).error, "postponed by 0 days");
  sql(`update public.mistakes set next_review_at = now() - interval '10 days' where user_id = '${me.id}' and question_id = '${question.id}'`);
  await me.client.rpc("postpone_review", { question: question.id, days: 1 });
  const [fromNow] = nextReview().split(":").map(Number);
  assert(Math.abs(fromNow - (Date.now() / 1000 + 86400)) <= 30, "an overdue review was not postponed from now");
});

await check("at most 5 times; only your own; nobody else, and not a visitor", async () => {
  for (let i = 0; i < 3; i++) await me.client.rpc("postpone_review", { question: question.id, days: 1 });
  const sixth = await me.client.rpc("postpone_review", { question: question.id, days: 1 });
  assert(sixth.error && /5 times/.test(sixth.error.message) && nextReview().endsWith(":5"), sixth.error?.message ?? "a sixth postpone worked");
  assert((await other.client.rpc("postpone_review", { question: question.id, days: 1 })).error, "another student postponed it");
  assert((await people.anon.rpc("postpone_review", { question: question.id, days: 1 })).error, "a visitor postponed it");
  assert((await me.client.from("mistakes").update({ next_review_at: new Date(Date.now() + 365 * 86400000).toISOString() }).eq("question_id", question.id).select()).data?.length !== 1, "a student set the date directly");
});

await people.cleanUp();
finish();
