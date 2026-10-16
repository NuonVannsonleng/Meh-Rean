// Learning profile (Learning OS 1.4): what Meh Rean infers from a student's
// own answers, kept apart from what they chose. Estimates only: labelled as
// such, and shown only with enough evidence.

import type { ChapterProgress, LearningEvent } from "../types.ts";

export const PROFILE_RULES = {
  /** Answers in a chapter before saying anything about it. */
  minAnswers: 3,
  /** Smoothed share right, (right + 1) / (answered + 2), at or above which a chapter is a strength. */
  strengthAt: 0.75,
  /** …at or below which it is something to work on. */
  workOnAt: 0.5,
} as const;

export interface ChapterIndicator {
  chapterId: string;
  answered: number;
  correct: number;
  /** Smoothed share right, 0–1. */
  rate: number;
}

/** Strengths and chapters to work on, strongest / weakest first; chapters with too little evidence are left out. */
export function chapterIndicators(progress: ChapterProgress[], rules = PROFILE_RULES): { strengths: ChapterIndicator[]; workOn: ChapterIndicator[] } {
  const known = progress
    .filter((item) => item.answered >= rules.minAnswers)
    .map((item) => ({ chapterId: item.chapterId, answered: item.answered, correct: item.correct, rate: (item.correct + 1) / (item.answered + 2) }));
  return {
    strengths: known.filter((item) => item.rate >= rules.strengthAt).sort((a, b) => b.rate - a.rate || b.answered - a.answered),
    workOn: known.filter((item) => item.rate <= rules.workOnAt).sort((a, b) => a.rate - b.rate || b.answered - a.answered),
  };
}

export interface ActivitySummary {
  /** Marked answers (practice, reviews, exams) in the last 7 days. */
  answers: number;
  correct: number;
  reviews: number;
  examsCompleted: number;
  /** Days in the last 7 with at least one answer (UTC days). */
  activeDays: number;
  lastActiveAt: string | null;
}

/** The last 7 days of a student's own recorded activity. Self-reported events are not counted as answers. */
export function activitySummary(events: LearningEvent[], now = new Date()): ActivitySummary {
  const since = now.getTime() - 7 * 86_400_000;
  const recent = events.filter((event) => Date.parse(event.createdAt) >= since);
  const answers = recent.filter((event) => event.eventType === "question_attempted" || event.eventType === "mistake_reviewed");
  const latest = events.reduce<string | null>((max, event) => (!max || event.createdAt > max ? event.createdAt : max), null);
  return {
    answers: answers.length,
    correct: answers.filter((event) => event.data.correct === true).length,
    reviews: recent.filter((event) => event.eventType === "mistake_reviewed").length,
    examsCompleted: recent.filter((event) => event.eventType === "mock_exam_completed").length,
    activeDays: new Set(answers.map((event) => event.createdAt.slice(0, 10))).size,
    lastActiveAt: latest,
  };
}
