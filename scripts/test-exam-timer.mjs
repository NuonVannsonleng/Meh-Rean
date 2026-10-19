#!/usr/bin/env node
/**
 * Checks for the paper exam timer: src/lib/examTimer.ts and the BacII paper
 * lengths in src/data/bacii/exam-timings.json. No database.
 *
 *   npm run test:exam-timer
 */

import { readFileSync } from "node:fs";
import { crossedWarnings, elapsedMs, formatClock, isFinished, pauseTimer, readTimer, remainingMs, resumeTimer, startTimer, warningsFor } from "../src/lib/examTimer.ts";
import { assert, reporter } from "./lib/local-supabase.mjs";

const { check, finish } = reporter();
const data = JSON.parse(readFileSync(new URL("../src/data/bacii/exam-timings.json", import.meta.url), "utf8"));
const MIN = 60_000;
const T0 = Date.parse("2026-10-19T00:00:00Z");

await check("the timings file: two tracks of seven papers, sourced, provisional, each with a length and points", async () => {
  assert(data.verification === "provisional" && data.sources.length >= 2 && data.sources.every((s) => /^https:\/\//.test(s.url)), "sources");
  assert(data.tracks.map((t) => t.id).join() === "science,social", "tracks");
  for (const track of data.tracks) {
    assert(track.subjects.length === 7 && new Set(track.subjects.map((s) => s.id)).size === 7, `${track.id}: subjects`);
    for (const s of track.subjects) assert(Number.isInteger(s.minutes) && s.minutes > 0 && Number.isInteger(s.points) && s.points > 0 && s.nameEn && s.nameKm, `${track.id}/${s.id}`);
    // Each track's points add up to 525 (the foreign language is optional: 475 count).
    assert(track.subjects.reduce((sum, s) => sum + s.points, 0) === 525, `${track.id} points`);
    assert(track.subjects.filter((s) => s.elective).length === 1, `${track.id}: one elective`);
  }
  const science = Object.fromEntries(data.tracks[0].subjects.map((s) => [s.id, s.minutes]));
  const social = Object.fromEntries(data.tracks[1].subjects.map((s) => [s.id, s.minutes]));
  assert(science.mathematics === 150 && social["khmer-literature"] === 150 && social.mathematics === 90 && science.physics === 90 && science["foreign-language"] === 60, "lengths");
});

await check("a 150-minute paper counts down from 2:30:00 and finishes exactly on time", async () => {
  const timer = startTimer("science:mathematics", 150, "exam", T0);
  assert(formatClock(remainingMs(timer, T0)) === "2:30:00", formatClock(remainingMs(timer, T0)));
  assert(formatClock(remainingMs(timer, T0 + 61 * MIN + 30_000)) === "1:28:30", "after 61.5 minutes");
  assert(!isFinished(timer, T0 + 150 * MIN - 1) && isFinished(timer, T0 + 150 * MIN) && remainingMs(timer, T0 + 200 * MIN) === 0, "end");
  assert(elapsedMs(timer, T0 + 200 * MIN) === 150 * MIN, "time used went past the paper's length");
  assert(formatClock(59 * MIN + 59_000) === "59:59" && formatClock(500) === "00:01", "format");
});

await check("exam mode never pauses; practice mode pauses and resumes without losing or gaining time", async () => {
  const exam = startTimer("science:physics", 90, "exam", T0);
  assert(pauseTimer(exam, T0 + 10 * MIN) === exam, "an exam timer paused");
  let practice = startTimer("science:physics", 90, "practice", T0);
  practice = pauseTimer(practice, T0 + 10 * MIN);
  assert(remainingMs(practice, T0 + 40 * MIN) === 80 * MIN, "time ran while paused");
  practice = resumeTimer(practice, T0 + 40 * MIN);
  assert(remainingMs(practice, T0 + 50 * MIN) === 70 * MIN && elapsedMs(practice, T0 + 50 * MIN) === 20 * MIN, "after resuming");
  assert(pauseTimer(practice, T0 + 500 * MIN) === practice, "paused a finished timer");
});

await check("warnings: only those shorter than the paper; each fires once, even after a long sleep", async () => {
  assert(warningsFor(150, data.warningsMinutes).join() === "30,15,5" && warningsFor(20, data.warningsMinutes).join() === "15,5", "which warnings");
  assert(crossedWarnings(31 * MIN, 29 * MIN, [30, 15, 5]).join() === "30", "30 minutes");
  assert(crossedWarnings(29 * MIN, 28 * MIN, [30, 15, 5]).length === 0, "fired twice");
  assert(crossedWarnings(40 * MIN, 4 * MIN, [30, 15, 5]).join() === "30,15,5", "after a sleep, all at once");
});

await check("a saved timer is read back, and anything odd is ignored", async () => {
  const timer = startTimer("social:khmer-literature", 150, "exam", T0);
  assert(JSON.stringify(readTimer(JSON.stringify(timer))) === JSON.stringify(timer), "round trip");
  for (const bad of [null, "", "{", "[]", JSON.stringify({ ...timer, minutes: -1 }), JSON.stringify({ ...timer, mode: "x" }), JSON.stringify({ ...timer, startedAt: "now" })]) assert(readTimer(bad) === null, `accepted ${bad}`);
});

finish();
