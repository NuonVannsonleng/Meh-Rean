#!/usr/bin/env node
/**
 * Unit checks for src/lib/daily.ts (roadmap task 3.3): Cambodia's day,
 * weakest chapter, streaks.
 *
 *   npm run test:daily-rules
 */

import { addDays, cambodiaDay, streakOf, weakestChapter } from "../src/lib/daily.ts";

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, actual, expected) {
  results.push(same(actual, expected) ? ["✓", name] : ["✗", name, `got ${JSON.stringify(actual)}`]);
}

check("the day changes at midnight in Phnom Penh (17:00 UTC)", [cambodiaDay(new Date("2026-10-13T16:59:59Z")), cambodiaDay(new Date("2026-10-13T17:00:00Z"))], ["2026-10-13", "2026-10-14"]);
check("adding days crosses months and years", [addDays("2026-12-31", 1), addDays("2026-03-01", -1)], ["2027-01-01", "2026-02-28"]);

const fixed = () => 0.5;
check("no results: any chapter, and it says so", weakestChapter(["a", "b"], [], fixed)?.fromResults, false);
check("a known weakness beats an untried chapter", weakestChapter(["a", "b", "c"], [{ chapterId: "b", answered: 3, correct: 0 }, { chapterId: "c", answered: 4, correct: 4 }], fixed), { chapterId: "b", fromResults: true });
check("one lucky answer is not mastery: 1/1 is still above an untried chapter", weakestChapter(["a", "b"], [{ chapterId: "a", answered: 1, correct: 1 }], fixed)?.chapterId, "b");
check("chapters without questions are never picked", weakestChapter(["a"], [{ chapterId: "z", answered: 9, correct: 0 }], fixed)?.chapterId, "a");
check("no chapters: nothing", weakestChapter([], [], fixed), null);

const today = "2026-10-13";
check("nothing answered", streakOf([], today), { current: 0, best: 0, answeredToday: false });
check("today and the two days before", streakOf(["2026-10-11", "2026-10-12", "2026-10-13"], today), { current: 3, best: 3, answeredToday: true });
check("yesterday's run still counts before today's answer", streakOf(["2026-10-11", "2026-10-12"], today), { current: 2, best: 2, answeredToday: false });
check("a missed day starts again; the best is kept", streakOf(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-11"], today), { current: 0, best: 4, answeredToday: false });
check("duplicates and order do not matter", streakOf(["2026-10-13", "2026-10-12", "2026-10-13"], today), { current: 2, best: 2, answeredToday: true });

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => r[0] === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
