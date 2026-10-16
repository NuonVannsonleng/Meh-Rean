#!/usr/bin/env node
/**
 * Unit checks for the mastery estimate (Learning OS 3.1): src/lib/mastery.ts
 * with src/data/learning/mastery-rules.json. No database.
 *
 *   npm run test:mastery
 */

import { readFileSync } from "node:fs";
import { describeMastery, emptyMastery, masteryFromEvents, masteryLabel, masteryStep, updateMastery } from "../src/lib/mastery.ts";
import { assert, reporter } from "./lib/local-supabase.mjs";

const { check, finish } = reporter();
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

finish();
