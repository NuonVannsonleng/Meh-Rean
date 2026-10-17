import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon, TrashIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import { useCurriculum } from "../../hooks/useCurriculum";
import { t } from "../../i18n/en";
import { formatDate } from "../../lib/format";
import { deleteLearningEvents, getLearningEvents } from "../../services/api";
import type { LearningEvent } from "../../types";

const copy = t.learning.history;
const PAGE = 200;
const MAX = 1000;
const cambodiaDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function kindOf(event: LearningEvent): string {
  switch (event.eventType) {
    case "question_attempted":
      return event.data.source === "exam" ? copy.kinds.exam : event.data.source === "daily" ? copy.kinds.daily : copy.kinds.practice;
    case "mistake_reviewed":
      return copy.kinds.review;
    case "mock_exam_completed":
      return copy.kinds.examDone;
    case "video_watched":
      return copy.kinds.videoWatched;
    case "video_marked_understood":
      return copy.kinds.videoUnderstood;
    case "video_marked_revise":
      return copy.kinds.videoRevise;
    case "study_task_completed":
      return copy.kinds.planTask;
  }
}

/** My learning history (Learning OS 7.3): every recorded event, with deletion of one or all. */
export default function HistoryPage() {
  const { chapters } = useCurriculum();
  const [events, setEvents] = useState<LearningEvent[] | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
  }, []);
  useEffect(() => {
    getLearningEvents(limit)
      .then(setEvents)
      .catch(() => setFailed(true));
  }, [limit]);

  const topicName = useMemo(() => new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => [topic.id, topic.nameEn] as const))), [chapters]);
  const chapterName = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter.nameEn] as const)), [chapters]);
  const days = useMemo(() => {
    const groups = new Map<string, LearningEvent[]>();
    for (const event of events ?? []) groups.set(cambodiaDay(event.createdAt), [...(groups.get(cambodiaDay(event.createdAt)) ?? []), event]);
    return [...groups];
  }, [events]);

  const removeOne = async (event: LearningEvent) => {
    if (!window.confirm(copy.removeConfirm)) return;
    try {
      await deleteLearningEvents([event.id]);
      setEvents((list) => (list ?? []).filter((item) => item.id !== event.id));
    } catch {
      setStatus({ kind: "error", text: copy.failed });
    }
  };
  const removeAll = async () => {
    if (!window.confirm(copy.deleteAllConfirm)) return;
    try {
      const count = await deleteLearningEvents();
      setEvents([]);
      setStatus({ kind: "ok", text: copy.deletedAll(count) });
    } catch {
      setStatus({ kind: "error", text: copy.failed });
    }
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/learning/profile" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.learning.profileLink}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">
        {copy.title} <span className="text-ink-500 text-base font-normal" lang="km">{`· ${copy.titleKm}`}</span>
      </h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.intro}</p>
      {status && (
        <p role={status.kind === "error" ? "alert" : "status"} className={`mb-3 text-sm font-medium ${status.kind === "error" ? "text-danger-fg" : "text-accent"}`}>
          {status.text}
        </p>
      )}

      {failed ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : !events ? (
        <LoadingState count={3} variant="block" />
      ) : events.length === 0 ? (
        <p className="card text-ink-700 p-4 text-sm">{copy.empty}</p>
      ) : (
        <div className="space-y-4">
          {days.map(([day, list]) => (
            <section key={day} className="card p-4" aria-label={formatDate(`${day}T12:00:00+07:00`)}>
              <h2 className="text-ink-900 mb-1 text-sm font-bold">{formatDate(`${day}T12:00:00+07:00`)}</h2>
              <ul className="divide-line divide-y">
                {list.map((event) => {
                  const what = kindOf(event);
                  const topic = (event.topicId && topicName.get(event.topicId)) || (event.chapterId && chapterName.get(event.chapterId)) || (typeof event.data.chapter_id === "string" ? chapterName.get(event.data.chapter_id) : undefined);
                  const result = typeof event.data.correct === "boolean" ? (event.data.correct ? copy.right : copy.wrong) : event.eventType === "mock_exam_completed" && typeof event.data.score === "number" && typeof event.data.max_score === "number" ? copy.examScore(event.data.score, event.data.max_score) : null;
                  return (
                    <li key={event.id} className="flex items-center gap-2 py-2 text-sm" data-event={event.id}>
                      <span className="text-ink-500 w-12 shrink-0 text-xs tabular-nums">{timeOf(event.createdAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="text-ink-900 block">{what}</span>
                        {topic && <span className="text-ink-500 block truncate text-xs">{topic}</span>}
                      </span>
                      {result && <span className={`text-xs font-semibold ${event.data.correct === false ? "text-danger-fg" : "text-accent"}`}>{result}</span>}
                      <button type="button" onClick={() => void removeOne(event)} aria-label={copy.removeLabel(what, timeOf(event.createdAt))} className="text-ink-500 hover:text-danger-fg flex h-8 w-8 shrink-0 items-center justify-center">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {events.length >= limit && limit < MAX && (
            <button type="button" onClick={() => setLimit((value) => Math.min(MAX, value + PAGE))} className="btn-secondary">
              {copy.showMore}
            </button>
          )}
          <button type="button" onClick={() => void removeAll()} className="btn-ghost text-danger-fg block">
            {copy.deleteAll}
          </button>
        </div>
      )}
      <p className="text-ink-500 mt-4 text-xs">{copy.note}</p>
    </div>
  );
}
