import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import FlashcardReview from "../../components/FlashcardReview";
import PracticeQuestion from "../../components/PracticeQuestion";
import revisionRules from "../../data/learning/revision-rules.json";
import { useCurriculum } from "../../hooks/useCurriculum";
import { t } from "../../i18n/en";
import { formatDate } from "../../lib/format";
import { buildRevisionQueue, type RevisionItem, type RevisionReason, type RevisionRules } from "../../lib/revision";
import { getConceptLinks, getFlashcards, getLearningProfile, getMistakes, getTopicMastery, postponeReview } from "../../services/api";
import type { ConceptLink, Flashcard, Mistake } from "../../types";
import type { TopicMastery } from "../../lib/mastery";

const copy = t.learning.revision;
const rules = revisionRules as RevisionRules;

/** Revision (Learning OS 7.1, 7.2): the due reviews, most useful first, with postpone. */
export default function RevisionPage() {
  const { subjects, chapters } = useCurriculum();
  const [data, setData] = useState<{ mistakes: Mistake[]; flashcards: Flashcard[]; mastery: TopicMastery[]; links: ConceptLink[]; examDate: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  // The order is fixed when the page opens, so items do not jump while answering.
  const [now] = useState(() => new Date());
  const [postponed, setPostponed] = useState<Map<string, string>>(() => new Map());
  const [problem, setProblem] = useState<Map<string, string>>(() => new Map());

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    Promise.all([getMistakes(), getFlashcards(), getTopicMastery(), getConceptLinks(), getLearningProfile()])
      .then(([mistakes, flashcards, mastery, links, profile]) => setData({ mistakes, flashcards, mastery, links, examDate: profile.examDate }))
      .catch(() => setFailed(true));
  }, []);

  const queue = useMemo(
    () =>
      data
        ? buildRevisionQueue(
            {
              reviews: data.mistakes.map((m) => ({ questionId: m.questionId, topicId: m.question.topicId, nextReviewAt: m.nextReviewAt, timesWrong: m.timesWrong, postponed: m.postponed })),
              flashcards: data.flashcards,
              mastery: data.mastery,
              links: data.links,
              examDate: data.examDate,
              now,
            },
            rules,
          )
        : null,
    [data, now],
  );
  const topicName = useMemo(() => new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => [topic.id, topic.nameEn] as const))), [chapters]);
  const chapterOf = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);

  if (failed) {
    return (
      <div className="container-page max-w-3xl py-8">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data || !queue) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={3} variant="block" />
      </div>
    );
  }

  const mistakeOf = new Map(data.mistakes.map((m) => [m.questionId, m]));
  const cardOf = new Map(data.flashcards.map((card) => [card.id, card]));
  const reasonText = (reason: RevisionReason) => {
    switch (reason.code) {
      case "overdue":
        return copy.reasons.overdue(reason.days);
      case "repeated":
        return copy.reasons.repeated(reason.times);
      case "forgotten":
        return copy.reasons.forgotten(reason.times);
      case "weak-topic":
        return copy.reasons.weakTopic(t.learning.mastery.labels[reason.label]);
      case "needed-for":
        return copy.reasons.neededFor(topicName.get(reason.topicId) ?? reason.topicId);
      case "exam-soon":
        return copy.reasons.examSoon(reason.days);
    }
  };
  const postpone = async (item: RevisionItem, days: number) => {
    try {
      const until = await postponeReview(item.id, days as 1 | 3 | 7);
      setPostponed((map) => new Map(map).set(item.id, until));
    } catch (error) {
      setProblem((map) => new Map(map).set(item.id, error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/learning" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.learning.home.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">
        {copy.title}
      </h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.intro}</p>

      <h2 className="font-display text-ink-900 mb-2 text-lg font-bold">{queue.due.length ? copy.dueTitle(queue.due.length) : copy.noneDue}</h2>
      <ol className="space-y-4">
        {queue.due.map((item, index) => {
          if (item.source === "flashcard") {
            const card = cardOf.get(item.id)!;
            return (
              <li key={`card:${item.id}`} data-revision-item={item.id} data-source="flashcard">
                {item.reasons.length > 0 && (
                  <ul className="mb-1.5 flex flex-wrap gap-1.5">
                    {item.reasons.map((reason, i) => (
                      <li key={i} className="bg-surface-hover text-ink-700 rounded-full px-2 py-0.5 text-xs">
                        {reasonText(reason)}
                      </li>
                    ))}
                  </ul>
                )}
                <FlashcardReview card={card} topicName={`${copy.flashcardLabel}${card.topicId && topicName.get(card.topicId) ? ` · ${topicName.get(card.topicId)}` : ""}`} />
              </li>
            );
          }
          const mistake = mistakeOf.get(item.id)!;
          const chapter = mistake.question.chapterId ? chapterOf.get(mistake.question.chapterId) : undefined;
          const subject = subjects.find((s) => s.id === chapter?.subjectId);
          const until = postponed.get(item.id);
          return (
            <PracticeQuestion
              key={item.id}
              question={mistake.question}
              number={index + 1}
              chapter={chapter}
              subjectKey={subject?.subjectKey ?? ""}
              note={
                <div className="mt-2 space-y-2" data-revision-item={item.id}>
                  {item.reasons.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {item.reasons.map((reason, i) => (
                        <li key={i} className="bg-surface-hover text-ink-700 rounded-full px-2 py-0.5 text-xs">
                          {reasonText(reason)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {until ? (
                    <p className="text-ink-500 text-xs" role="status">
                      {copy.postponed(formatDate(until))}
                    </p>
                  ) : item.canPostpone ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-ink-500">{copy.postpone}</span>
                      {rules.postponeDays.map((days) => (
                        <button key={days} type="button" onClick={() => void postpone(item, days)} aria-label={copy.postponeLabel(days, index + 1)} className="btn-ghost h-7 px-2 text-xs">
                          {copy.postponeBy(days)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-ink-500 text-xs">{copy.postponeLimit}</p>
                  )}
                  {problem.get(item.id) && (
                    <p role="alert" className="text-danger-fg text-xs">
                      {problem.get(item.id)}
                    </p>
                  )}
                </div>
              }
            />
          );
        })}
      </ol>

      <section className="card mt-6 p-4" aria-labelledby="revision-upcoming">
        <h2 id="revision-upcoming" className="text-ink-900 mb-2 text-sm font-bold">
          {copy.upcomingTitle}
        </h2>
        {queue.upcoming.length ? (
          <ul className="divide-line divide-y">
            {queue.upcoming.map((item) => {
              const question = item.source === "notebook" ? mistakeOf.get(item.id)!.question : null;
              const card = item.source === "flashcard" ? cardOf.get(item.id)! : null;
              const label = card
                ? `${copy.flashcardLabel}: ${card.front.length > 60 ? `${card.front.slice(0, 60)}…` : card.front}`
                : (question!.topicId && topicName.get(question!.topicId)) || (question!.chapterId && chapterOf.get(question!.chapterId)?.nameEn) || question!.id;
              return (
                <li key={`${item.source}:${item.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-ink-900 min-w-0">{label}</span>
                  <span className="text-ink-500 text-xs">{copy.dueOn(formatDate(item.dueAt))}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-ink-500 text-sm">{copy.upcomingNone}</p>
        )}
      </section>
      <p className="text-ink-500 mt-3 text-xs">
        {copy.flashcardsNote}{" "}
        <Link to="/bacii/mistakes" className="text-accent font-semibold hover:underline">
          {copy.notebook}
        </Link>
        {" · "}
        <Link to="/learning/flashcards" className="text-accent font-semibold hover:underline">
          {copy.flashcardsLink}
        </Link>
      </p>
    </div>
  );
}
