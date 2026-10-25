import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import GivenAnswer from "../components/GivenAnswer";
import { ArrowLeftIcon, CheckIcon, PenIcon, TrashIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import PracticeQuestion from "../components/PracticeQuestion";
import { t } from "../i18n/en";
import { formatDate } from "../lib/format";
import { afterRight, afterWrong, isDue, isLearned, REVIEW_INTERVAL_DAYS, REVIEW_STAGES } from "../lib/review";
import { deleteMistake, getCurriculumChapters, getCurriculumSubjects, getMistakes } from "../services/api";
import type { CurriculumChapter, CurriculumSubject, Mistake } from "../types";

const copy = t.bacii.mistakes;

const chip = (active: boolean) =>
  `press inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
    active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 hover:border-ink-400"
  }`;

type View = "due" | "open" | "fixed";

const inView = (m: Mistake, view: View, now: Date) => (view === "due" ? isDue(m, now) : view === "open" ? !m.fixedAt : Boolean(m.fixedAt));

/** BacII → Mistake notebook: questions answered wrong, retried until right and reviewed on a schedule (roadmap 3.1, 3.2). */
export default function BaciiMistakes() {
  const [params, setParams] = useSearchParams();
  const chapterId = params.get("chapter") ?? "";
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  // Opens on today's reviews when there are any; chosen once, so it does not jump as they are done.
  const [firstView, setFirstView] = useState<View | null>(null);
  const asked = params.get("view");
  const view: View = asked === "due" || asked === "open" || asked === "fixed" ? asked : (firstView ?? "open");
  // Answered on this page: stays in the list it was in rather than vanishing mid-read.
  const [answeredHere, setAnsweredHere] = useState<Map<string, View>>(() => new Map());
  const [now] = useState(() => new Date());

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
    getCurriculumSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    getMistakes()
      .then((list) => {
        if (!active) return;
        setMistakes(list);
        setFirstView((current) => current ?? (list.some((m) => isDue(m, new Date())) ? "due" : "open"));
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [reload]);

  // Chapters of every subject that has a mistake, for names and the filter.
  const subjectIds = useMemo(() => [...new Set((mistakes ?? []).map((m) => m.question.subjectId))].sort().join(","), [mistakes]);
  useEffect(() => {
    if (!subjectIds) return;
    let active = true;
    Promise.all(subjectIds.split(",").map((id) => getCurriculumChapters(id).catch(() => [])))
      .then((lists) => active && setChapters(lists.flat()))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [subjectIds]);

  const chapterOf = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const listed = (mistakes ?? []).filter((m) => (answeredHere.has(m.questionId) ? answeredHere.get(m.questionId) === view : inView(m, view, now)));
  const shown = listed.filter((m) => !chapterId || m.question.chapterId === chapterId);
  const dueCount = (mistakes ?? []).filter((m) => inView(m, "due", new Date())).length;
  const openCount = (mistakes ?? []).filter((m) => !m.fixedAt).length;
  const fixedCount = (mistakes ?? []).length - openCount;
  const chapterCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of listed) map.set(m.question.chapterId, (map.get(m.question.chapterId) ?? 0) + 1);
    return map;
  }, [listed]);
  const usedChapters = chapters.filter((chapter) => chapterCounts.has(chapter.id));

  const set = (values: Record<string, string>) => {
    if ("view" in values) setAnsweredHere(new Map());
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(values)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  // The server has already recorded the answer; mirror its rules so the page shows it without reloading.
  const checked = (questionId: string, correct: boolean, answer: string) => {
    const at = new Date();
    setMistakes((list) =>
      (list ?? []).map((m) =>
        m.questionId !== questionId
          ? m
          : correct
            ? { ...m, ...afterRight(m, at) }
            : { ...m, ...afterWrong(at), lastAnswer: answer, timesWrong: m.timesWrong + 1, lastWrongAt: at.toISOString(), source: "practice" as const },
      ),
    );
    setAnsweredHere((current) => (current.has(questionId) ? current : new Map(current).set(questionId, view)));
  };

  const remove = async (questionId: string) => {
    if (!window.confirm(copy.removeConfirm)) return;
    try {
      await deleteMistake(questionId);
      setMistakes((list) => (list ?? []).filter((m) => m.questionId !== questionId));
    } catch {
      setReload((count) => count + 1);
    }
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-4">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
      </header>

      <p className="text-ink-500 mb-3 text-xs">
        {copy.reviewHint(REVIEW_INTERVAL_DAYS.join(", "))}{" "}
        <Link to="/bacii/my-videos?status=needs-revision" className="text-accent font-semibold hover:underline">
          {t.bacii.myVideos.notebookLink}
        </Link>
      </p>

      <div role="group" aria-label={copy.views} className="chip-row mb-2">
        <button type="button" aria-pressed={view === "due"} onClick={() => set({ view: "due", chapter: "" })} className={chip(view === "due")}>
          {copy.dueToday(dueCount)}
        </button>
        <button type="button" aria-pressed={view === "open"} onClick={() => set({ view: "open", chapter: "" })} className={chip(view === "open")}>
          {copy.toFix(openCount)}
        </button>
        <button type="button" aria-pressed={view === "fixed"} onClick={() => set({ view: "fixed", chapter: "" })} className={chip(view === "fixed")}>
          {copy.fixed(fixedCount)}
        </button>
      </div>
      {usedChapters.length > 1 && (
        <div role="group" aria-label={copy.chaptersLabel} className="chip-row mb-2">
          <button type="button" aria-pressed={!chapterId} onClick={() => set({ chapter: "" })} className={chip(!chapterId)}>
            {copy.allChapters}
          </button>
          {usedChapters.map((chapter) => (
            <button key={chapter.id} type="button" aria-pressed={chapterId === chapter.id} onClick={() => set({ chapter: chapter.id })} className={chip(chapterId === chapter.id)}>
              {copy.chapterChip(chapter.number, chapter.nameEn, chapterCounts.get(chapter.id) ?? 0)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        {failed ? (
          <ErrorState onRetry={() => setReload((count) => count + 1)} />
        ) : !mistakes ? (
          <LoadingState count={2} variant="block" />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<PenIcon className="h-6 w-6" />}
            title={view === "due" ? copy.emptyDueTitle : view === "open" ? copy.emptyTitle : copy.emptyFixedTitle}
            body={view === "due" ? copy.emptyDueBody : view === "open" ? copy.emptyBody : copy.emptyFixedBody}
            action={
              view !== "fixed" ? (
                <Link to="/bacii/practice" className="btn-primary">
                  {copy.practiseLink}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ol className="space-y-3">
            {shown.map((m, index) => {
              const subject = subjects.find((item) => item.id === m.question.subjectId);
              return (
                <PracticeQuestion
                  key={m.questionId}
                  question={m.question}
                  number={index + 1}
                  chapter={chapterOf.get(m.question.chapterId)}
                  subjectKey={subject?.subjectKey ?? ""}
                  onChecked={(correct, answer) => checked(m.questionId, correct, answer)}
                  note={
                    <div className="bg-surface-muted mt-3 rounded-md px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-ink-500 text-[11px] font-semibold tracking-wide uppercase">{copy.lastAnswer}</p>
                          <p className="text-ink-900 mt-0.5">
                            <GivenAnswer question={m.question} answer={m.lastAnswer} />
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void remove(m.questionId)}
                          className="text-ink-500 hover:text-danger-fg inline-flex h-8 items-center gap-1 text-xs font-medium"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {copy.remove}
                        </button>
                      </div>
                      <p className="text-ink-500 mt-1 text-xs">
                        {m.fixedAt ? (
                          <span className="text-accent inline-flex items-center gap-1 font-semibold">
                            <CheckIcon className="h-3.5 w-3.5" />
                            {Date.parse(m.fixedAt) >= now.getTime() ? copy.fixedNow : copy.fixedOn(formatDate(m.fixedAt))}
                          </span>
                        ) : (
                          `${copy.timesWrong(m.timesWrong)} · ${m.source === "exam" ? copy.fromExam : copy.fromPractice} · ${copy.when(formatDate(m.lastWrongAt))}`
                        )}
                      </p>
                      <p className={`mt-0.5 text-xs ${isDue(m, new Date()) ? "text-ribbon-fg font-semibold" : "text-ink-500"}`}>
                        {isLearned(m)
                          ? copy.learned(REVIEW_STAGES)
                          : isDue(m, new Date())
                            ? copy.reviewDue(m.reviewStage + 1, REVIEW_STAGES)
                            : m.nextReviewAt && copy.nextReview(formatDate(m.nextReviewAt), m.reviewStage + 1, REVIEW_STAGES)}
                      </p>
                    </div>
                  }
                />
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
