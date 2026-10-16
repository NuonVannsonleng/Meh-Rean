import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { ArrowLeftIcon, FileTextIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import PracticeQuestion from "../components/PracticeQuestion";
import { t } from "../i18n/en";
import { getCurriculumChapters, getCurriculumSubjects, getQuestions } from "../services/api";
import type { CurriculumChapter, CurriculumSubject, Question } from "../types";

const copy = t.bacii.practice;

const chip = (active: boolean) =>
  `press inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
    active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 hover:border-ink-400"
  }`;

/** BacII → Practice by chapter: subject, chapter and topic filters over the question bank (roadmap 2.3). */
export default function BaciiPractice() {
  const [params, setParams] = useSearchParams();
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const subjectId = params.get("subject") ?? subjects[0]?.id ?? "";
  const chapterId = params.get("chapter") ?? "";
  const topicId = params.get("topic") ?? "";
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [all, setAll] = useState<Question[] | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
    getCurriculumSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  // Chapters and per-chapter counts for the chosen subject.
  useEffect(() => {
    if (!subjectId) return;
    let active = true;
    getCurriculumChapters(subjectId).then((list) => active && setChapters(list)).catch(() => active && setChapters([]));
    getQuestions({ subjectId })
      .then((list) => active && setAll(list))
      .catch(() => active && setAll([]));
    return () => {
      active = false;
    };
  }, [subjectId, attempt]);

  // The filtered questions come from the database (or the demo store), not from the counts above.
  useEffect(() => {
    if (!subjectId) return;
    let active = true;
    setQuestions(null);
    setFailed(false);
    getQuestions({ subjectId, chapterId: chapterId || undefined, topicId: topicId || undefined })
      .then((list) => active && setQuestions([...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [subjectId, chapterId, topicId, attempt]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const question of all ?? []) map.set(question.chapterId, (map.get(question.chapterId) ?? 0) + 1);
    return map;
  }, [all]);
  const topicCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const question of all ?? []) if (question.topicId) map.set(question.topicId, (map.get(question.topicId) ?? 0) + 1);
    return map;
  }, [all]);
  const chapterOf = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const chapter = chapterOf.get(chapterId);
  const subject = subjects.find((item) => item.id === subjectId);

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

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-4">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="text-ink-500 mt-1 text-sm">{copy.optionTitleKm}</p>
      </header>

      {subjects.length > 1 && (
        <select
          aria-label={copy.subject}
          value={subjectId}
          onChange={(event) => set({ subject: event.target.value, chapter: "", topic: "" })}
          className="input mb-3 h-10 cursor-pointer sm:w-auto"
        >
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {`${item.nameKm} — ${item.nameEn} (${item.trackNameEn})`}
            </option>
          ))}
        </select>
      )}
      {subject && subjects.length === 1 && (
        <p className="text-ink-700 mb-3 text-sm font-medium">{`${subject.nameKm} — ${subject.nameEn} · ${subject.trackNameEn}`}</p>
      )}

      <div role="group" aria-label={copy.chaptersLabel} className="chip-row mb-2">
        <button type="button" aria-pressed={!chapterId} onClick={() => set({ chapter: "", topic: "" })} className={chip(!chapterId)}>
          {copy.allChapters}
        </button>
        {chapters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={chapterId === item.id}
            onClick={() => set({ chapter: item.id, topic: "" })}
            className={chip(chapterId === item.id)}
          >
            {copy.chapterChip(item.number, item.nameKm, counts.get(item.id) ?? 0)}
          </button>
        ))}
      </div>
      {chapter && chapter.topics.length > 0 && (
        <div role="group" aria-label={copy.topicsLabel} className="chip-row mb-2">
          <button type="button" aria-pressed={!topicId} onClick={() => set({ topic: "" })} className={chip(!topicId)}>
            {copy.allTopics}
          </button>
          {chapter.topics.map((topic) => (
            <button key={topic.id} type="button" aria-pressed={topicId === topic.id} onClick={() => set({ topic: topic.id })} className={chip(topicId === topic.id)}>
              {`${topic.nameKm} (${topicCounts.get(topic.id) ?? 0})`}
            </button>
          ))}
        </div>
      )}

      {topicId && (
        <Link to={`/learning/topics/${encodeURIComponent(topicId)}`} className="text-accent mt-2 inline-block text-sm font-semibold hover:underline">
          {copy.aboutTopic}
        </Link>
      )}
      <p className="text-ink-500 mt-3 mb-4 text-xs">{copy.demoNote}</p>

      {failed ? (
        <ErrorState onRetry={() => setAttempt((count) => count + 1)} />
      ) : !questions ? (
        <LoadingState count={2} variant="block" />
      ) : questions.length === 0 ? (
        <EmptyState icon={<FileTextIcon className="h-6 w-6" />} title={copy.none} body={copy.noneHint} />
      ) : (
        <>
          <p className="text-ink-500 mb-2 text-xs" aria-live="polite">
            {copy.count(questions.length)}
          </p>
          <ol className="space-y-3">
            {questions.map((question, index) => (
              <PracticeQuestion
                key={question.id}
                question={question}
                number={index + 1}
                chapter={chapterOf.get(question.chapterId)}
                subjectKey={subject?.subjectKey ?? ""}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
