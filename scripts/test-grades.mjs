#!/usr/bin/env node
/**
 * Unit checks for src/lib/grades.ts and src/data/grade-scale.json
 * (roadmap task 2.5).
 *
 *   npm run test:grades
 */

import { readFileSync } from "node:fs";
import { checkGradeScale, estimateGrade, formatPercent } from "../src/lib/grades.ts";

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, actual, expected) {
  results.push(same(actual, expected) ? ["✓", name] : ["✗", name, `got ${JSON.stringify(actual)}`]);
}

const scale = JSON.parse(readFileSync(new URL("../src/data/grade-scale.json", import.meta.url), "utf8"));
const pick = (score, max) => {
  const estimate = estimateGrade(score, max, scale);
  return estimate && { grade: estimate.grade, next: estimate.next };
};

check("the shipped scale is valid", checkGradeScale(scale), []);
check("the shipped scale is not presented as official", scale.verification === "provisional" || Boolean(scale.source), true);
check("full marks: top grade, nothing above", pick(30, 30), { grade: "A", next: null });
check("exactly on a boundary counts (9/10 = 90%)", pick(9, 10), { grade: "A", next: null });
check("just under a boundary does not", pick(89.9, 100), { grade: "B", next: { grade: "A", pointsNeeded: 1 } });
check("20/30 is D, 1 point from C (21/30 = 70%)", pick(20, 30), { grade: "D", next: { grade: "C", pointsNeeded: 1 } });
check("10/30 is F, 5 points from E", pick(10, 30), { grade: "F", next: { grade: "E", pointsNeeded: 5 } });
check("zero is the lowest grade", pick(0, 30), { grade: "F", next: { grade: "E", pointsNeeded: 15 } });
check("nothing marked: no estimate", estimateGrade(0, 0, scale), null);
check("more than max is capped at 100%", estimateGrade(40, 30, scale).percent, 100);
check("percent never rounds up", [formatPercent((20 / 30) * 100), formatPercent(89.99), formatPercent(90), formatPercent(0)], ["66.6%", "89.9%", "90%", "0%"]);
check(
  "bad scales are refused",
  [
    checkGradeScale({ ...scale, bands: [{ grade: "A", minPercent: 50 }, { grade: "B", minPercent: 60 }, { grade: "F", minPercent: 0 }] }).length > 0,
    checkGradeScale({ ...scale, bands: [{ grade: "A", minPercent: 50 }, { grade: "F", minPercent: 10 }] }).length > 0,
    checkGradeScale({ ...scale, bands: [{ grade: "A", minPercent: 50 }, { grade: "A", minPercent: 0 }] }).length > 0,
    checkGradeScale({ ...scale, verification: "verified", source: null }).length > 0,
  ],
  [true, true, true, true],
);

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => r[0] === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
