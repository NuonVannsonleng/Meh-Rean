#!/usr/bin/env node
/**
 * Calculation checks for exam readiness and analytics (Learning OS 9.1):
 * src/lib/readiness.ts with src/data/learning/readiness-rules.json. No database.
 *
 *   npm run test:readiness
 */

import { readFileSync } from "node:fs";
import { buildReadiness } from "../src/lib/readiness.ts";
import { assert, reporter } from "./lib/local-supabase.mjs";

const { check, finish } = reporter();
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const rules = read("../src/data/learning/readiness-rules.json");
const masteryRules = read("../src/data/learning/mastery-rules.json");
const NOW = new Date("2026-10-17T05:00:00Z");
const at = (daysAgo, hour = 3) => new Date(NOW.getTime() - daysAgo * 86_400_000 - hour * 3_600_000).toISOString();
const topics = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id, index) => ({ id, chapterId: index < 5 ? "ch1" : "ch2" }));
let n = 0;
const answer = (topicId, correct, daysAgo, eventType = "question_attempted") => ({ id: String(++n), eventType, resourceType: "question", resourceId: `q-${topicId}-${n}`, topicId, chapterId: null, data: { correct, difficulty: 3 }, createdAt: at(daysAgo) });
const exam = (id, daysAgo, score, maxScore = 20) => ({ id, paperId: "p", timing: "practice", durationMinutes: 60, startedAt: at(daysAgo, 5), deadlineAt: at(daysAgo, 4), submittedAt: at(daysAgo, 4), status: "submitted", score, maxScore, unmarked: 0 });
const run = (events, exams = []) => buildReadiness({ topics, events, exams, now: NOW }, rules, masteryRules);

await check("no data: every part says not enough data, nothing is guessed", async () => {
  const r = run([]);
  assert(r.readiness.level === "not-enough-data" && r.readiness.score === null && r.readiness.parts === null, JSON.stringify(r.readiness));
  assert(r.mastery.now === null && r.mastery.trends.every((t) => t.trend.state === "not-enough-data"), "mastery trend");
  assert(r.exams.trend.state === "not-enough-data" && r.exams.latest === null, "exam trend");
  assert(r.coverage.practised === 0 && r.coverage.total === 10 && r.week.answers === 0, "counts");
});

await check("coverage counts practised and labelled topics, per chapter", async () => {
  const events = [answer("a", true, 1), answer("a", true, 2), answer("a", true, 3), answer("b", false, 1), answer("f", true, 1)];
  const r = run(events);
  assert(r.coverage.practised === 3 && r.coverage.labelled === 1, JSON.stringify(r.coverage));
  assert(r.coverage.byChapter.find((c) => c.chapterId === "ch1").practised === 2 && r.coverage.byChapter.find((c) => c.chapterId === "ch2").practised === 1, "per chapter");
});

// Three topics answered right four times each, 20–40 days ago; then wrong answers this week.
const old = ["a", "b", "c"].flatMap((topic) => [40, 35, 30, 25].map((d) => answer(topic, true, d)));
const recent = ["a", "b", "c"].flatMap((topic) => [3, 2].map((d) => answer(topic, false, d)));

await check("mastery trend: estimates replayed as they stood 7 and 28 days ago; a drop shows as down", async () => {
  const r = run([...old, ...recent]);
  const week = r.mastery.trends.find((t) => t.days === 7);
  const month = r.mastery.trends.find((t) => t.days === 28);
  assert(week.trend.state === "down" && week.then > r.mastery.now, JSON.stringify(week));
  // 28 days ago only the answers 30–40 days ago existed: three each.
  assert(month.then !== null && month.trend.state === "down", JSON.stringify(month));
  const steady = run(old);
  assert(steady.mastery.trends.find((t) => t.days === 7).trend.state === "flat", "no new answers should be flat");
});

await check("mock exam trend: latest against the average of up to three before; one exam is not enough", async () => {
  assert(run([], [exam("e1", 10, 10)]).exams.trend.state === "not-enough-data", "one exam");
  const r = run([], [exam("e1", 30, 8), exam("e2", 20, 10), exam("e3", 10, 12), exam("e4", 2, 16)]);
  assert(r.exams.completed.map((e) => e.percent).join() === "40,50,60,80" && r.exams.latest === 80, JSON.stringify(r.exams.completed));
  assert(r.exams.trend.state === "up" && r.exams.trend.change === 30, JSON.stringify(r.exams.trend));
  const running = { ...exam("e5", 1, null), submittedAt: null, status: "in-progress" };
  assert(run([], [exam("e1", 3, 10), running]).exams.completed.length === 1, "an unfinished exam counted");
});

await check("consistency: active days in 28 and weeks with at least 3 active days", async () => {
  const events = [0, 1, 2, 8, 9, 15].map((d) => answer("a", true, d));
  const r = run(events);
  assert(r.consistency.activeDays === 6 && r.consistency.weeks === 4 && r.consistency.goodWeeks === 1, JSON.stringify(r.consistency));
});

await check("readiness needs 20 answers; parts without data share their weight; bands from the rules", async () => {
  const few = run(old.slice(0, 10));
  assert(few.readiness.level === "not-enough-data" && few.readiness.answers === 10, JSON.stringify(few.readiness));
  const enough = run([...old, ...["d", "e", "f", "g", "h"].flatMap((t) => [5, 4].map((d) => answer(t, true, d)))]);
  const { parts, score, level } = enough.readiness;
  assert(parts.exams === null && parts.coverage === 30, JSON.stringify(parts));
  // No exams: coverage and mastery weigh 0.4 each, shared equally.
  assert(score === Math.round((parts.coverage + parts.mastery) / 2), `${score} vs ${parts.coverage}, ${parts.mastery}`);
  assert(level === [...rules.levels].reverse().find((b) => score >= b.from).id, `${level} for ${score}`);
  const withExam = run([...old, ...["d", "e", "f", "g", "h"].flatMap((t) => [5, 4].map((d) => answer(t, true, d)))], [exam("e1", 1, 20)]);
  assert(withExam.readiness.parts.exams === 100 && withExam.readiness.score > score, "an exam at 100% should raise it");
});

await check("this week against last week", async () => {
  const events = [answer("a", true, 1), answer("b", false, 2), answer("a", true, 3, "mistake_reviewed"), answer("c", true, 9), { ...answer("x", true, 1), eventType: "mock_exam_completed", data: {} }];
  const r = run(events);
  assert(r.week.answers === 3 && r.week.correct === 2 && r.week.reviews === 1 && r.week.topics === 2 && r.week.exams === 1, JSON.stringify(r.week));
  assert(r.week.previous.answers === 1 && r.week.previous.activeDays === 1, JSON.stringify(r.week.previous));
});

finish();
