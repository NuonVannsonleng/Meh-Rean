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
import { deleteMistake, getCurriculumChapters, getCurriculumSubjects, getMistakes } from "../services/api";
import type { CurriculumChapter, CurriculumSubject, Mistake } from "../types";

const copy = t.bacii.mistakes;

const chip = (active: boolean) =>
  `press inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
    active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 hover:border-ink-400"
  }`;

/** BacII → Mistake notebook: questions answered wrong, to retry until right (roadmap 3.1). */
export default function BaciiMistakes() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "fixed" ? "fixed" : "open";
  const chapterId = params.get("chapter") ?? "";
  const [mistakes, setMistakes] = useState<Mistake[] | null>(null);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  // Fixed while on this page: stays in place (marked fixed) rather than vanishing mid-read.
  const [fixedHere, setFixedHere] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
    getCurriculumSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    getMistakes()
      .then((list) => active && setMistakes(list))
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
  const inView = (m: Mistake) => (view === "open" ? !m.fixedAt || fixedHere.has(m.questionId) : Boolean(m.fixedAt) && !fixedHere.has(m.questionId));
  const listed = (mistakes ?? []).filter(inView);
  const shown = listed.filter((m) => !chapterId || m.question.chapterId === chapterId);
  const openCount = (mistakes ?? []).filter((m) => !m.fixedAt).length;
  const fixedCount = (mistakes ?? []).length - openCount;
  const chapterCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of listed) map.set(m.question.chapterId, (map.get(m.question.chapterId) ?? 0) + 1);
    return map;
  }, [listed]);
  const usedChapters = chapters.filter((chapter) => chapterCounts.has(chapter.id));

  const set = (values: Record<string, string>) =>
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

  const checked = (questionId: string, correct: boolean, answer: string) => {
    const now = new Date().toISOString();
    setMistakes((list) =>
      (list ?? []).map((m) =>
        m.questionId !== questionId
          ? m
          : correct
            ? { ...m, fixedAt: m.fixedAt ?? now }
            : { ...m, fixedAt: null, lastAnswer: answer, timesWrong: m.timesWrong + 1, lastWrongAt: now, source: "practice" as const },
      ),
    );
    setFixedHere((current) => {
      const next = new Set(current);
      // Only keep in place the ones that were open when the page showed them.
      if (correct && view === "open") next.add(questionId);
      if (!correct) next.delete(questionId);
      return next;
    });
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
        <p className="text-ink-500 mt-1 text-sm" lang="km">
          {copy.optionTitleKm}
        </p>
      </header>

      <div role="group" aria-label={copy.views} className="chip-row mb-2">
        <button type="button" aria-pressed={view === "open"} onClick={() => set({ view: "", chapter: "" })} className={chip(view === "open")}>
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
              {copy.chapterChip(chapter.number, chapter.nameKm, chapterCounts.get(chapter.id) ?? 0)}
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
            title={view === "open" ? copy.emptyTitle : copy.emptyFixedTitle}
            body={view === "open" ? copy.emptyBody : copy.emptyFixedBody}
            action={
              view === "open" ? (
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
                            {fixedHere.has(m.questionId) ? copy.fixedNow : copy.fixedOn(formatDate(m.fixedAt))}
                          </span>
                        ) : (
                          `${copy.timesWrong(m.timesWrong)} · ${m.source === "exam" ? copy.fromExam : copy.fromPractice} · ${copy.when(formatDate(m.lastWrongAt))}`
                        )}
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
