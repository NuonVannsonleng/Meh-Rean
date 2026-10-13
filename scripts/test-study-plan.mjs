#!/usr/bin/env node
/**
 * Unit checks for src/lib/studyPlan.ts with src/data/study-plan.json
 * (roadmap task 3.4).
 *
 *   npm run test:study-plan
 */

import { readFileSync } from "node:fs";
import { buildStudyPlan, mondayOf, weekHours } from "../src/lib/studyPlan.ts";

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, actual, expected) {
  results.push(same(actual, expected) ? ["✓", name] : ["✗", name, `got ${JSON.stringify(actual)}`]);
}

const rules = JSON.parse(readFileSync(new URL("../src/data/study-plan.json", import.meta.url), "utf8"));
const chapterIds = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"];
const base = { today: "2026-10-14", examDate: "2026-12-21", hoursPerDay: 2, daysPerWeek: 6, targetGrade: "B", chapterIds, weakChapterIds: ["c7", "c3"] };
const plan = buildStudyPlan(base, rules);
const items = plan.weeks.flatMap((week) => week.items);
const hoursFor = (p, id, kind = "chapter") => p.weeks.flatMap((w) => w.items).filter((i) => i.kind === kind && i.chapterId === id).reduce((s, i) => s + i.hours, 0);

check("weeks start on Mondays (Wednesday 14 Oct → Monday 12 Oct)", [mondayOf("2026-10-14"), mondayOf("2026-10-12"), mondayOf("2026-10-18")], ["2026-10-12", "2026-10-12", "2026-10-12"]);
check("one week for each week up to the exam's", [plan.weeks.length, plan.weeks[0].start, plan.weeks.at(-1).start], [11, "2026-10-12", "2026-12-21"]);
check("study days: 5 left in the first week (Wed–Sun), 6 in full weeks, none on exam Monday", [plan.weeks[0].studyDays, plan.weeks[1].studyDays, plan.weeks.at(-1).studyDays], [5, 6, 0]);
check("no week asks for more than the hours given", plan.weeks.every((week) => weekHours(week) <= week.studyDays * base.hoursPerDay + 1e-9), true);
check("every week with study days uses its time", plan.weeks.filter((w) => w.studyDays).every((week) => Math.abs(weekHours(week) - week.studyDays * base.hoursPerDay) < 0.5), true);
check("every chapter is planned", chapterIds.every((id) => hoursFor(plan, id) > 0), true);
check("weak chapters get about twice the time (target B)", Math.round(hoursFor(plan, "c7") / hoursFor(plan, "c1")), 2);
check("weak chapters come first, in curriculum order", items.filter((i) => i.kind === "chapter").map((i) => i.chapterId).filter((id, n, all) => all.indexOf(id) === n).slice(0, 3), ["c3", "c7", "c1"]);
check("a daily mistake-notebook review every week", plan.weeks.filter((w) => w.studyDays).every((w) => w.items.some((i) => i.kind === "review")), true);
check("a mock exam every 4th learning week", [3, 7].map((n) => plan.weeks[n].items.some((i) => i.kind === "mock-exam")), [true, true]);
const revision = plan.weeks.slice(-3, -1);
check("the last two study weeks revise: two mock exams each, weak chapters, no new chapters", revision.map((w) => [w.items.filter((i) => i.kind === "mock-exam").length, w.items.some((i) => i.kind === "chapter"), w.items.some((i) => i.kind === "revise" && ["c3", "c7"].includes(i.chapterId))]), [[2, false, true], [2, false, true]]);
check("items start not done, with unique ids", [items.every((i) => !i.done), new Set(items.map((i) => i.id)).size === items.length], [true, true]);
check("hours come in half hours (reviews in quarters)", items.every((i) => Number.isInteger(i.hours * 4)), true);

const aimHigh = buildStudyPlan({ ...base, targetGrade: "A" }, rules);
const aimPass = buildStudyPlan({ ...base, targetGrade: "E" }, rules);
check("a higher target spreads more time over the other chapters", hoursFor(aimHigh, "c1") > hoursFor(aimPass, "c1"), true);

const close = buildStudyPlan({ ...base, examDate: "2026-10-19" }, rules);
check("exam next Monday: revision only, no new chapters", [close.weeks.length, close.weeks.flatMap((w) => w.items).some((i) => i.kind === "chapter"), close.weeks[0].items.some((i) => i.kind === "revise")], [2, false, true]);
check("little time: warned that chapters will be thin", buildStudyPlan({ ...base, hoursPerDay: 0.5, daysPerWeek: 2 }, rules).warnings.includes("thin"), true);
check("an exam date that has passed is refused", buildStudyPlan({ ...base, examDate: "2026-10-14" }, rules), { weeks: [], warnings: ["exam-passed"] });
check("more than a year away is refused", buildStudyPlan({ ...base, examDate: "2028-01-10" }, rules).warnings, ["too-far"]);
check("no weak chapters: still a full plan", buildStudyPlan({ ...base, weakChapterIds: [] }, rules).weeks.flatMap((w) => w.items).some((i) => i.kind === "revise"), true);

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => r[0] === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
