// Topic mastery estimates (Learning OS 3.1): a bounded, deterministic update
// per marked answer. The numbers live in src/data/learning/mastery-rules.json;
// supabase/schema.sql mirrors this so stored estimates match. An estimate,
// never a measure of ability: the UI says so.

import type { LearningEvent } from "../types.ts";

export interface MasteryRules {
  version: number;
  /** Where the score starts before the first answer (never shown: no answers is "unknown"). */
  prior: number;
  /** Smallest step towards 0 or 100, so recent answers keep counting. */
  stepMin: number;
  /** Largest step, so one answer cannot swing the score far. */
  stepMax: number;
  defaultDifficulty: number;
  /** How much a hard right answer (or an easy wrong one) moves the score more, per difficulty level from the middle. */
  difficultyWeight: number;
  /** Answers at which evidence alone gives confidence 0.5. */
  confidenceEvidence: number;
  /** Days without practice after which confidence halves. */
  confidenceHalfLifeDays: number;
  confidenceLevels: { medium: number; high: number };
  /** Answers before a topic gets a label: one or two answers say too little. */
  labelAfter: number;
  labels: { id: MasteryLabel; from: number; minEvidence?: number }[];
}

export type MasteryLabel = "unknown" | "needs-foundation" | "developing" | "practising" | "strong" | "consistently-strong";

/** One marked answer that counts as evidence. */
export interface MasteryAnswer {
  correct: boolean;
  /** 1 (easy) – 5 (hard); null when the question has none. */
  difficulty: number | null;
  at: string;
}

export interface MasteryState {
  /** 0–100, unrounded. */
  score: number;
  evidence: number;
  correct: number;
  lastAt: string | null;
}

export interface TopicMastery {
  topicId: string;
  /** 0–100, rounded; null while there is no evidence. */
  score: number | null;
  evidence: number;
  correct: number;
  lastAt: string | null;
  /** 0–1: grows with evidence, falls with time since the last answer. */
  confidence: number;
  confidenceLevel: "low" | "medium" | "high";
  label: MasteryLabel;
  version: number;
}

export const emptyMastery = (rules: MasteryRules): MasteryState => ({ score: rules.prior, evidence: 0, correct: 0, lastAt: null });

/** Labels worth practising before moving on: also what a missing prerequisite is. */
export const needsWork = (label: MasteryLabel) => label === "unknown" || label === "needs-foundation" || label === "developing";

/** The step size for the next answer: 1/(n+2) (a smoothed share right) within the bounds, then weighted by difficulty. */
export function masteryStep(state: MasteryState, answer: MasteryAnswer, rules: MasteryRules): number {
  const base = Math.max(rules.stepMin, 1 / (state.evidence + 2));
  const difficulty = Math.min(5, Math.max(1, answer.difficulty ?? rules.defaultDifficulty));
  const surprise = (answer.correct ? 1 : -1) * (difficulty - rules.defaultDifficulty);
  return Math.min(rules.stepMax, base * (1 + rules.difficultyWeight * surprise));
}

export function updateMastery(state: MasteryState, answer: MasteryAnswer, rules: MasteryRules): MasteryState {
  const target = answer.correct ? 100 : 0;
  const score = state.score + masteryStep(state, answer, rules) * (target - state.score);
  return {
    score: Math.min(100, Math.max(0, score)),
    evidence: state.evidence + 1,
    correct: state.correct + (answer.correct ? 1 : 0),
    lastAt: !state.lastAt || answer.at > state.lastAt ? answer.at : state.lastAt,
  };
}

export function masteryConfidence(state: Pick<MasteryState, "evidence" | "lastAt">, rules: MasteryRules, now = new Date()): number {
  if (!state.evidence || !state.lastAt) return 0;
  const fromEvidence = state.evidence / (state.evidence + rules.confidenceEvidence);
  const days = Math.max(0, (now.getTime() - Date.parse(state.lastAt)) / 86_400_000);
  return fromEvidence * 0.5 ** (days / rules.confidenceHalfLifeDays);
}

export function masteryLabel(score: number | null, evidence: number, rules: MasteryRules): MasteryLabel {
  if (score === null || evidence < Math.max(1, rules.labelAfter)) return "unknown";
  let label: MasteryLabel = "unknown";
  for (const band of [...rules.labels].sort((a, b) => a.from - b.from)) {
    if (score >= band.from && evidence >= (band.minEvidence ?? 0)) label = band.id;
  }
  return label;
}

export function describeMastery(topicId: string, state: MasteryState, rules: MasteryRules, now = new Date()): TopicMastery {
  const score = state.evidence ? Math.round(state.score) : null;
  const confidence = masteryConfidence(state, rules, now);
  return {
    topicId,
    score,
    evidence: state.evidence,
    correct: state.correct,
    lastAt: state.lastAt,
    confidence: Math.round(confidence * 100) / 100,
    confidenceLevel: confidence >= rules.confidenceLevels.high ? "high" : confidence >= rules.confidenceLevels.medium ? "medium" : "low",
    label: masteryLabel(score, state.evidence, rules),
    version: rules.version,
  };
}

const cambodiaDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * The evidence in a student's events, per topic and oldest first: marked
 * answers from practice, the daily question, mock exams and notebook reviews;
 * only the first attempt at a question per Cambodia day, so retrying until
 * right does not count. Videos, notes and self-reported marks are not evidence.
 * Duplicate events (same id) count once; input order does not matter.
 */
export function masteryEvidence(events: LearningEvent[]): Map<string, MasteryAnswer[]> {
  const unique = new Map(events.map((event) => [event.id, event]));
  const answers = [...unique.values()]
    .filter((event) => event.topicId && (event.eventType === "question_attempted" || event.eventType === "mistake_reviewed") && typeof event.data.correct === "boolean")
    // Ties (one exam marks many answers at once) go by id, numerically as the database does.
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id, "en", { numeric: true }));
  const seen = new Set<string>();
  const byTopic = new Map<string, MasteryAnswer[]>();
  for (const event of answers) {
    const key = `${event.resourceId}|${cambodiaDay(event.createdAt)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const difficulty = typeof event.data.difficulty === "number" ? event.data.difficulty : null;
    byTopic.set(event.topicId!, [...(byTopic.get(event.topicId!) ?? []), { correct: event.data.correct === true, difficulty, at: event.createdAt }]);
  }
  return byTopic;
}

/** The estimate after each answer on one topic, oldest first: what the student sees as "how it changed". */
export function masteryHistory(answers: MasteryAnswer[], rules: MasteryRules): { at: string; correct: boolean; score: number }[] {
  const steps: { at: string; correct: boolean; score: number }[] = [];
  answers.reduce((state, answer) => {
    const next = updateMastery(state, answer, rules);
    steps.push({ at: answer.at, correct: answer.correct, score: Math.round(next.score) });
    return next;
  }, emptyMastery(rules));
  return steps;
}

/** Every topic the student has evidence on, sorted by topic id. */
export function masteryFromEvents(events: LearningEvent[], rules: MasteryRules, now = new Date()): TopicMastery[] {
  return [...masteryEvidence(events)]
    .map(([topicId, answers]) => describeMastery(topicId, answers.reduce((state, answer) => updateMastery(state, answer, rules), emptyMastery(rules)), rules, now))
    .sort((a, b) => a.topicId.localeCompare(b.topicId));
}
