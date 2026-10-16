#!/usr/bin/env node
/**
 * Checks for the mastery estimate (Learning OS 3.1–3.3): src/lib/mastery.ts
 * with src/data/learning/mastery-rules.json (unit), and with a local Supabase
 * the stored estimates in topic_mastery match it and only the database
 * writes them.
 *
 *   npm run test:mastery
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describeMastery, emptyMastery, masteryEvidence, masteryFromEvents, masteryLabel, masteryStep, updateMastery } from "../src/lib/mastery.ts";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const rules = JSON.parse(readFileSync(new URL("../src/data/learning/mastery-rules.json", import.meta.url), "utf8"));
const NOW = new Date("2026-10-16T05:00:00Z");
const run = (answers) => answers.reduce((state, answer) => updateMastery(state, answer, rules), emptyMastery(rules));
const answer = (correct, difficulty = null, at = "2026-10-16T01:00:00Z") => ({ correct, difficulty, at });
let id = 0;
const event = (topicId, question, correct, createdAt, extra = {}) => ({
  id: `e${++id}`,
  eventType: "question_attempted",
  resourceType: "question",
  resourceId: question,
  topicId,
  chapterId: null,
  data: { correct, source: "practice", ...extra },
  createdAt,
});

await check("the rules file is complete and its labels rise from 0", async () => {
  for (const key of ["version", "prior", "stepMin", "stepMax", "defaultDifficulty", "difficultyWeight", "confidenceEvidence", "confidenceHalfLifeDays"]) assert(typeof rules[key] === "number", `missing ${key}`);
  const from = rules.labels.map((band) => band.from);
  assert(from[0] === 0 && from.every((value, index) => !index || value > from[index - 1]), `bands ${from}`);
  assert(rules.stepMin > 0 && rules.stepMax < 1 && rules.stepMin < rules.stepMax, "step bounds");
});

await check("no evidence: unknown, no score, no confidence", async () => {
  const none = describeMastery("t", emptyMastery(rules), rules, NOW);
  assert(none.score === null && none.label === "unknown" && none.confidence === 0 && none.confidenceLevel === "low", JSON.stringify(none));
  assert(masteryFromEvents([], rules, NOW).length === 0, "topics from no events");
});

await check("first attempt: right 75, wrong 25 (middle difficulty)", async () => {
  assert(run([answer(true)]).score === 75, `${run([answer(true)]).score}`);
  assert(run([answer(false)]).score === 25, `${run([answer(false)]).score}`);
  assert(run([answer(true, 3)]).score === 75, "difficulty 3 is the middle");
});

await check("right answers raise it, wrong ones lower it, always within 0–100", async () => {
  let state = emptyMastery(rules);
  for (let i = 0; i < 60; i++) {
    const next = updateMastery(state, answer(true, 5), rules);
    assert(next.score >= state.score && next.score <= 100, `right went ${state.score} → ${next.score}`);
    state = next;
  }
  for (let i = 0; i < 60; i++) {
    const next = updateMastery(state, answer(false, 1), rules);
    assert(next.score <= state.score && next.score >= 0, `wrong went ${state.score} → ${next.score}`);
    state = next;
  }
});

await check("one answer cannot swing it far: steps stay within the bounds and shrink with evidence", async () => {
  const steps = [];
  let state = emptyMastery(rules);
  for (let i = 0; i < 30; i++) {
    steps.push(masteryStep(state, answer(i % 2 === 0), rules));
    state = updateMastery(state, answer(i % 2 === 0), rules);
  }
  assert(steps.every((step) => step <= rules.stepMax && step >= rules.stepMin * (1 - 2 * rules.difficultyWeight)), `steps ${steps}`);
  const strong = run(Array.from({ length: 10 }, () => answer(true)));
  const after = updateMastery(strong, answer(false), rules);
  assert(strong.score - after.score < 15, `one wrong after 10 right: ${strong.score.toFixed(1)} → ${after.score.toFixed(1)}`);
});

await check("difficulty: a hard right answer or an easy wrong one moves it more", async () => {
  assert(run([answer(true, 5)]).score > run([answer(true, 3)]).score && run([answer(true, 3)]).score > run([answer(true, 1)]).score, "right answers");
  assert(run([answer(false, 1)]).score < run([answer(false, 3)]).score && run([answer(false, 3)]).score < run([answer(false, 5)]).score, "wrong answers");
  assert(run([answer(true, 9)]).score === run([answer(true, 5)]).score, "difficulty outside 1–5 is clamped");
});

await check("recency: a late run of wrong answers outweighs old right ones", async () => {
  const oldRight = run([...Array(8).fill(answer(true)), ...Array(4).fill(answer(false))]);
  const oldWrong = run([...Array(4).fill(answer(false)), ...Array(8).fill(answer(true))]);
  assert(oldRight.score < oldWrong.score, `${oldRight.score.toFixed(1)} vs ${oldWrong.score.toFixed(1)}`);
  assert(oldRight.correct === 8 && oldRight.evidence === 12, "counts");
});

await check("labels: bands by score; 'consistently strong' needs 6 answers", async () => {
  assert(masteryLabel(10, 3, rules) === "needs-foundation" && masteryLabel(30, 3, rules) === "developing" && masteryLabel(60, 3, rules) === "practising", "low bands");
  assert(masteryLabel(80, 3, rules) === "strong" && masteryLabel(95, 3, rules) === "strong" && masteryLabel(95, 6, rules) === "consistently-strong", "top bands");
  assert(masteryLabel(null, 0, rules) === "unknown", "no evidence");
  const five = describeMastery("t", run(Array(5).fill(answer(true))), rules, NOW);
  const six = describeMastery("t", run(Array(6).fill(answer(true))), rules, NOW);
  assert(five.label === "strong" && six.label === "consistently-strong", `${five.score}/${five.label}, ${six.score}/${six.label}`);
});

await check("confidence grows with evidence and halves after 30 days without practice", async () => {
  const at = "2026-10-16T01:00:00Z";
  const one = describeMastery("t", run([answer(true, null, at)]), rules, NOW);
  const ten = describeMastery("t", run(Array(10).fill(answer(true, null, at))), rules, NOW);
  assert(one.confidence < ten.confidence && one.confidenceLevel === "low" && ten.confidenceLevel === "medium", `${one.confidence} ${ten.confidence}`);
  const later = describeMastery("t", run(Array(10).fill(answer(true, null, at))), rules, new Date(Date.parse(at) + 30 * 86_400_000));
  assert(Math.abs(later.confidence - (10 / 15) * 0.5) < 0.01, `after 30 days ${later.confidence}`);
  assert(later.score === ten.score, "time alone changed the score");
});

await check("evidence from events: first attempt per question per Cambodia day; reviews and exams count; videos and marks do not", async () => {
  const A = "topic-a";
  const events = [
    event(A, "q1", false, "2026-10-15T02:00:00Z"),
    event(A, "q1", true, "2026-10-15T03:00:00Z"), // a retry the same day
    event(A, "q1", true, "2026-10-15T18:00:00Z"), // 01:00 next day in Cambodia: counts
    { ...event(A, "q2", true, "2026-10-15T04:00:00Z"), data: { correct: true, source: "exam" } },
    { ...event(A, "q3", false, "2026-10-15T05:00:00Z"), eventType: "mistake_reviewed" },
    { ...event(A, "v1", true, "2026-10-15T06:00:00Z"), eventType: "video_marked_understood", resourceType: "video", data: { self_reported: true } },
    { ...event(A, "q4", null, "2026-10-15T07:00:00Z"), data: { source: "exam" } },
    event(null, "q5", true, "2026-10-15T08:00:00Z"),
  ];
  const [result] = masteryFromEvents(events, rules, NOW);
  assert(masteryFromEvents(events, rules, NOW).length === 1, "topics");
  assert(result.evidence === 4 && result.correct === 2, `evidence ${result.evidence}, right ${result.correct}`);
  assert(result.lastAt === "2026-10-15T18:00:00Z", result.lastAt);
});

await check("deterministic: input order and duplicated events do not change the result; difficulty comes from the event", async () => {
  const events = [
    event("a", "q1", true, "2026-10-10T01:00:00Z", { difficulty: 5 }),
    event("a", "q2", false, "2026-10-11T01:00:00Z", { difficulty: 1 }),
    event("a", "q3", true, "2026-10-12T01:00:00Z"),
    event("b", "q4", false, "2026-10-12T02:00:00Z"),
  ];
  const once = JSON.stringify(masteryFromEvents(events, rules, NOW));
  assert(JSON.stringify(masteryFromEvents([...events].reverse(), rules, NOW)) === once, "order changed it");
  assert(JSON.stringify(masteryFromEvents([...events, events[0], events[1]], rules, NOW)) === once, "duplicates changed it");
  const expected = Math.round(run([answer(true, 5), answer(false, 1), answer(true)]).score);
  const a = masteryFromEvents(events, rules, NOW).find((item) => item.topicId === "a");
  assert(a.score === expected && a.version === rules.version, `${a.score} vs ${expected}`);
});

const target = localTarget();
if (!target) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}
const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const byId = new Map(demo.papers.flatMap((paper) => paper.questions).map((question) => [question.id.slice(-4), question]));
const counting = byId.get("2401"); // numeric, answer 120
const equation = byId.get("2403"); // numeric, answer 12
if (sql(`select count(*) from public.questions where id = '${counting.id}'`) !== "1" || sql("select count(*) from public.mastery_rules where active") !== "1") {
  skip("database checks", "run supabase/setup-all.sql first (demo papers and mastery rules)");
  finish();
}

const people = accounts(target, "mastery");
const { anon } = people;
const me = await people.create("s");
const other = await people.create("o");
const practise = (question, text, request = randomUUID()) => me.client.rpc("record_practice_answer", { question: question.id, answer: text, request });
const stored = async (client = me.client) => (await client.from("topic_mastery").select("*").order("topic_id")).data ?? [];
const asEvents = (rows) => rows.map((row) => ({ id: String(row.id), eventType: row.event_type, resourceType: row.resource_type, resourceId: row.resource_id, topicId: row.topic_id, chapterId: row.chapter_id, data: row.data, createdAt: row.created_at }));
const matchesApp = async () => {
  const events = asEvents((await me.client.from("learning_events").select("*")).data ?? []);
  const expected = masteryFromEvents(events, rules, NOW);
  const rows = await stored();
  assert(rows.length === expected.length, `${rows.length} stored, ${expected.length} expected`);
  for (const row of rows) {
    const app = expected.find((item) => item.topicId === row.topic_id);
    const mine = describeMastery(row.topic_id, { score: Number(row.score), evidence: row.evidence, correct: row.correct, lastAt: row.last_at }, rules, NOW);
    assert(app && mine.score === app.score && row.evidence === app.evidence && row.correct === app.correct && row.version === rules.version, `${row.topic_id}: stored ${row.score}/${row.evidence}, app ${app?.score}/${app?.evidence}`);
    const raw = run(masteryEvidence(events).get(row.topic_id)).score;
    assert(Math.abs(Number(row.score) - raw) < 1e-9, `${row.topic_id}: stored ${row.score}, app ${raw}`);
  }
  return rows;
};

await check("the database has the rules file as its active version", async () => {
  // jsonb keeps its own key order, so compare with keys sorted.
  const canonical = (value) => (Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value);
  const row = JSON.parse(sql("select rules::text from public.mastery_rules where active"));
  assert(JSON.stringify(canonical(row)) === JSON.stringify(canonical(rules)), "the database rules differ from mastery-rules.json (run npm run build:mastery-seed and setup-all.sql)");
});

await check("practice answers update the stored estimate, as the app works it out", async () => {
  assert((await stored()).length === 0, "an estimate before any answer");
  await practise(counting, "120");
  await practise(equation, "11");
  const rows = await matchesApp();
  assert(rows.length === 2, `${rows.length} topics`);
  const first = rows.find((row) => row.topic_id === counting.topicId);
  // Right on an easy question (difficulty 1): step 0.5 × (1 − 0.15 × 2) = 0.35.
  assert(Math.abs(Number(first.score) - 67.5) < 1e-9, `easy right answer gave ${first.score}`);
});

await check("a retry the same day and a repeated request change nothing", async () => {
  const before = JSON.stringify((await stored()).map((row) => [row.topic_id, row.score, row.evidence]));
  const request = randomUUID();
  await practise(equation, "12", request);
  await practise(equation, "12", request);
  await practise(counting, "1");
  assert(JSON.stringify((await stored()).map((row) => [row.topic_id, row.score, row.evidence])) === before, "the estimate moved");
  await matchesApp();
});

await check("exam answers count and carry the question's difficulty", async () => {
  sql(`select public.record_learning_event('${me.id}', 'question_attempted', 'question', '${byId.get("2302").id}', '{"correct": true, "source": "exam"}'::jsonb, 'exam:test-${randomUUID()}')`);
  const event = (await me.client.from("learning_events").select("data").eq("resource_id", byId.get("2302").id).single()).data;
  assert(event.data.difficulty === byId.get("2302").difficulty, JSON.stringify(event.data));
  const rows = await matchesApp();
  assert(rows.some((row) => row.topic_id === byId.get("2302").topicId), "no estimate for the exam answer");
});

await check("students only read their own estimates and cannot write any", async () => {
  assert((await stored(anon)).length === 0, "a visitor read estimates");
  assert((await stored(other.client)).length === 0, "another student read them");
  const row = { user_id: me.id, topic_id: counting.topicId, score: 100, evidence: 9, correct: 9, last_at: new Date().toISOString(), version: rules.version };
  assert((await me.client.from("topic_mastery").insert({ ...row, topic_id: byId.get("2501").topicId })).error, "a student inserted an estimate");
  await me.client.from("topic_mastery").update({ score: 100 }).eq("topic_id", counting.topicId);
  await me.client.from("topic_mastery").delete().eq("topic_id", counting.topicId);
  const after = (await stored()).find((item) => item.topic_id === counting.topicId);
  assert(after && Number(after.score) === 67.5, `a student changed their estimate (${after?.score})`);
  assert((await me.client.rpc("refresh_topic_mastery", { who: me.id, topic: counting.topicId })).error, "a student called the refresh");
  await me.client.from("mastery_rules").update({ active: false }).eq("version", rules.version);
  assert(sql(`select active from public.mastery_rules where version = ${rules.version}`) === "t", "a student changed the rules");
});

await check("a new rules version brings every estimate up to date, and back", async () => {
  const bumped = { ...rules, version: 9999, stepMin: 0.2 };
  try {
    sql(`insert into public.mastery_rules (version, rules) values (9999, '${JSON.stringify(bumped)}'::jsonb)`);
    sql("update public.mastery_rules set active = false where active");
    sql("update public.mastery_rules set active = true where version = 9999");
    assert(Number(sql("select public.refresh_all_topic_mastery()")) >= 3, "nothing refreshed");
    assert((await stored()).every((row) => row.version === 9999), "estimates kept the old version");
  } finally {
    sql("update public.mastery_rules set active = false where active");
    sql(`update public.mastery_rules set active = true where version = ${rules.version}`);
    sql("delete from public.mastery_rules where version = 9999");
    sql("select public.refresh_all_topic_mastery()");
  }
  await matchesApp();
});

await people.cleanUp();
finish();
