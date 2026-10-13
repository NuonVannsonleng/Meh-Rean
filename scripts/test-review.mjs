#!/usr/bin/env node
/**
 * Unit checks for src/lib/review.ts (roadmap task 3.2), and that its
 * intervals match note_answer in supabase/schema.sql.
 *
 *   npm run test:review
 */

import { readFileSync } from "node:fs";
import { afterRight, afterWrong, isDue, isLearned, REVIEW_INTERVAL_DAYS } from "../src/lib/review.ts";

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, actual, expected) {
  results.push(same(actual, expected) ? ["✓", name] : ["✗", name, `got ${JSON.stringify(actual)}`]);
}

const DAY = 86_400_000;
const start = new Date("2026-10-13T08:00:00Z");
const at = (days) => new Date(start.getTime() + days * DAY);
const daysUntil = (state, from) => (state.nextReviewAt ? (Date.parse(state.nextReviewAt) - from.getTime()) / DAY : null);

const wrong = afterWrong(start);
check("a wrong answer: stage 0, first review in 1 day, not fixed", [wrong.reviewStage, daysUntil(wrong, start), wrong.fixedAt], [0, 1, null]);

const early = afterRight(wrong, at(0.1));
check("right before the review is due: fixed, but no review passed", [early.reviewStage, early.nextReviewAt === wrong.nextReviewAt, Boolean(early.fixedAt)], [0, true, true]);

let state = early;
const waits = [];
let day = 1;
for (let review = 0; review < 4; review += 1) {
  const now = at(day);
  state = afterRight(state, now);
  waits.push(daysUntil(state, now));
  if (state.nextReviewAt) day += daysUntil(state, now);
}
check("each passed review waits longer: 3, 7, 14 days, then done", waits, [3, 7, 14, null]);
check("after four reviews it is learned, with nothing due", [isLearned(state), isDue(state, at(400))], [true, false]);
check("a right answer once learned changes nothing", afterRight(state, at(500)), state);

const slipped = afterWrong(at(60));
check("wrong again later: back to stage 0 and tomorrow", [slipped.reviewStage, daysUntil(slipped, at(60))], [0, 1]);
check("due exactly at the time, not a moment before", [isDue(wrong, at(1)), isDue(wrong, new Date(at(1).getTime() - 1))], [true, false]);
check("the fixed date is kept, not moved, by later right answers", afterRight({ ...wrong, fixedAt: "2026-10-13T09:00:00.000Z" }, at(1)).fixedAt, "2026-10-13T09:00:00.000Z");

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const sqlIntervals = schema.match(/intervals constant integer\[\] := array\[([\d,\s]+)\]/)?.[1].split(",").map(Number);
check("the database uses the same intervals", sqlIntervals, [...REVIEW_INTERVAL_DAYS]);

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => r[0] === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
