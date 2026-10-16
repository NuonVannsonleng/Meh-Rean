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

export interface TopicResult {
  topicId: string;
  answered: number;
  correct: number;
  lastAt: string | null;
}

export type TopicStatus = "unknown" | "work-on" | "practising" | "going-well";

/** A topic's status from the student's answers, with the same thresholds as chapters. */
export function topicStatus(result: Pick<TopicResult, "answered" | "correct"> | undefined, rules = PROFILE_RULES): TopicStatus {
  if (!result || result.answered < rules.minAnswers) return "unknown";
  const rate = (result.correct + 1) / (result.answered + 2);
  return rate >= rules.strengthAt ? "going-well" : rate <= rules.workOnAt ? "work-on" : "practising";
}

/**
 * Answers per topic from the student's events, counting only the first
 * attempt at each question per day (Cambodia time), so retrying a question
 * until it is right does not inflate the result. Same rule as
 * my_topic_results() in supabase/schema.sql.
 */
export function topicResultsFromEvents(events: LearningEvent[]): TopicResult[] {
  const firsts = new Map<string, LearningEvent>();
  const day = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);
  const answers = events
    .filter((event) => event.topicId && (event.eventType === "question_attempted" || event.eventType === "mistake_reviewed") && typeof event.data.correct === "boolean")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const event of answers) {
    const key = `${event.resourceId}|${day(event.createdAt)}`;
    if (!firsts.has(key)) firsts.set(key, event);
  }
  const byTopic = new Map<string, TopicResult>();
  for (const event of firsts.values()) {
    const result = byTopic.get(event.topicId!) ?? { topicId: event.topicId!, answered: 0, correct: 0, lastAt: null };
    result.answered += 1;
    if (event.data.correct === true) result.correct += 1;
    if (!result.lastAt || event.createdAt > result.lastAt) result.lastAt = event.createdAt;
    byTopic.set(event.topicId!, result);
  }
  return [...byTopic.values()].sort((a, b) => a.topicId.localeCompare(b.topicId));
}
