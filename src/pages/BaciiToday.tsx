import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { ArrowLeftIcon, CalendarIcon, CheckIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import PracticeQuestion from "../components/PracticeQuestion";
import { t } from "../i18n/en";
import { getCurriculumChapters, getCurriculumSubjects, getDailyQuestion, getDailyStreak } from "../services/api";
import type { CurriculumChapter, DailyQuestion, DailyStreak } from "../types";

const copy = t.bacii.daily;

function streakMessage(streak: DailyStreak): string {
  if (streak.answeredToday) return copy.doneToday;
  if (streak.current > 0) return copy.keepGoing(streak.current + 1);
  if (streak.best > 0) return copy.welcomeBack(streak.best);
  return copy.start;
}

/** BacII → Today's question: one a day from the weakest chapter, with a gentle streak (roadmap 3.3). */
export default function BaciiToday() {
  const [daily, setDaily] = useState<DailyQuestion | null | undefined>(undefined);
  const [streak, setStreak] = useState<DailyStreak | null>(null);
  const [chapter, setChapter] = useState<CurriculumChapter | undefined>();
  const [subjectKey, setSubjectKey] = useState("");
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
  }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    Promise.all([getDailyQuestion(), getDailyStreak()])
      .then(([question, current]) => {
        if (!active) return;
        setDaily(question);
        setStreak(current);
        if (!question) return;
        getCurriculumChapters(question.question.subjectId)
          .then((list) => active && setChapter(list.find((item) => item.id === question.chapterId)))
          .catch(() => {});
        getCurriculumSubjects()
          .then((list) => active && setSubjectKey(list.find((item) => item.id === question.question.subjectId)?.subjectKey ?? ""))
          .catch(() => {});
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [reload]);

  const answered = (correct: boolean) => {
    setDaily((current) => (current && !current.answeredAt ? { ...current, answeredAt: new Date().toISOString(), correct } : current));
    getDailyStreak().then(setStreak).catch(() => {});
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
          {copy.titleKm}
        </p>
      </header>

      {failed ? (
        <ErrorState onRetry={() => setReload((count) => count + 1)} />
      ) : daily === undefined || !streak ? (
        <LoadingState count={2} variant="block" />
      ) : (
        <>
          <section className="card mb-4 flex items-center gap-4 p-4 sm:p-5" aria-label={copy.streakDays(streak.current)}>
            <span className="bg-ribbon-50 text-ribbon-fg flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl">
              <span className="font-display text-2xl leading-none font-bold tabular-nums">{streak.current}</span>
              <CalendarIcon className="mt-0.5 h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-ink-900 text-lg font-bold">{copy.streakDays(streak.current)}</p>
              <p className="text-ink-700 text-sm">{streakMessage(streak)}</p>
              <p className="text-ink-500 mt-0.5 text-xs">
                {streak.best > 0 && `${copy.best(streak.best)} · `}
                {copy.streakNote}
              </p>
            </div>
          </section>

          {!daily ? (
            <EmptyState icon={<CalendarIcon className="h-6 w-6" />} title={copy.none} body={copy.noneBody} />
          ) : (
            <>
              <p className="text-ink-500 mb-2 text-xs">{daily.fromResults ? copy.fromWeakest(chapter?.nameKm ?? "") : copy.fromStart}</p>
              {daily.answeredAt && (
                <p
                  role="status"
                  className={`mb-3 flex items-center gap-1.5 rounded-md px-4 py-3 text-sm font-medium ${
                    daily.correct ? "bg-brand-50 text-accent" : "bg-surface border-line text-ink-700 border"
                  }`}
                >
                  {daily.correct && <CheckIcon className="h-4 w-4 shrink-0" />}
                  {daily.correct ? copy.answeredRight : copy.answeredWrong}
                </p>
              )}
              <ol>
                <PracticeQuestion question={daily.question} number={1} chapter={chapter} subjectKey={subjectKey} onChecked={(correct) => answered(correct)} />
              </ol>
            </>
          )}
        </>
      )}
    </div>
  );
}
