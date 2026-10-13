import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { ArrowLeftIcon, ExternalLinkIcon, TrashIcon, VideoIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import { t } from "../i18n/en";
import {
  deleteVideoProgress,
  getChapterProgress,
  getCurriculumChapters,
  getCurriculumSubjects,
  getMistakes,
  getVideoProgress,
  setVideoProgress,
} from "../services/api";
import type { ChapterProgress, CurriculumChapter, VideoProgress, VideoStatus } from "../types";

const copy = t.bacii.myVideos;
const STATUSES: VideoStatus[] = ["needs-revision", "watched", "understood"];

const chip = (active: boolean) =>
  `press inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
    active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 hover:border-ink-400"
  }`;

/** BacII → My videos: what the student watched, understood or must revise, beside their results (roadmap 4.7). */
export default function BaciiMyVideos() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("status");
  const view: VideoStatus | "all" = STATUSES.includes(asked as VideoStatus) ? (asked as VideoStatus) : "all";
  const [videos, setVideos] = useState<VideoProgress[] | null>(null);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [progress, setProgress] = useState<ChapterProgress[]>([]);
  const [openMistakes, setOpenMistakes] = useState<Map<string, number>>(() => new Map());
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
  }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    getVideoProgress()
      .then((list) => active && setVideos(list))
      .catch(() => active && setFailed(true));
    // The rest only adds context; the page works without it.
    getChapterProgress().then((list) => active && setProgress(list)).catch(() => {});
    getMistakes()
      .then((list) => {
        if (!active) return;
        const counts = new Map<string, number>();
        for (const mistake of list) if (!mistake.fixedAt) counts.set(mistake.question.chapterId, (counts.get(mistake.question.chapterId) ?? 0) + 1);
        setOpenMistakes(counts);
      })
      .catch(() => {});
    getCurriculumSubjects()
      .then((subjects) => Promise.all(subjects.map((subject) => getCurriculumChapters(subject.id).catch(() => []))))
      .then((lists) => active && setChapters(lists.flat()))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [reload]);

  const chapterOf = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const progressOf = useMemo(() => new Map(progress.map((item) => [item.chapterId, item])), [progress]);
  const count = (status: VideoStatus) => (videos ?? []).filter((video) => video.status === status).length;
  const shown = (videos ?? []).filter((video) => view === "all" || video.status === view);

  const change = async (video: VideoProgress, status: VideoStatus) => {
    setVideos((list) => (list ?? []).map((item) => (item.videoId === video.videoId ? { ...item, status } : item)));
    await setVideoProgress({ ...video, status }).catch(() => setReload((n) => n + 1));
  };
  const remove = async (video: VideoProgress) => {
    setVideos((list) => (list ?? []).filter((item) => item.videoId !== video.videoId));
    await deleteVideoProgress(video.videoId).catch(() => setReload((n) => n + 1));
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii/videos" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {copy.back}
      </Link>
      <header className="mb-4">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="text-ink-500 mt-1 text-sm" lang="km">
          {copy.titleKm}
        </p>
      </header>

      <div role="group" aria-label={copy.filter} className="chip-row mb-4">
        <button type="button" aria-pressed={view === "all"} onClick={() => setParams({}, { replace: true })} className={chip(view === "all")}>
          {copy.all((videos ?? []).length)}
        </button>
        {STATUSES.map((status) => (
          <button key={status} type="button" aria-pressed={view === status} onClick={() => setParams({ status }, { replace: true })} className={chip(view === status)}>
            {copy.statusCount[status](count(status))}
          </button>
        ))}
      </div>

      {failed ? (
        <ErrorState onRetry={() => setReload((n) => n + 1)} />
      ) : !videos ? (
        <LoadingState count={2} variant="block" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<VideoIcon className="h-6 w-6" />}
          title={copy.emptyTitle}
          body={copy.emptyBody}
          action={
            <Link to="/bacii/videos" className="btn-primary">
              {copy.findVideos}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {shown.map((video) => {
            const chapter = video.chapterId ? chapterOf.get(video.chapterId) : undefined;
            const result = video.chapterId ? progressOf.get(video.chapterId) : undefined;
            const mistakes = video.chapterId ? (openMistakes.get(video.chapterId) ?? 0) : 0;
            return (
              <li key={video.videoId} className="card flex gap-3 p-3 sm:p-4">
                <a
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-black sm:w-40"
                  aria-label={copy.open(video.title)}
                >
                  <img src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute right-1 bottom-1 rounded bg-black/60 p-1 text-white">
                    <ExternalLinkIcon className="h-3 w-3" />
                  </span>
                </a>
                <div className="min-w-0 flex-1">
                  <p className="text-ink-900 line-clamp-2 text-sm font-semibold">{video.title}</p>
                  <p className="text-ink-500 truncate text-xs">{video.channel}</p>
                  {chapter && (
                    <p className="mt-1 text-xs">
                      <Link
                        to={`/bacii/practice?subject=${encodeURIComponent(chapter.subjectId)}&chapter=${encodeURIComponent(chapter.id)}`}
                        className="text-accent font-semibold hover:underline"
                      >
                        {copy.chapter(chapter.number, chapter.nameKm)}
                      </Link>
                      {result && result.answered > 0 && <span className="text-ink-500">{` · ${copy.results(result.correct, result.answered)}`}</span>}
                      {mistakes > 0 && (
                        <>
                          {" · "}
                          <Link to={`/bacii/mistakes?view=open&chapter=${encodeURIComponent(chapter.id)}`} className="text-ribbon-fg font-semibold hover:underline">
                            {copy.mistakes(mistakes)}
                          </Link>
                        </>
                      )}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={video.status}
                      onChange={(event) => void change(video, event.target.value as VideoStatus)}
                      aria-label={copy.statusOf(video.title)}
                      className="input h-8 w-auto py-0 text-xs"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t.bacii.videos.mark[status]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void remove(video)}
                      aria-label={copy.remove(video.title)}
                      className="text-ink-500 hover:text-danger-fg flex h-8 w-8 items-center justify-center"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
