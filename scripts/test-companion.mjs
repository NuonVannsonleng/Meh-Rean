#!/usr/bin/env node
/**
 * Unit checks for the study companion without AI (Learning OS 8.1):
 * src/lib/companion.ts and companionText.ts with
 * src/data/learning/companion-rules.json. No database.
 *
 *   npm run test:companion
 */

import { readFileSync } from "node:fs";
import { planSession, progressFacts } from "../src/lib/companion.ts";
import { stepText, summaryLines } from "../src/lib/companionText.ts";
import { assert, reporter } from "./lib/local-supabase.mjs";

const { check, finish } = reporter();
const rules = JSON.parse(readFileSync(new URL("../src/data/learning/companion-rules.json", import.meta.url), "utf8"));
const rec = (topicId, type = "practise") => ({ topicId, kind: "weak", score: 1, reasons: [], action: type === "practise" ? { type, questions: 3 } : type === "review" ? { type, due: 1 } : { type, id: "x", title: "t" }, also: [] });
const sum = (steps) => steps.reduce((total, step) => total + step.minutes, 0);

await check("a plan always fills the session exactly, in steps of 5 minutes (300 random cases)", async () => {
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 300; i++) {
    const minutes = [15, 20, 30, 45, 60, 90, 120][Math.floor(random() * 7)];
    const recommendations = Array.from({ length: Math.floor(random() * 6) }, (_, n) => rec(`t${n}`, ["practise", "video", "note", "review"][Math.floor(random() * 4)]));
    const steps = planSession({ minutes, reviewsDue: Math.floor(random() * 12), recommendations }, rules);
    assert(sum(steps) === minutes, `case ${i}: ${sum(steps)} of ${minutes} (${JSON.stringify(steps)})`);
    assert(steps.every((step) => step.minutes >= rules.minStep && step.minutes % rules.minStep === 0), `case ${i}: step sizes ${steps.map((s) => s.minutes)}`);
    assert(steps.filter((s) => s.topicId).length <= rules.maxTopics, `case ${i}: too many topics`);
  }
});

await check("reviews come first, a few minutes each, at most 40% of the time", async () => {
  const two = planSession({ minutes: 30, reviewsDue: 2, recommendations: [rec("a")] }, rules);
  assert(two[0].activity === "review" && two[0].minutes === 5 && two[1].topicId === "a" && two[1].minutes === 25, JSON.stringify(two));
  const many = planSession({ minutes: 30, reviewsDue: 20, recommendations: [rec("a")] }, rules);
  assert(many[0].minutes === 10, `capped at ${many[0].minutes}`);
});

await check("topics in Study next order; videos and notes get 10 minutes; notebook-only suggestions are left to the review step", async () => {
  const steps = planSession({ minutes: 40, reviewsDue: 0, recommendations: [rec("v", "video"), rec("r", "review"), rec("a"), rec("n", "note")] }, rules);
  assert(steps.map((s) => `${s.activity}:${s.topicId}:${s.minutes}`).join() === "watch:v:10,practise:a:20,read:n:10", steps.map((s) => `${s.activity}:${s.topicId}:${s.minutes}`).join());
});

await check("a 45-minute session or longer has a 5-minute break in the middle; nothing to do means free practice", async () => {
  const long = planSession({ minutes: 60, reviewsDue: 3, recommendations: [rec("a"), rec("b")] }, rules);
  const index = long.findIndex((s) => s.activity === "break");
  assert(index > 0 && index < long.length - 1 && long[index].minutes === 5, JSON.stringify(long));
  assert(!planSession({ minutes: 30, reviewsDue: 3, recommendations: [rec("a")] }, rules).some((s) => s.activity === "break"), "a break in a short session");
  const free = planSession({ minutes: null, reviewsDue: 0, recommendations: [] }, rules);
  assert(free.length === 1 && free[0].activity === "practise" && free[0].topicId === null && free[0].minutes === rules.defaultMinutes, JSON.stringify(free));
  const reviewsOnly = planSession({ minutes: 20, reviewsDue: 2, recommendations: [] }, rules);
  assert(reviewsOnly.length === 1 && reviewsOnly[0].activity === "review" && reviewsOnly[0].minutes === 20, JSON.stringify(reviewsOnly));
});

const NOW = new Date("2026-10-17T05:00:00Z");
const facts = progressFacts({
  topicIds: ["a", "b", "c", "d", "e"],
  mastery: [
    { topicId: "a", label: "developing", score: 40, evidence: 4 },
    { topicId: "b", label: "needs-foundation", score: 10, evidence: 5 },
    { topicId: "c", label: "strong", score: 80, evidence: 6 },
    { topicId: "d", label: "unknown", score: null, evidence: 1 },
    { topicId: "zz", label: "strong", score: 99, evidence: 9 },
  ],
  reviewsDue: 2,
  activity: { answers: 8, correct: 6, activeDays: 3 },
  examDate: "2026-11-16",
  now: NOW,
});

await check("progress facts: counts, weakest and strongest first, unknown topics ignored, exam days", async () => {
  assert(facts.total === 5 && facts.practised === 4 && facts.done === 1, JSON.stringify(facts));
  assert(facts.workOn.join() === "b,a" && facts.goingWell.join() === "c" && facts.examDays === 30, JSON.stringify(facts));
  assert(progressFacts({ topicIds: [], mastery: [], reviewsDue: 0, activity: { answers: 0, correct: 0, activeDays: 0 }, examDate: "2026-01-01", now: NOW }).examDays === null, "a past exam");
});

await check("summary and plan steps read as sentences in English and in Khmer", async () => {
  const nameOf = (id) => `«${id}»`;
  const en = summaryLines(facts, "en", nameOf);
  const km = summaryLines(facts, "km", nameOf);
  assert(en[0] === "You have practised 4 of 5 topics; 1 is strong or better." && en[1] === "In the last 7 days: 8 answers, 75% right, on 3 days.", en.join(" | "));
  assert(en.some((line) => line === "Worth more practice: «b», «a».") && en.some((line) => line.startsWith("2 reviews")) && en.at(-1) === "Your exam is in 30 days.", en.join(" | "));
  assert(km.length === en.length && km.every((line) => /[ក-៿]/.test(line) && !/undefined|NaN/.test(line)), km.join(" | "));
  for (const activity of ["review", "practise", "watch", "read", "break"]) {
    for (const language of ["en", "km"]) assert(stepText({ minutes: 5, activity, topicId: "a" }, language, nameOf).length > 3, `${activity} ${language}`);
  }
  assert(stepText({ minutes: 5, activity: "practise", topicId: null }, "en", nameOf) === "Practise questions of your choice", "free practice");
});

finish();
