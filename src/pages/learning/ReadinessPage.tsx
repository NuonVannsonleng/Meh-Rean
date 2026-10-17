import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import masteryRules from "../../data/learning/mastery-rules.json";
import readinessRules from "../../data/learning/readiness-rules.json";
import { t } from "../../i18n/en";
import type { MasteryRules } from "../../lib/mastery";
import { buildReadiness, type Readiness, type ReadinessRules, type Trend } from "../../lib/readiness";
import { getLearningEvents, getMyExamAttempts } from "../../services/api";
import { loadStudyContext, type StudyContext } from "../../services/recommendations";

const copy = t.learning.readiness;
const rules = readinessRules as ReadinessRules;

const LEVEL_STYLE: Record<string, string> = {
  "not-enough-data": "bg-surface-hover text-ink-700",
  early: "bg-ribbon-100 text-ribbon-fg",
  building: "bg-ribbon-50 text-ribbon-fg",
  "on-track": "bg-brand-50 text-accent",
  strong: "bg-brand-600 text-white",
};

const trendText = (trend: Trend) => (trend.state === "up" || trend.state === "down" ? copy.trend[trend.state](trend.change) : copy.trend[trend.state]);

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="bg-surface-hover h-2 overflow-hidden rounded-full">
      <div className="bg-brand-600 h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Exam readiness and analytics (Learning OS 9.1): from the student's own practice, never a predicted result. */
export default function ReadinessPage() {
  const [data, setData] = useState<{ context: StudyContext; readiness: Readiness } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    Promise.all([loadStudyContext(), getLearningEvents(1000), getMyExamAttempts()])
      .then(([context, events, exams]) => setData({ context, readiness: buildReadiness({ topics: context.input.topics, events, exams }, rules, masteryRules as MasteryRules) }))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="container-page max-w-3xl py-8">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={3} variant="block" />
      </div>
    );
  }

  const { context, readiness: r } = data;
  const chapterOf = new Map([...context.topics.values()].map(({ chapter }) => [chapter.id, chapter]));
  const examDays = context.input.examDate ? Math.ceil((Date.parse(`${context.input.examDate}T00:00:00+07:00`) - Date.now()) / 86_400_000) : null;
  const percent = (correct: number, answers: number) => (answers ? `${Math.round((correct / answers) * 100)}%` : "–");
  const weekCells: [string, string, string][] = [
    [copy.week.answers, String(r.week.answers), String(r.week.previous.answers)],
    [copy.week.right, percent(r.week.correct, r.week.answers), percent(r.week.previous.correct, r.week.previous.answers)],
    [copy.week.days, `${r.week.activeDays} / 7`, `${r.week.previous.activeDays} / 7`],
    [copy.week.topics, String(r.week.topics), ""],
    [copy.week.reviews, String(r.week.reviews), ""],
    [copy.week.exams, String(r.week.exams), ""],
  ];

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

      <section className="card mb-4 p-4 sm:p-5" aria-labelledby="readiness-level">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="readiness-level" className={`rounded-full px-3 py-1 text-sm font-bold ${LEVEL_STYLE[r.readiness.level]}`}>
            {copy.levels[r.readiness.level]}
          </h2>
          {r.readiness.score !== null && <span className="font-display text-ink-900 text-2xl font-bold tabular-nums">{copy.score(r.readiness.score)}</span>}
        </div>
        {r.readiness.parts ? (
          <p className="text-ink-700 mt-2 text-sm">
            {copy.parts} {copy.partCoverage(r.readiness.parts.coverage)} · {copy.partMastery(r.readiness.parts.mastery)} · {copy.partExams(r.readiness.parts.exams)}
          </p>
        ) : (
          <p className="text-ink-700 mt-2 text-sm">{copy.needMore(rules.minAnswers - r.readiness.answers)}</p>
        )}
        {examDays !== null && examDays >= 0 && <p className="text-ink-900 mt-1 text-sm font-medium">{copy.examIn(examDays)}</p>}
        <p className="text-ink-500 mt-2 text-xs">{copy.disclaimer}</p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="card p-4" aria-labelledby="readiness-coverage">
          <h2 id="readiness-coverage" className="text-ink-900 mb-1 text-sm font-bold">
            {copy.coverageTitle}
          </h2>
          <p className="text-ink-700 mb-2 text-sm">{copy.coverageLine(r.coverage.practised, r.coverage.labelled, r.coverage.total)}</p>
          <Bar value={(r.coverage.practised / Math.max(1, r.coverage.total)) * 100} label={copy.coverageLine(r.coverage.practised, r.coverage.labelled, r.coverage.total)} />
          <ul className="mt-3 space-y-1.5">
            {r.coverage.byChapter.map((chapter) => (
              <li key={chapter.chapterId} className="text-xs">
                <div className="mb-0.5 flex justify-between gap-2">
                  <span className="text-ink-700 min-w-0 truncate">{chapterOf.get(chapter.chapterId) ? `${chapterOf.get(chapter.chapterId)!.number}. ${chapterOf.get(chapter.chapterId)!.nameEn}` : chapter.chapterId}</span>
                  <span className="text-ink-500 tabular-nums">{copy.chapterLine(chapter.practised, chapter.total)}</span>
                </div>
                <Bar value={(chapter.practised / Math.max(1, chapter.total)) * 100} label={`${chapterOf.get(chapter.chapterId)?.nameEn ?? chapter.chapterId}: ${copy.chapterLine(chapter.practised, chapter.total)}`} />
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-4">
          <section className="card p-4" aria-labelledby="readiness-mastery">
            <h2 id="readiness-mastery" className="text-ink-900 mb-1 text-sm font-bold">
              {copy.masteryTitle}
            </h2>
            {r.mastery.now === null ? (
              <p className="text-ink-700 text-sm">{copy.masteryNone}</p>
            ) : (
              <>
                <p className="text-ink-900 text-sm font-medium">{copy.masteryNow(r.mastery.now)}</p>
                <ul className="text-ink-700 mt-1 space-y-0.5 text-sm">
                  {r.mastery.trends.map((item) => (
                    <li key={item.days} data-trend={item.trend.state}>
                      {copy.trendAgo(item.days)}: {item.then ?? "–"} ({trendText(item.trend)})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="card p-4" aria-labelledby="readiness-exams">
            <h2 id="readiness-exams" className="text-ink-900 mb-1 text-sm font-bold">
              {copy.examsTitle}
            </h2>
            {r.exams.completed.length ? (
              <>
                <ol className="flex h-16 items-end gap-1.5" aria-label={copy.examsTitle}>
                  {r.exams.completed.slice(-8).map((exam) => (
                    <li key={exam.id} className="flex h-full w-6 flex-col items-center justify-end gap-0.5">
                      <span className="text-ink-500 text-[10px] tabular-nums">{copy.examPercent(exam.percent)}</span>
                      <span aria-hidden="true" className="bg-brand-500 block w-full rounded-sm" style={{ height: `${Math.max(6, exam.percent * 0.45)}px` }} />
                    </li>
                  ))}
                </ol>
                <p className="text-ink-700 mt-1 text-sm" data-trend={r.exams.trend.state}>
                  {copy.examsTrend(trendText(r.exams.trend))}
                </p>
              </>
            ) : (
              <p className="text-ink-700 text-sm">{copy.examsNone}</p>
            )}
            <Link to="/bacii/papers" className="text-accent mt-1 inline-block text-sm font-semibold hover:underline">
              {copy.examsLink}
            </Link>
          </section>

          <section className="card p-4" aria-labelledby="readiness-consistency">
            <h2 id="readiness-consistency" className="text-ink-900 mb-1 text-sm font-bold">
              {copy.consistencyTitle}
            </h2>
            <p className="text-ink-700 text-sm">{copy.consistencyLine(r.consistency.activeDays, r.consistency.days)}</p>
            <p className="text-ink-700 text-sm">{copy.weeksLine(r.consistency.goodWeeks, r.consistency.weeks, rules.goodWeekDays)}</p>
          </section>
        </div>
      </div>

      <section className="card mt-4 p-4 sm:p-5" aria-labelledby="readiness-week">
        <h2 id="readiness-week" className="text-ink-900 mb-2 text-sm font-bold">
          {copy.weekTitle}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {weekCells.map(([label, value, previous]) => (
            <div key={label} className="bg-surface-muted rounded-md px-3 py-2">
              <dt className="text-ink-500 text-xs">{label}</dt>
              <dd className="text-ink-900 font-display text-xl font-bold tabular-nums">{value}</dd>
              {previous && <dd className="text-ink-500 text-[11px]">{copy.lastWeek(previous)}</dd>}
            </div>
          ))}
        </dl>
      </section>
      <p className="text-ink-500 mt-3 text-xs">{copy.note}</p>
    </div>
  );
}
