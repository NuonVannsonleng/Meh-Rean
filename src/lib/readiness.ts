// Exam readiness and analytics (Learning OS 9.1): coverage, how estimates and
// mock exams are trending, how regularly the student practises, a readiness
// level, and the week compared with the one before. Worked out from the
// student's own data with the rules in src/data/learning/readiness-rules.json;
// each part says "not enough data" rather than guessing. Never a prediction of
// a BacII result.

import { masteryFromEvents, type MasteryRules, type TopicMastery } from "./mastery.ts";
import type { ExamAttempt, LearningEvent } from "../types.ts";

export interface ReadinessRules {
  version: number;
  minAnswers: number;
  minLabelledTopics: number;
  minExams: number;
  trendThreshold: number;
  trendDays: number[];
  weights: { coverage: number; mastery: number; exams: number };
  levels: { id: ReadinessLevel; from: number }[];
  consistencyDays: number;
  goodWeekDays: number;
}

export type ReadinessLevel = "not-enough-data" | "early" | "building" | "on-track" | "strong";
export type Trend = { state: "up" | "down" | "flat"; change: number } | { state: "not-enough-data" };

const DAY = 86_400_000;
const cambodiaDay = (time: number) => new Date(time + 7 * 3_600_000).toISOString().slice(0, 10);
const isAnswer = (event: LearningEvent) => (event.eventType === "question_attempted" || event.eventType === "mistake_reviewed") && typeof event.data.correct === "boolean";
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function trendOf(now: number | null, before: number | null, rules: ReadinessRules): Trend {
  if (now === null || before === null) return { state: "not-enough-data" };
  const change = Math.round(now - before);
  return { state: Math.abs(change) < rules.trendThreshold ? "flat" : change > 0 ? "up" : "down", change };
}

export interface Readiness {
  coverage: { total: number; practised: number; labelled: number; byChapter: { chapterId: string; total: number; practised: number }[] };
  /** Average estimate of labelled topics, now and some days ago, with the change. */
  mastery: { now: number | null; trends: { days: number; then: number | null; trend: Trend }[] };
  exams: { completed: { id: string; at: string; percent: number }[]; latest: number | null; trend: Trend };
  consistency: { days: number; activeDays: number; weeks: number; goodWeeks: number };
  readiness: { level: ReadinessLevel; score: number | null; parts: { coverage: number; mastery: number | null; exams: number | null } | null; answers: number };
  week: { answers: number; correct: number; activeDays: number; topics: number; reviews: number; exams: number; previous: { answers: number; correct: number; activeDays: number } };
}

/**
 * `mastery` (the stored estimates) may stand in for replaying the events when
 * only the current picture is needed, as on My learning: trends, the week and
 * consistency then say there is not enough data.
 */
export function buildReadiness(
  input: { topics: { id: string; chapterId: string }[]; events: LearningEvent[]; exams: ExamAttempt[]; mastery?: TopicMastery[]; now?: Date },
  rules: ReadinessRules,
  masteryRules: MasteryRules,
): Readiness {
  const now = (input.now ?? new Date()).getTime();
  const known = new Set(input.topics.map((topic) => topic.id));
  const answers = input.events.filter(isAnswer);
  const ownTopics = (events: LearningEvent[]) => events.filter((event) => !event.topicId || known.has(event.topicId));

  // Estimates as they stood at a moment: replay only the answers before it.
  const averageAt = (time: number) => {
    const labelled = masteryFromEvents(ownTopics(input.events.filter((event) => Date.parse(event.createdAt) <= time)), masteryRules, new Date(time)).filter((item) => known.has(item.topicId) && item.label !== "unknown" && item.score !== null);
    return labelled.length >= rules.minLabelledTopics ? average(labelled.map((item) => item.score!)) : null;
  };
  const current = (input.mastery ?? masteryFromEvents(ownTopics(input.events), masteryRules, new Date(now))).filter((item) => known.has(item.topicId));
  // Marked answers behind the estimates: counted from the events, or from the stored estimates' evidence.
  const answerCount = input.mastery && !input.events.length ? current.reduce((sum, item) => sum + item.evidence, 0) : answers.length;
  const labelled = current.filter((item) => item.label !== "unknown" && item.score !== null);
  const masteryNow = labelled.length >= rules.minLabelledTopics ? average(labelled.map((item) => item.score!)) : null;

  const practised = new Set(current.filter((item) => item.evidence > 0).map((item) => item.topicId));
  const chapters = [...new Set(input.topics.map((topic) => topic.chapterId))];
  const coverage = {
    total: input.topics.length,
    practised: practised.size,
    labelled: labelled.length,
    byChapter: chapters.map((chapterId) => {
      const ids = input.topics.filter((topic) => topic.chapterId === chapterId).map((topic) => topic.id);
      return { chapterId, total: ids.length, practised: ids.filter((id) => practised.has(id)).length };
    }),
  };

  const completed = input.exams
    .filter((exam) => exam.submittedAt && exam.score !== null && exam.maxScore)
    .sort((a, b) => a.submittedAt!.localeCompare(b.submittedAt!))
    .map((exam) => ({ id: exam.id, at: exam.submittedAt!, percent: Math.round((exam.score! / exam.maxScore!) * 100) }));
  // Latest exam against the average of the ones before it (up to three).
  const examTrend =
    completed.length >= rules.minExams ? trendOf(completed.at(-1)!.percent, average(completed.slice(-4, -1).map((exam) => exam.percent)), rules) : ({ state: "not-enough-data" } as Trend);

  const activeIn = (from: number, to: number) => new Set(answers.filter((event) => Date.parse(event.createdAt) > from && Date.parse(event.createdAt) <= to).map((event) => cambodiaDay(Date.parse(event.createdAt)))).size;
  const weeks = Math.floor(rules.consistencyDays / 7);
  const consistency = {
    days: rules.consistencyDays,
    activeDays: activeIn(now - rules.consistencyDays * DAY, now),
    weeks,
    goodWeeks: Array.from({ length: weeks }, (_, index) => activeIn(now - (index + 1) * 7 * DAY, now - index * 7 * DAY)).filter((days) => days >= rules.goodWeekDays).length,
  };

  // Readiness: only with enough answers; parts without data share their weight.
  let readiness: Readiness["readiness"] = { level: "not-enough-data", score: null, parts: null, answers: answerCount };
  if (answerCount >= rules.minAnswers && input.topics.length) {
    const parts = { coverage: (labelled.length / input.topics.length) * 100, mastery: masteryNow, exams: completed.length ? completed.at(-1)!.percent : null };
    const weighted = [
      [rules.weights.coverage, parts.coverage],
      [rules.weights.mastery, parts.mastery],
      [rules.weights.exams, parts.exams],
    ].filter((pair): pair is [number, number] => pair[1] !== null);
    const weight = weighted.reduce((sum, [w]) => sum + w, 0);
    const score = Math.round(weighted.reduce((sum, [w, value]) => sum + w * value, 0) / weight);
    const level = [...rules.levels].sort((a, b) => a.from - b.from).reduce<ReadinessLevel>((found, band) => (score >= band.from ? band.id : found), "early");
    readiness = { level, score, parts: { coverage: Math.round(parts.coverage), mastery: parts.mastery === null ? null : Math.round(parts.mastery), exams: parts.exams }, answers: answerCount };
  }

  const inWeek = (offset: number) => (event: LearningEvent) => Date.parse(event.createdAt) > now - (offset + 1) * 7 * DAY && Date.parse(event.createdAt) <= now - offset * 7 * DAY;
  const thisWeek = answers.filter(inWeek(0));
  const lastWeek = answers.filter(inWeek(1));
  const week = {
    answers: thisWeek.length,
    correct: thisWeek.filter((event) => event.data.correct === true).length,
    activeDays: activeIn(now - 7 * DAY, now),
    topics: new Set(thisWeek.map((event) => event.topicId).filter(Boolean)).size,
    reviews: thisWeek.filter((event) => event.eventType === "mistake_reviewed").length,
    exams: input.events.filter(inWeek(0)).filter((event) => event.eventType === "mock_exam_completed").length,
    previous: { answers: lastWeek.length, correct: lastWeek.filter((event) => event.data.correct === true).length, activeDays: activeIn(now - 14 * DAY, now - 7 * DAY) },
  };

  return {
    coverage,
    mastery: { now: masteryNow === null ? null : Math.round(masteryNow), trends: rules.trendDays.map((days) => { const then = averageAt(now - days * DAY); return { days, then: then === null ? null : Math.round(then), trend: trendOf(masteryNow, then, rules) }; }) },
    exams: { completed, latest: completed.at(-1)?.percent ?? null, trend: examTrend },
    consistency,
    readiness,
    week,
  };
}
