import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import FlashcardReview from "../../components/FlashcardReview";
import { ArrowLeftIcon, PenIcon, TrashIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import MathText from "../../components/MathText";
import TopicPicker from "../../components/TopicPicker";
import { useCurriculum } from "../../hooks/useCurriculum";
import { t } from "../../i18n/en";
import { isFlashcardDue } from "../../lib/flashcards";
import { formatDate } from "../../lib/format";
import { deleteFlashcard, getFlashcards, saveFlashcard } from "../../services/api";
import type { Flashcard } from "../../types";

const copy = t.learning.flashcards;

/** Flashcards (Learning OS 7.4): make, edit and review your own cards. */
export default function FlashcardsPage() {
  const [params] = useSearchParams();
  const { chapters } = useCurriculum();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topicId, setTopicId] = useState(params.get("topic") ?? "");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  // Due cards when the page opened, so the review list does not shrink while answering.
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    getFlashcards()
      .then((list) => {
        setCards(list);
        setReviewIds(list.filter((card) => isFlashcardDue(card, new Date())).map((card) => card.id));
      })
      .catch(() => setFailed(true));
  }, []);

  const topicName = useMemo(() => new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => [topic.id, `${chapter.number}. ${topic.nameEn}`] as const))), [chapters]);

  const reset = () => {
    setEditing(null);
    setFront("");
    setBack("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!front.trim() || !back.trim()) return setStatus({ kind: "error", text: copy.needBoth });
    try {
      const card = await saveFlashcard({ front, back, topicId: topicId || null }, editing ?? undefined);
      setCards((list) => (editing ? (list ?? []).map((item) => (item.id === card.id ? card : item)) : [card, ...(list ?? [])]));
      // A new card is due straight away: it joins this page's review.
      if (!editing) setReviewIds((ids) => [...(ids ?? []), card.id]);
      setStatus({ kind: "ok", text: copy.saved });
      reset();
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };
  const startEdit = (card: Flashcard) => {
    setEditing(card.id);
    setFront(card.front);
    setBack(card.back);
    setTopicId(card.topicId ?? "");
    setStatus(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (card: Flashcard) => {
    if (!window.confirm(copy.removeConfirm)) return;
    try {
      await deleteFlashcard(card.id);
      setCards((list) => (list ?? []).filter((item) => item.id !== card.id));
      setReviewIds((ids) => (ids ?? []).filter((id) => id !== card.id));
      if (editing === card.id) reset();
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  };

  if (failed) {
    return (
      <div className="container-page max-w-3xl py-8">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const review = (reviewIds ?? []).map((id) => cards?.find((card) => card.id === id)).filter((card): card is Flashcard => Boolean(card));
  const statusOf = (card: Flashcard) => (card.nextReviewAt === null ? copy.status.learned : isFlashcardDue(card, new Date()) ? copy.status.due : copy.status.next(formatDate(card.nextReviewAt)));

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/learning" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.learning.home.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">
        {copy.title} <span className="text-ink-500 text-base font-normal" lang="km">{`· ${copy.titleKm}`}</span>
      </h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.intro}</p>

      <form onSubmit={save} className="card mb-5 space-y-3 p-4 sm:p-5" aria-labelledby="flashcard-form">
        <h2 id="flashcard-form" className="font-display text-ink-900 text-lg font-bold">
          {editing ? copy.editTitle : copy.newTitle}
        </h2>
        <label className="text-ink-700 block text-sm font-medium">
          {copy.front}
          <textarea value={front} onChange={(event) => setFront(event.target.value)} maxLength={500} rows={2} className="input mt-1 min-h-16" />
        </label>
        <label className="text-ink-700 block text-sm font-medium">
          {copy.back}
          <textarea value={back} onChange={(event) => setBack(event.target.value)} maxLength={2000} rows={3} className="input mt-1 min-h-20" />
        </label>
        <p className="text-ink-500 text-xs">{copy.mathHint}</p>
        {(front.includes("$") || back.includes("$")) && (
          <div className="bg-surface-muted rounded-md p-3 text-sm" aria-label={copy.preview}>
            <MathText text={front} className="text-ink-900 font-medium" />
            <MathText text={back} className="text-ink-700 mt-1" />
          </div>
        )}
        <div className="flex gap-2">
          <TopicPicker chapters={chapters} value={topicId} onChange={setTopicId} label={copy.topic} />
        </div>
        {status && (
          <p role={status.kind === "error" ? "alert" : "status"} className={`text-sm font-medium ${status.kind === "error" ? "text-danger-fg" : "text-accent"}`}>
            {status.text}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">
            {editing ? copy.saveChanges : copy.save}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="btn-ghost">
              {copy.cancel}
            </button>
          )}
        </div>
      </form>

      <section className="mb-5" aria-labelledby="flashcard-review">
        <h2 id="flashcard-review" className="font-display text-ink-900 mb-2 text-lg font-bold">
          {review.length ? copy.reviewTitle(review.length) : copy.reviewNone}
        </h2>
        <div className="space-y-3">
          {review.map((card) => (
            <FlashcardReview
              key={card.id}
              card={card}
              topicName={card.topicId ? topicName.get(card.topicId) : undefined}
              onReviewed={(next, remembered) =>
                setCards((list) => (list ?? []).map((item) => (item.id === card.id ? { ...item, nextReviewAt: next, reviewStage: remembered ? item.reviewStage + 1 : 0 } : item)))
              }
            />
          ))}
        </div>
        {review.length > 0 && <p className="text-ink-500 mt-2 text-xs">{copy.selfReported}</p>}
      </section>

      <section aria-labelledby="flashcard-list">
        <h2 id="flashcard-list" className="font-display text-ink-900 mb-2 text-lg font-bold">
          {copy.listTitle(cards?.length ?? 0)}
        </h2>
        {!cards ? (
          <LoadingState count={2} variant="block" />
        ) : cards.length === 0 ? (
          <p className="card text-ink-700 p-4 text-sm">{copy.none}</p>
        ) : (
          <ul className="card divide-line divide-y">
            {cards.map((card) => (
              <li key={card.id} className="flex items-start gap-2 px-4 py-3" data-card={card.id}>
                <div className="min-w-0 flex-1">
                  <MathText text={card.front} className="text-ink-900 text-sm font-medium" />
                  <p className="text-ink-500 mt-0.5 text-xs">
                    {card.topicId && topicName.get(card.topicId) ? `${topicName.get(card.topicId)} · ` : ""}
                    {statusOf(card)}
                  </p>
                </div>
                <button type="button" onClick={() => startEdit(card)} aria-label={`${copy.edit}: ${card.front}`} className="text-ink-500 hover:text-ink-900 flex h-8 w-8 shrink-0 items-center justify-center">
                  <PenIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void remove(card)} aria-label={copy.removeLabel(card.front)} className="text-ink-500 hover:text-danger-fg flex h-8 w-8 shrink-0 items-center justify-center">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
