import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import GivenAnswer from "../components/GivenAnswer";
import GradeEstimateCard from "../components/GradeEstimateCard";
import { ArrowLeftIcon, CheckIcon, CloseIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import MathText from "../components/MathText";
import SolutionSteps from "../components/SolutionSteps";
import { t } from "../i18n/en";
import { formatPercent } from "../lib/grades";
import { getCurriculumChapters, getCurriculumSubjects, getExamAttempt, getExamPaper } from "../services/api";
import type { CurriculumChapter, ExamAnswer, ExamAttemptDetail, ExamPaperDetail } from "../types";
import { useCalculatorFor } from "../context/CalculatorContext";

const copy = t.bacii.exam;

function Verdict({ answer }: { answer: ExamAnswer | undefined }) {
  if (answer?.isCorrect === true) {
    return (
      <span className="bg-brand-50 text-accent inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
        <CheckIcon className="h-3.5 w-3.5" />
        {copy.correct}
      </span>
    );
  }
  if (answer?.isCorrect === false) {
    return (
      <span className="bg-danger-bg text-danger-fg inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold">
        <CloseIcon className="h-3.5 w-3.5" />
        {copy.incorrect}
      </span>
    );
  }
  return <span className="bg-surface-hover text-ink-700 rounded-full px-2 py-0.5 text-xs font-semibold">{copy.checkYourself}</span>;
}

/** The result of a mock exam, with every question to review (roadmap 2.4). */
export default function BaciiAttempt() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation() as { state: { timeUp?: boolean } | null };
  const [detail, setDetail] = useState<ExamAttemptDetail | null>(null);
  const [paper, setPaper] = useState<ExamPaperDetail | null>(null);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [subjectKey, setSubjectKey] = useState("");
  useCalculatorFor(subjectKey);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    getExamAttempt(id)
      .then(async (loaded) => {
        if (!active) return;
        // Still running (opened from history): go back to it.
        if (loaded.attempt.status === "in-progress") {
          navigate(`/bacii/papers/${loaded.attempt.paperId}/exam`, { replace: true });
          return;
        }
        const loadedPaper = await getExamPaper(loaded.attempt.paperId);
        if (!active) return;
        setDetail(loaded);
        setPaper(loadedPaper);
        document.title = `${copy.resultTitle} · ${loadedPaper.titleEn} · ${t.common.appName}`;
        getCurriculumChapters(loadedPaper.subjectId).then((list) => active && setChapters(list)).catch(() => {});
        getCurriculumSubjects()
          .then((list) => active && setSubjectKey(list.find((s) => s.id === loadedPaper.subjectId)?.subjectKey ?? ""))
          .catch(() => {});
      })
      .catch(() => active && setMissing(true));
    return () => {
      active = false;
    };
  }, [id, navigate]);

  const answerOf = useMemo(() => new Map((detail?.answers ?? []).map((answer) => [answer.questionId, answer])), [detail]);
  const chapterOf = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);

  if (missing) {
    return (
      <div className="container-page max-w-3xl py-16 text-center">
        <p className="text-ink-700">{copy.notFound}</p>
      </div>
    );
  }
  if (!detail || !paper) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={3} variant="block" />
      </div>
    );
  }

  const { attempt } = detail;
  const score = attempt.score ?? 0;
  const max = attempt.maxScore ?? 0;
  const missed = detail.answers.filter((answer) => answer.isCorrect === false).length;

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to={`/bacii/papers/${paper.id}`} className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {copy.backToPaper}
      </Link>
      {(state?.timeUp || attempt.status === "timed-out") && (
        <p role="status" className="bg-ribbon-50 text-ribbon-fg mb-4 rounded-md px-4 py-3 text-sm font-medium">
          {copy.timeUp}
        </p>
      )}

      <section className="card mb-5 p-5 sm:p-6" aria-labelledby="result-title">
        <p className="text-accent text-xs font-semibold tracking-wide uppercase">{copy.statuses[attempt.status]}</p>
        <h1 id="result-title" className="text-ink-900 mt-1 text-2xl">
          {copy.resultTitle}
        </h1>
        <p className="text-ink-500 text-sm">{paper.titleEn}</p>
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="font-display text-ink-900 text-4xl font-bold tabular-nums">{copy.score(score, max)}</p>
            <p className="text-ink-500 text-xs">{copy.scoreLabel}</p>
          </div>
          {max > 0 && <p className="font-display text-accent text-2xl font-bold tabular-nums">{formatPercent((score / max) * 100)}</p>}
        </div>
        {(attempt.unmarked ?? 0) > 0 && <p className="text-ink-700 mt-3 text-sm">{copy.unmarked(attempt.unmarked ?? 0)}</p>}
        <p className="text-ink-500 mt-3 text-xs">
          {attempt.timing === "practice" ? copy.practiceNote(attempt.durationMinutes) : copy.officialNote(attempt.durationMinutes)} {copy.notOfficial}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to={`/bacii/papers/${paper.id}/exam`} className="btn-primary">
            {copy.tryAgain}
          </Link>
        </div>
      </section>

      <GradeEstimateCard score={score} max={max} unmarked={attempt.unmarked ?? 0} />

      {missed > 0 && (
        <p className="bg-surface-muted text-ink-700 mb-5 rounded-md px-4 py-3 text-sm">
          {t.bacii.mistakes.fromResult(missed)}{" "}
          <Link to="/bacii/mistakes" className="text-accent font-semibold hover:underline">
            {t.bacii.mistakes.openNotebook}
          </Link>
        </p>
      )}

      <h2 className="font-display text-ink-900 mb-2 text-lg font-bold">{copy.review}</h2>
      <ol className="space-y-3">
        {paper.questions.map((entry) => {
          const answer = answerOf.get(entry.question.id);
          const solution = entry.question.solution;
          const chapter = chapterOf.get(entry.question.chapterId);
          return (
            <li key={entry.question.id} className="card p-4 sm:p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-ink-900 text-base font-bold">{t.bacii.papers.question(entry.position)}</h3>
                <Verdict answer={answer} />
                {answer?.pointsAwarded !== null && answer?.pointsAwarded !== undefined && entry.points !== null && (
                  <span className="text-ink-500 text-xs">{`${answer.pointsAwarded} / ${entry.points}`}</span>
                )}
              </div>
              <MathText text={entry.question.content} className="text-ink-900 text-sm" />
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="bg-surface-muted rounded-md px-3 py-2">
                  <dt className="text-ink-500 text-[11px] font-semibold tracking-wide uppercase">{copy.yourAnswer}</dt>
                  <dd className="text-ink-900 mt-0.5">
                    <GivenAnswer question={entry.question} answer={answer?.answer ?? ""} />
                  </dd>
                </div>
                {solution && (
                  <div className="bg-brand-50 rounded-md px-3 py-2">
                    <dt className="text-accent text-[11px] font-semibold tracking-wide uppercase">{copy.correctAnswer}</dt>
                    <dd className="text-ink-900 mt-0.5">
                      <MathText text={solution.answer} as="span" />
                    </dd>
                  </div>
                )}
              </dl>
              {solution && <SolutionSteps solution={solution} questionText={entry.question.content} subjectKey={subjectKey} chapterKm={chapter?.nameKm ?? null} chapterId={chapter?.id} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
