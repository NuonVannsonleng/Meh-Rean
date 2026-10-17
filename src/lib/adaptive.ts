// Adaptive practice (Learning OS 5.1): the next question for a session, from
// the student's target topics, a difficulty that moves one step with each
// answer, and no repeats. Numbers in src/data/learning/adaptive-rules.json.
// Only questions the server can mark (multiple choice, numbers) are used.

import type { LearningEvent, Question } from "../types.ts";
import type { TopicMastery } from "./mastery.ts";

export interface AdaptiveRules {
  version: number;
  /** Difficulty (1–5) for a topic without an estimate. */
  startDifficulty: number;
  /** Estimate points per difficulty step: 0–24 → 1, 25–49 → 2, … */
  scorePerDifficultyStep: number;
  stepAfterRight: number;
  stepAfterWrong: number;
  /** A question answered within this many days is used only when nothing else is left. */
  repeatAfterDays: number;
  weights: { topic: number; difficulty: number; freshness: number };
}

export type PoolQuestion = Pick<Question, "id" | "topicId" | "chapterId" | "difficulty" | "type">;

const DAY = 86_400_000;
const clamp = (value: number) => Math.min(5, Math.max(1, Math.round(value)));
export const markable = (question: Pick<Question, "type">) => question.type === "multiple-choice" || question.type === "numeric";

/** Where a topic's practice starts: the estimate mapped onto 1–5, a gentle 2 without one. */
export function startingDifficulty(mastery: TopicMastery | undefined, rules: AdaptiveRules, offset = 0): number {
  const base = mastery && mastery.label !== "unknown" && mastery.score !== null ? 1 + Math.floor(mastery.score / rules.scorePerDifficultyStep) : rules.startDifficulty;
  return clamp(base + offset);
}

/** One step harder after a right answer, one step easier after a wrong one. */
export function nextDifficulty(current: number, correct: boolean, rules: AdaptiveRules): number {
  return clamp(current + (correct ? rules.stepAfterRight : rules.stepAfterWrong));
}

/** When the student last answered each question (any source). */
export function lastAnswered(events: LearningEvent[]): Map<string, number> {
  const last = new Map<string, number>();
  for (const event of events) {
    if ((event.eventType !== "question_attempted" && event.eventType !== "mistake_reviewed") || !event.resourceId) continue;
    last.set(event.resourceId, Math.max(last.get(event.resourceId) ?? 0, Date.parse(event.createdAt)));
  }
  return last;
}

export interface PickInput {
  pool: PoolQuestion[];
  /** Topics in priority order; questions on earlier topics come first. */
  topics: string[];
  difficulty: number;
  /** Asked in this session: never again. */
  asked: Set<string>;
  lastAnswered: Map<string, number>;
  now?: Date;
}

/**
 * The best next question, or null when the targets have none left:
 * topic priority, closeness to the difficulty, and not answered lately.
 * Questions answered within `repeatAfterDays` come only when nothing else is left.
 */
export function pickNext(input: PickInput, rules: AdaptiveRules): PoolQuestion | null {
  const now = (input.now ?? new Date()).getTime();
  const rank = new Map(input.topics.map((topic, index) => [topic, index]));
  const candidates = input.pool.filter((question) => markable(question) && question.topicId && rank.has(question.topicId) && !input.asked.has(question.id));
  if (!candidates.length) return null;
  const recent = (question: PoolQuestion) => {
    const at = input.lastAnswered.get(question.id);
    return at !== undefined && now - at < rules.repeatAfterDays * DAY;
  };
  const fresh = candidates.filter((question) => !recent(question));
  const scored = (fresh.length ? fresh : candidates).map((question) => {
    const at = input.lastAnswered.get(question.id);
    const freshness = at === undefined ? 1 : Math.min(1, (now - at) / (30 * DAY));
    const difficulty = 1 - Math.abs((question.difficulty ?? rules.startDifficulty) - input.difficulty) / 4;
    const topic = 1 / (1 + rank.get(question.topicId!)!);
    return { question, score: rules.weights.topic * topic + rules.weights.difficulty * difficulty + rules.weights.freshness * freshness };
  });
  scored.sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id));
  return scored[0].question;
}
