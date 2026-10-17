#!/usr/bin/env node
/**
 * Unit checks for adaptive practice (Learning OS 5): src/lib/adaptive.ts with
 * src/data/learning/adaptive-rules.json. No database.
 *
 *   npm run test:adaptive
 */

import { readFileSync } from "node:fs";
import { lastAnswered, markable, nextDifficulty, pickNext, startingDifficulty } from "../src/lib/adaptive.ts";
import { assert, reporter } from "./lib/local-supabase.mjs";

const { check, finish } = reporter();
const rules = JSON.parse(readFileSync(new URL("../src/data/learning/adaptive-rules.json", import.meta.url), "utf8"));
const NOW = new Date("2026-10-17T05:00:00Z");
const daysAgo = (n) => NOW.getTime() - n * 86_400_000;
const q = (id, topicId, difficulty, type = "numeric") => ({ id, topicId, chapterId: "c", difficulty, type });
const mastery = (score, label = "practising") => ({ topicId: "a", score, evidence: 5, correct: 3, lastAt: null, confidence: 0.5, confidenceLevel: "medium", label, version: 2 });
const pick = (pool, extra = {}) => pickNext({ pool, topics: ["a", "b"], difficulty: 3, asked: new Set(), lastAnswered: new Map(), now: NOW, ...extra }, rules);

await check("the rules file is complete", async () => {
  for (const key of ["version", "startDifficulty", "scorePerDifficultyStep", "stepAfterRight", "stepAfterWrong", "repeatAfterDays"]) assert(typeof rules[key] === "number", key);
  for (const key of ["topic", "difficulty", "freshness"]) assert(rules.weights[key] > 0, `weight ${key}`);
});

await check("the starting difficulty follows the estimate; none means a gentle start; it stays within 1–5", async () => {
  assert(startingDifficulty(undefined, rules) === 2 && startingDifficulty(mastery(null, "unknown"), rules) === 2, "no estimate");
  assert(startingDifficulty(mastery(10), rules) === 1 && startingDifficulty(mastery(30), rules) === 2 && startingDifficulty(mastery(60), rules) === 3 && startingDifficulty(mastery(80), rules) === 4 && startingDifficulty(mastery(100), rules) === 5, "bands");
  assert(startingDifficulty(mastery(100), rules, 1) === 5 && startingDifficulty(mastery(0), rules, -1) === 1, "offset clamped");
});

await check("difficulty moves one step per answer, never past 1 or 5", async () => {
  assert(nextDifficulty(3, true, rules) === 4 && nextDifficulty(3, false, rules) === 2, "one step");
  assert(nextDifficulty(5, true, rules) === 5 && nextDifficulty(1, false, rules) === 1, "bounds");
  let d = 2;
  for (const right of [true, true, true, true, false, false]) d = nextDifficulty(d, right, rules);
  assert(d === 3, `after the run ${d}`);
});

await check("questions on the first target topic come first, nearest the difficulty", async () => {
  const pool = [q("b3", "b", 3), q("a1", "a", 1), q("a3", "a", 3), q("a5", "a", 5)];
  assert(pick(pool).id === "a3", pick(pool).id);
  assert(pick(pool, { difficulty: 5 }).id === "a5", "hard target");
  assert(pick(pool, { difficulty: 1 }).id === "a1", "easy target");
  assert(pick([q("b3", "b", 3), q("a5", "a", 5)], { difficulty: 3 }).id === "a5", "topic outweighs difficulty by design");
});

await check("only questions the server can mark, on the target topics", async () => {
  const pool = [q("open", "a", 3, "open"), q("proof", "a", 3, "proof"), q("other", "z", 3), q("mc", "a", 3, "multiple-choice")];
  assert(pick(pool).id === "mc", pick(pool).id);
  assert(pick([q("open", "a", 3, "open"), q("other", "z", 3)]) === null, "picked an unmarkable or off-target question");
  assert(markable({ type: "numeric" }) && !markable({ type: "open" }), "markable");
});

await check("no repeats: never twice in a session; recently answered ones only when nothing else is left", async () => {
  const pool = [q("a1", "a", 3), q("a2", "a", 3), q("a3", "a", 3)];
  const asked = new Set();
  const order = [];
  for (let i = 0; i < 3; i++) {
    const next = pick(pool, { asked });
    order.push(next.id);
    asked.add(next.id);
  }
  assert(new Set(order).size === 3 && pick(pool, { asked }) === null, order.join());
  const recent = new Map([["a1", daysAgo(1)], ["a2", daysAgo(10)]]);
  assert(pick(pool, { lastAnswered: recent }).id === "a3", "a never-answered question should come first");
  assert(pick([q("a1", "a", 3), q("a2", "a", 3)], { lastAnswered: recent }).id === "a2", "the one answered longer ago");
  assert(pick([q("a1", "a", 3)], { lastAnswered: recent }).id === "a1", "nothing else left: a recent one is allowed");
});

await check("last answered comes from answer events only, latest wins", async () => {
  const event = (resourceId, eventType, createdAt) => ({ id: createdAt, eventType, resourceType: "question", resourceId, topicId: "a", chapterId: "c", data: {}, createdAt });
  const last = lastAnswered([
    event("a1", "question_attempted", "2026-10-10T00:00:00Z"),
    event("a1", "mistake_reviewed", "2026-10-12T00:00:00Z"),
    event("v1", "video_watched", "2026-10-13T00:00:00Z"),
  ]);
  assert(last.get("a1") === Date.parse("2026-10-12T00:00:00Z") && !last.has("v1"), JSON.stringify([...last]));
});

await check("deterministic: same input, same pick, whatever the pool order", async () => {
  const pool = [q("x2", "a", 3), q("x1", "a", 3), q("x3", "b", 3)];
  assert(pick(pool).id === "x1" && pick([...pool].reverse()).id === "x1", "ties go by id");
});

finish();
