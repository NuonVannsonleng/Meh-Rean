// Study plan generator (roadmap 3.4). A plan is the student's own notes, so
// it is built here in the browser from their settings and results; the
// rules of thumb are data (src/data/study-plan.json), and the student can
// edit everything afterwards.

import { addDays } from "./daily.ts";

export interface PlanRules {
  reviewMinutesPerStudyDay: number;
  mockExamHours: number;
  mockExamEveryLearningWeeks: number;
  revisionWeeks: { fromWeeks: number; weeks: number }[];
  mockExamsPerRevisionWeek: number;
  /** With this many study weeks or fewer left, every week is revision. */
  allRevisionUpToWeeks: number;
  weakChapterWeight: number;
  otherChapterWeightByTarget: Record<string, number>;
  thinHoursPerChapter: number;
  maxWeeks: number;
}

export type PlanItemKind = "chapter" | "revise" | "mock-exam" | "review";

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  chapterId: string | null;
  hours: number;
  done: boolean;
}

export interface PlanWeek {
  /** Monday of the week, "YYYY-MM-DD". */
  start: string;
  /** Days the student said they study this week (fewer in the first and last weeks). */
  studyDays: number;
  items: PlanItem[];
}

export interface PlanSettings {
  /** "YYYY-MM-DD", entered by the student. */
  examDate: string;
  /** Today in Cambodia, "YYYY-MM-DD". */
  today: string;
  hoursPerDay: number;
  daysPerWeek: number;
  targetGrade: string;
  /** All chapters of the subject, in curriculum order. */
  chapterIds: string[];
  weakChapterIds: string[];
}

export type PlanWarning = "exam-passed" | "too-far" | "thin" | "no-time";

export const PLAN_LIMITS = { minHoursPerDay: 0.5, maxHoursPerDay: 12, minDays: 1, maxDays: 7 } as const;

const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
/** Rounds to the nearest half hour (quarter for short reviews). */
const half = (hours: number) => Math.round(hours * 2) / 2;
const quarter = (hours: number) => Math.round(hours * 4) / 4;

/** Monday of the week the day falls in. */
export function mondayOf(day: string): string {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

export function weekHours(week: PlanWeek): number {
  return week.items.reduce((sum, item) => sum + item.hours, 0);
}

/** Problems with the settings, in the order a form shows them; empty when a plan can be built. */
export function checkPlanSettings(settings: PlanSettings, rules: PlanRules): PlanWarning[] {
  const problems: PlanWarning[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settings.examDate) || settings.examDate <= settings.today) problems.push("exam-passed");
  else if ((dayNumber(mondayOf(settings.examDate)) - dayNumber(mondayOf(settings.today))) / 7 + 1 > rules.maxWeeks) problems.push("too-far");
  return problems;
}

/** Builds the weekly plan. Warnings explain plans that will be tight. */
export function buildStudyPlan(settings: PlanSettings, rules: PlanRules): { weeks: PlanWeek[]; warnings: PlanWarning[] } {
  const problems = checkPlanSettings(settings, rules);
  if (problems.length) return { weeks: [], warnings: problems };

  const hoursPerDay = Math.min(PLAN_LIMITS.maxHoursPerDay, Math.max(PLAN_LIMITS.minHoursPerDay, settings.hoursPerDay));
  const daysPerWeek = Math.min(PLAN_LIMITS.maxDays, Math.max(PLAN_LIMITS.minDays, Math.round(settings.daysPerWeek)));
  const firstMonday = mondayOf(settings.today);
  const count = (dayNumber(mondayOf(settings.examDate)) - dayNumber(firstMonday)) / 7 + 1;
  const lastStudyDay = addDays(settings.examDate, -1);

  const weeks: PlanWeek[] = Array.from({ length: count }, (_, index) => {
    const start = addDays(firstMonday, index * 7);
    const from = Math.max(dayNumber(start), dayNumber(settings.today));
    const to = Math.min(dayNumber(addDays(start, 6)), dayNumber(lastStudyDay));
    return { start, studyDays: Math.max(0, Math.min(daysPerWeek, to - from + 1)), items: [] };
  });

  let nextId = 0;
  const add = (week: PlanWeek, kind: PlanItemKind, chapterId: string | null, hours: number) => {
    if (hours <= 0) return;
    week.items.push({ id: `p${(nextId += 1)}`, kind, chapterId, hours, done: false });
  };

  // Revision weeks are counted over weeks with study days (the exam's own week may have none).
  const studyWeeks = weeks.map((week, index) => (week.studyDays ? index : -1)).filter((index) => index >= 0);
  const revisionCount =
    studyWeeks.length <= rules.allRevisionUpToWeeks
      ? studyWeeks.length
      : Math.min(studyWeeks.length, rules.revisionWeeks.filter((rule) => studyWeeks.length >= rule.fromWeeks).reduce((most, rule) => Math.max(most, rule.weeks), 0));
  const firstRevision = revisionCount ? studyWeeks[studyWeeks.length - revisionCount] : count;
  const free = new Map<PlanWeek, number>();

  weeks.forEach((week, index) => {
    if (!week.studyDays) return;
    const total = half(week.studyDays * hoursPerDay);
    const review = Math.min(total, quarter((week.studyDays * rules.reviewMinutesPerStudyDay) / 60));
    add(week, "review", null, review);
    let left = total - review;
    const mocks =
      index >= firstRevision
        ? rules.mockExamsPerRevisionWeek
        : (index + 1) % rules.mockExamEveryLearningWeeks === 0
          ? 1
          : 0;
    for (let mock = 0; mock < mocks && left >= rules.mockExamHours + 0.5; mock += 1) {
      add(week, "mock-exam", null, rules.mockExamHours);
      left -= rules.mockExamHours;
    }
    free.set(week, left);
  });

  const weak = settings.chapterIds.filter((id) => settings.weakChapterIds.includes(id));
  const order = [...weak, ...settings.chapterIds.filter((id) => !weak.includes(id))];
  const otherWeight = rules.otherChapterWeightByTarget[settings.targetGrade] ?? 1;
  const weightOf = (id: string) => (weak.includes(id) ? rules.weakChapterWeight : otherWeight);

  // Learning weeks: every chapter, weak ones first and longer.
  const learning = weeks.slice(0, firstRevision).filter((week) => (free.get(week) ?? 0) > 0);
  const learningHours = learning.reduce((sum, week) => sum + (free.get(week) ?? 0), 0);
  const totalWeight = order.reduce((sum, id) => sum + weightOf(id), 0);
  const warnings: PlanWarning[] = [];
  if (learning.length && order.length) {
    const queue = order.map((id) => ({ id, hours: Math.max(0.5, half((learningHours * weightOf(id)) / totalWeight)) }));
    if (learningHours / order.length < rules.thinHoursPerChapter) warnings.push("thin");
    for (const week of learning) {
      let room = free.get(week) ?? 0;
      while (room >= 0.5 && queue.length) {
        const next = queue[0];
        const take = Math.min(room, next.hours);
        add(week, "chapter", next.id, take);
        room -= take;
        next.hours -= take;
        if (next.hours < 0.5) queue.shift();
      }
      // Anything left over at the end goes to revising weak chapters.
      if (room >= 0.5) add(week, "revise", (weak[0] ?? order[0]) || null, room);
      free.set(week, 0);
    }
  }

  // Revision weeks (or everything, when the exam is close): weak chapters first.
  const revising = weak.length ? weak : order;
  let turn = 0;
  for (const week of weeks.slice(firstRevision)) {
    let room = free.get(week) ?? 0;
    const slots = Math.max(1, Math.min(revising.length, Math.floor(room / 1)));
    const each = half(room / slots);
    for (let slot = 0; slot < slots && room >= 0.5 && revising.length; slot += 1) {
      const hours = slot === slots - 1 ? room : Math.min(room, each);
      add(week, "revise", revising[turn % revising.length], hours);
      room -= hours;
      turn += 1;
    }
  }

  if (!weeks.some((week) => week.items.some((item) => item.kind === "chapter" || item.kind === "revise"))) warnings.push("no-time");
  return { weeks, warnings };
}
