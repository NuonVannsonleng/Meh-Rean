import { useState } from "react";
import { t } from "../i18n/en";
import { formatDate } from "../lib/format";
import { reviewFlashcard } from "../services/api";
import type { Flashcard } from "../types";
import MathText from "./MathText";

const copy = t.learning.flashcards;

/**
 * One flashcard to review (Learning OS 7.4): the front, the answer on
 * request, then "remembered" or "forgot". The backend moves the schedule.
 */
export default function FlashcardReview({ card, topicName, onReviewed }: { card: Flashcard; topicName?: string; onReviewed?: (next: string | null, remembered: boolean) => void }) {
  const [shown, setShown] = useState(false);
  const [result, setResult] = useState<{ remembered: boolean; next: string | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const answer = async (remembered: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      const next = await reviewFlashcard(card.id, remembered);
      setResult({ remembered, next });
      onReviewed?.(next, remembered);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4" data-flashcard={card.id}>
      {topicName && <p className="text-accent mb-1 text-xs font-semibold">{topicName}</p>}
      <MathText text={card.front} className="text-ink-900 text-base font-medium" />
      {shown ? (
        <div className="border-line mt-3 border-t pt-3">
          <MathText text={card.back} className="text-ink-900 text-sm" />
          {result ? (
            <p role="status" className="text-ink-700 mt-3 text-sm">
              {!result.remembered ? copy.againTomorrow : result.next ? copy.nextOn(formatDate(result.next)) : copy.learnedNow}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void answer(true)} className="btn-primary h-9 px-4 text-sm">
                {copy.remembered}
              </button>
              <button type="button" disabled={busy} onClick={() => void answer(false)} className="btn-secondary h-9 px-4 text-sm">
                {copy.forgot}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setShown(true)} className="btn-secondary mt-3 h-9 px-4 text-sm">
          {copy.showAnswer}
        </button>
      )}
      {problem && (
        <p role="alert" className="text-danger-fg mt-2 text-xs">
          {problem}
        </p>
      )}
    </div>
  );
}
