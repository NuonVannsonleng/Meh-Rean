import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon, FileTextIcon, PlusIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import MathText from "../../components/MathText";
import VerificationBadge from "../../components/VerificationBadge";
import { t } from "../../i18n/en";
import { formatDate } from "../../lib/format";
import { getCurriculumChapters, getCurriculumSubjects, getQuestions } from "../../services/api";
import type { CurriculumChapter, CurriculumSubject, Question } from "../../types";

/** BacII → Manage questions: every question, filtered by subject and chapter. */
export default function AdminQuestions() {
  const [params, setParams] = useSearchParams();
  const subjectId = params.get("subject") ?? "";
  const chapterId = params.get("chapter") ?? "";
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = `${t.admin.questionsTitle} · ${t.bacii.title} · ${t.common.appName}`;
    getCurriculumSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    if (!subjectId) {
      setChapters([]);
      return;
    }
    getCurriculumChapters(subjectId).then(setChapters).catch(() => setChapters([]));
  }, [subjectId]);

  useEffect(() => {
    let active = true;
    setQuestions(null);
    setFailed(false);
    getQuestions({ subjectId: subjectId || undefined, chapterId: chapterId || undefined })
      .then((list) => active && setQuestions(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [subjectId, chapterId, attempt]);

  const chapterName = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);

  const setFilter = (key: "subject" | "chapter", value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key === "subject") next.delete("chapter");
        return next;
      },
      { replace: true },
    );

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-ink-900 text-2xl sm:text-3xl">{t.admin.questionsTitle}</h1>
          <p className="text-ink-500 mt-1 text-sm">{t.admin.questionsSubtitle}</p>
        </div>
        <Link to="/bacii/admin/questions/new" className="btn-primary">
          <PlusIcon className="h-4 w-4" />
          {t.admin.newQuestion}
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          aria-label={t.admin.editor.subject}
          value={subjectId}
          onChange={(event) => setFilter("subject", event.target.value)}
          className="input h-10 w-auto min-w-44 cursor-pointer"
        >
          <option value="">{t.admin.allSubjects}</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {`${subject.nameEn} (${subject.trackNameEn})`}
            </option>
          ))}
        </select>
        {subjectId && (
          <select
            aria-label={t.admin.editor.chapter}
            value={chapterId}
            onChange={(event) => setFilter("chapter", event.target.value)}
            className="input h-10 w-auto max-w-full min-w-44 cursor-pointer"
          >
            <option value="">{t.admin.allChapters}</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {t.admin.chapterLabel(chapter.number, chapter.nameEn)}
              </option>
            ))}
          </select>
        )}
        {questions && <span className="text-ink-500 self-center text-sm">{t.admin.count(questions.length)}</span>}
      </div>

      {failed ? (
        <ErrorState onRetry={() => setAttempt((count) => count + 1)} />
      ) : !questions ? (
        <LoadingState count={3} />
      ) : questions.length === 0 ? (
        <EmptyState icon={<FileTextIcon className="h-6 w-6" />} title={t.admin.noQuestions} body={t.admin.noQuestionsHint} />
      ) : (
        <ul className="space-y-3">
          {questions.map((question) => {
            const chapter = chapterName.get(question.chapterId);
            return (
              <li key={question.id} className="card p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink-700 font-semibold">
                    {chapter ? t.admin.chapterLabel(chapter.number, chapter.nameEn) : question.chapterId}
                  </span>
                  <span className="text-ink-500">· {t.questions.types[question.type]}</span>
                  <span className="text-ink-500">· {t.questions.origins[question.origin]}</span>
                  {question.year && <span className="text-ink-500">· {question.year}</span>}
                  <VerificationBadge value={question.verification} />
                </div>
                <MathText text={question.content} className="text-ink-900 line-clamp-4 text-sm" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-ink-500 text-xs">{t.admin.updated(formatDate(question.updatedAt))}</span>
                  <Link to={`/bacii/admin/questions/${question.id}`} className="btn-secondary h-8 px-3 text-xs">
                    {t.admin.edit}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
