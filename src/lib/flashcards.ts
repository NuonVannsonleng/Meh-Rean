// Flashcard reviews (Learning OS 7.4). The same rules run in the database
// (review_flashcard in supabase/schema.sql); scripts/test-flashcards.mjs keeps
// the two in step.

/** Days before the next review after the 1st, 2nd, 3rd and 4th remembered review; the 5th makes it learned. */
export const FLASHCARD_INTERVAL_DAYS = [1, 3, 7, 14] as const;
export const FLASHCARD_LEARNED = 5;
export const MAX_FLASHCARDS = 500;

const DAY = 86_400_000;

export interface FlashcardSchedule {
  reviewStage: number;
  nextReviewAt: string | null;
  timesForgotten: number;
}

export const isFlashcardDue = (card: Pick<FlashcardSchedule, "nextReviewAt">, now: Date) => card.nextReviewAt !== null && Date.parse(card.nextReviewAt) <= now.getTime();

/** Remembered when due: a stage on; remembered early: unchanged; forgot: back to the start, due tomorrow. */
export function afterFlashcardReview(card: FlashcardSchedule, remembered: boolean, now: Date): FlashcardSchedule {
  if (!remembered) return { reviewStage: 0, nextReviewAt: new Date(now.getTime() + FLASHCARD_INTERVAL_DAYS[0] * DAY).toISOString(), timesForgotten: card.timesForgotten + 1 };
  if (!isFlashcardDue(card, now)) return card;
  const reviewStage = card.reviewStage + 1;
  return { reviewStage, nextReviewAt: reviewStage >= FLASHCARD_LEARNED ? null : new Date(now.getTime() + FLASHCARD_INTERVAL_DAYS[reviewStage - 1] * DAY).toISOString(), timesForgotten: card.timesForgotten };
}
