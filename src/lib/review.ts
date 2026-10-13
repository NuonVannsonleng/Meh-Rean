// Spaced repetition for the mistake notebook (roadmap 3.2). The same rules
// run in the database (note_answer in supabase/schema.sql); keep the two in
// step — scripts/test-review.mjs checks the intervals match.

/** Days to wait before review 1, 2, 3 and 4. */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14] as const;
export const REVIEW_STAGES = REVIEW_INTERVAL_DAYS.length;

const DAY_MS = 86_400_000;

export interface ReviewState {
  reviewStage: number;
  nextReviewAt: string | null;
  fixedAt: string | null;
}

/** A wrong answer: back to the start, first review tomorrow. */
export function afterWrong(now: Date): ReviewState {
  return { reviewStage: 0, nextReviewAt: new Date(now.getTime() + REVIEW_INTERVAL_DAYS[0] * DAY_MS).toISOString(), fixedAt: null };
}

/**
 * A right answer: fixed; a due review is passed and the next one scheduled
 * further out, or none after the last. Early right answers do not move it on.
 */
export function afterRight(state: ReviewState, now: Date): ReviewState {
  const fixedAt = state.fixedAt ?? now.toISOString();
  if (!isDue(state, now)) return { ...state, fixedAt };
  const reviewStage = state.reviewStage + 1;
  const nextReviewAt = reviewStage >= REVIEW_STAGES ? null : new Date(now.getTime() + REVIEW_INTERVAL_DAYS[reviewStage] * DAY_MS).toISOString();
  return { reviewStage, nextReviewAt, fixedAt };
}

export function isDue(state: Pick<ReviewState, "nextReviewAt">, now: Date): boolean {
  return state.nextReviewAt !== null && Date.parse(state.nextReviewAt) <= now.getTime();
}

/** All reviews done. */
export function isLearned(state: Pick<ReviewState, "reviewStage">): boolean {
  return state.reviewStage >= REVIEW_STAGES;
}
