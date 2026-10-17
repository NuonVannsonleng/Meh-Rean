// Adaptive practice (Learning OS 5.1): the next question for a session, from
// the student's target topics, a difficulty that moves one step with each
// answer, and no repeats. Numbers in src/data/learning/adaptive-rules.json.
// Only questions the server can mark (multiple choice, numbers) are used.

import type { LearningEvent, Question } from "../types.ts";
import { prerequisitesOf, type ConceptLinkInput } from "./conceptGraph.ts";
import { needsWork, type TopicMastery } from "./mastery.ts";

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
  modes: Record<PracticeMode, { count: number; difficultyOffset: number; spread: boolean }>;
}

export type PracticeMode = "recommended" | "weak" | "prerequisites" | "quick" | "mixed" | "exam";
export const PRACTICE_MODES: PracticeMode[] = ["recommended", "quick", "weak", "prerequisites", "mixed", "exam"];

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

export interface SessionPlan {
  mode: PracticeMode;
  /** Target topics, most important first. */
  topics: string[];
  count: number;
  difficultyOffset: number;
  /** Move to another topic after each question instead of staying on the first. */
  spread: boolean;
}

/**
 * Which topics a session works on (Learning OS 5.2). `recommended` is the
 * Study next order (src/lib/recommend.ts); every mode falls back on nothing
 * rather than inventing topics, and the page says so.
 */
export function sessionPlan(
  mode: PracticeMode,
  context: { topics: { id: string; chapterId: string }[]; links: ConceptLinkInput[]; mastery: TopicMastery[]; recommended: string[] },
  rules: AdaptiveRules,
): SessionPlan {
  const settings = rules.modes[mode];
  const masteryOf = new Map(context.mastery.map((item) => [item.topicId, item]));
  const labelOf = (id: string) => masteryOf.get(id)?.label ?? "unknown";
  const scoreOf = (id: string) => (labelOf(id) === "unknown" ? 50 : (masteryOf.get(id)?.score ?? 50));
  const order = new Map(context.topics.map((topic, index) => [topic.id, index]));
  const byWeakness = (ids: string[]) => [...ids].sort((a, b) => scoreOf(a) - scoreOf(b) || order.get(a)! - order.get(b)!);
  const weak = byWeakness(context.topics.map((topic) => topic.id).filter((id) => labelOf(id) === "needs-foundation" || labelOf(id) === "developing"));

  let topics: string[];
  switch (mode) {
    case "recommended":
    case "quick":
      topics = context.recommended.filter((id) => order.has(id));
      break;
    case "weak":
      topics = weak;
      break;
    case "prerequisites": {
      const seen = new Set<string>();
      topics = weak
        .flatMap((id) => prerequisitesOf(id, context.links))
        .sort((a, b) => a.distance - b.distance)
        .map((item) => item.topicId)
        .filter((id) => order.has(id) && needsWork(labelOf(id)) && !seen.has(id) && Boolean(seen.add(id)));
      break;
    }
    case "mixed": {
      // One topic from each chapter in turn, so the session moves around the course.
      const chapters = [...new Set(context.topics.map((topic) => topic.chapterId))].map((chapter) => context.topics.filter((topic) => topic.chapterId === chapter).map((topic) => topic.id));
      topics = [];
      for (let round = 0; chapters.some((list) => list.length > round); round++) for (const list of chapters) if (list[round]) topics.push(list[round]);
      break;
    }
    case "exam":
      topics = byWeakness(context.topics.map((topic) => topic.id));
      break;
  }
  return { mode, topics, count: settings.count, difficultyOffset: settings.difficultyOffset, spread: settings.spread };
}

/** The topic order for the next pick: with `spread`, topics asked less this session come first. */
export function topicsForTurn(plan: SessionPlan, askedTopics: string[]): string[] {
  if (!plan.spread) return plan.topics;
  const times = (id: string) => askedTopics.filter((topic) => topic === id).length;
  return plan.topics.map((id, index) => ({ id, index })).sort((a, b) => times(a.id) - times(b.id) || a.index - b.index).map((item) => item.id);
}
