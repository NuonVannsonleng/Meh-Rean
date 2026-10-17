// The study companion without AI (Learning OS 8.1): a progress summary, why
// the Study next suggestions were picked, and a session plan that fits the
// student's time — all from their own data, so it works offline, in the
// browser-only store, and whenever the AI is unavailable or used up.

import type { RecommendationWithAction } from "./recommend.ts";

export interface CompanionRules {
  version: number;
  defaultMinutes: number;
  minStep: number;
  reviewMinutesEach: number;
  reviewShareMax: number;
  maxTopics: number;
  videoMinutes: number;
  noteMinutes: number;
  breakFrom: number;
  breakMinutes: number;
}

export type PlanActivity = "review" | "practise" | "watch" | "read" | "break";

export interface PlanStep {
  minutes: number;
  activity: PlanActivity;
  topicId: string | null;
}

const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

/**
 * A session of `minutes`: due reviews first (a few minutes each, at most a
 * share of the time), then the top Study next topics with what each offers,
 * a short break in longer sessions. Steps are whole multiples of `minStep`
 * and add up to the session length exactly.
 */
export function planSession(input: { minutes: number | null; reviewsDue: number; recommendations: RecommendationWithAction[] }, rules: CompanionRules): PlanStep[] {
  const total = roundTo(input.minutes && input.minutes > 0 ? input.minutes : rules.defaultMinutes, rules.minStep);
  const steps: PlanStep[] = [];
  let left = total;
  if (input.reviewsDue > 0) {
    const review = Math.min(roundTo(input.reviewsDue * rules.reviewMinutesEach, rules.minStep), Math.max(rules.minStep, Math.floor((total * rules.reviewShareMax) / rules.minStep) * rules.minStep));
    steps.push({ minutes: review, activity: "review", topicId: null });
    left -= review;
  }
  const withBreak = total >= rules.breakFrom;
  if (withBreak) left -= rules.breakMinutes;
  // Topics whose main action is the notebook are covered by the review step.
  const topics = input.recommendations.filter((item) => item.action.type !== "review").slice(0, rules.maxTopics);
  const fixed = (item: RecommendationWithAction) => (item.action.type === "video" ? rules.videoMinutes : item.action.type === "note" ? rules.noteMinutes : null);
  const practising = topics.filter((item) => fixed(item) === null);
  const planned: PlanStep[] = [];
  for (const item of topics) {
    const minutes = fixed(item);
    if (minutes !== null && left - minutes >= (practising.length ? rules.minStep * practising.length : 0)) {
      planned.push({ minutes, activity: item.action.type === "video" ? "watch" : "read", topicId: item.topicId });
      left -= minutes;
    }
  }
  // Practice shares what is left, in whole steps; the first topics get any remainder.
  const units = Math.floor(left / rules.minStep);
  practising.forEach((item, index) => {
    const share = Math.floor(units / practising.length) + (index < units % practising.length ? 1 : 0);
    if (share > 0) planned.push({ minutes: share * rules.minStep, activity: "practise", topicId: item.topicId });
  });
  left -= planned.filter((step) => step.activity === "practise").reduce((sum, step) => sum + step.minutes, 0);
  // Order: by Study next rank, as they came.
  const rank = new Map(topics.map((item, index) => [item.topicId, index]));
  planned.sort((a, b) => rank.get(a.topicId!)! - rank.get(b.topicId!)!);
  steps.push(...planned);
  // Nothing to practise: the time goes to reviews, or to free practice.
  if (left > 0) {
    const review = steps.find((step) => step.activity === "review");
    if (review && !practising.length) review.minutes += left;
    else steps.push({ minutes: left, activity: "practise", topicId: null });
    left = 0;
  }
  if (withBreak) {
    const middle = Math.max(1, Math.ceil(steps.length / 2));
    steps.splice(middle, 0, { minutes: rules.breakMinutes, activity: "break", topicId: null });
  }
  return steps;
}

export interface ProgressFacts {
  total: number;
  practised: number;
  done: number;
  reviewsDue: number;
  answers7: number;
  correct7: number;
  activeDays7: number;
  examDays: number | null;
  /** Weakest labelled topics first. */
  workOn: string[];
  /** Strongest first. */
  goingWell: string[];
}

/** The facts a summary is written from: the same for the words below and for the AI (8.2). */
export function progressFacts(input: {
  topicIds: string[];
  mastery: { topicId: string; label: string; score: number | null; evidence: number }[];
  reviewsDue: number;
  activity: { answers: number; correct: number; activeDays: number };
  examDate: string | null;
  now?: Date;
}): ProgressFacts {
  const known = new Set(input.topicIds);
  const mastery = input.mastery.filter((item) => known.has(item.topicId));
  const labelled = mastery.filter((item) => item.label !== "unknown" && item.score !== null);
  const now = (input.now ?? new Date()).getTime();
  const examDays = input.examDate ? Math.ceil((Date.parse(`${input.examDate}T00:00:00+07:00`) - now) / 86_400_000) : null;
  return {
    total: input.topicIds.length,
    practised: mastery.filter((item) => item.evidence > 0).length,
    done: mastery.filter((item) => item.label === "strong" || item.label === "consistently-strong").length,
    reviewsDue: input.reviewsDue,
    answers7: input.activity.answers,
    correct7: input.activity.correct,
    activeDays7: input.activity.activeDays,
    examDays: examDays !== null && examDays >= 0 ? examDays : null,
    workOn: labelled.filter((item) => item.label === "needs-foundation" || item.label === "developing").sort((a, b) => a.score! - b.score!).slice(0, 3).map((item) => item.topicId),
    goingWell: labelled.filter((item) => item.label === "strong" || item.label === "consistently-strong").sort((a, b) => b.score! - a.score!).slice(0, 3).map((item) => item.topicId),
  };
}
