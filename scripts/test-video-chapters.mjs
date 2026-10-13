#!/usr/bin/env node
/**
 * Unit checks for parseVideoChapters in api/bacii-videos.ts (roadmap 4.4):
 * chapter times that creators write in their own video descriptions.
 *
 *   npm run test:video-chapters
 */

import { parseVideoChapters } from "../api/bacii-videos.ts";

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, actual, expected) {
  results.push(same(actual, expected) ? ["✓", name] : ["✗", name, `got ${JSON.stringify(actual)}`]);
}
const times = (text) => parseVideoChapters(text).map((chapter) => [chapter.seconds, chapter.title]);

check(
  "the usual list: time then title",
  times("Lesson on integrals\n0:00 Intro\n2:15 លំហាត់ទី២ - Exercise 2\n10:40 Practice\nSubscribe!"),
  [[0, "Intro"], [135, "លំហាត់ទី២ - Exercise 2"], [640, "Practice"]],
);
check("hours, brackets and separators", times("(0:00) Start\n[1:02:03] - Part 3\n12:30 | Part 2"), [[0, "Start"], [750, "Part 2"], [3723, "Part 3"]]);
check("title then time", times("Intro 0:00\nExercise 1 — 4:05"), [[0, "Intro"], [245, "Exercise 1"]]);
check("a single time is not a chapter list", times("Watch from 3:20 for the answer"), []);
check("no times at all", times("A lesson about limits.\nThanks for watching."), []);
check("impossible times are skipped", times("0:00 Start\n1:75 Broken\n2:00 Next"), [[0, "Start"], [120, "Next"]]);
check("duplicates keep the first title", times("0:00 Start\n0:00 Again\n5:00 End"), [[0, "Start"], [300, "End"]]);
check("titles are trimmed and shortened", parseVideoChapters(`0:00 ${"x".repeat(150)}\n1:00 Next`)[0].title.length, 100);

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => r[0] === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
