import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import MasteryBadge from "../../components/MasteryBadge";
import PracticeQuestion from "../../components/PracticeQuestion";
import adaptiveRules from "../../data/learning/adaptive-rules.json";
import { useCurriculum } from "../../hooks/useCurriculum";
import { t } from "../../i18n/en";
import { lastAnswered, nextDifficulty, pickNext, PRACTICE_MODES, sessionPlan, startingDifficulty, topicsForTurn, type AdaptiveRules, type PracticeMode, type SessionPlan } from "../../lib/adaptive";
import type { TopicMastery } from "../../lib/mastery";
import { rankCandidates } from "../../lib/recommend";
import { getLearningEvents, getQuestions, getTopicMastery } from "../../services/api";
import { loadStudyContext, RECOMMENDATION_RULES, type StudyContext } from "../../services/recommendations";
import type { Question } from "../../types";

const copy = t.learning.practice;
const rules = adaptiveRules as AdaptiveRules;

type Answer = { questionId: string; topicId: string; correct: boolean | null };

function ModePicker() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label={copy.chooseMode}>
      {PRACTICE_MODES.map((mode) => (
        <li key={mode}>
          <Link to={`/learning/practice?mode=${mode}`} className="card press hover:border-brand-500 flex h-full flex-col gap-1 p-4 transition-colors">
            <span className="font-display text-ink-900 text-base font-bold">{copy.modes[mode].name}</span>
            <span className="text-ink-700 text-sm">{copy.modes[mode].hint}</span>
            <span className="text-ink-500 text-xs">{copy.upTo(rules.modes[mode].count)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Results({ answers, before, topics, mode, onAgain }: { answers: Answer[]; before: TopicMastery[]; topics: StudyContext["topics"]; mode: PracticeMode; onAgain: () => void }) {
  const [after, setAfter] = useState<TopicMastery[] | null>(null);
  useEffect(() => {
    getTopicMastery()
      .then(setAfter)
      .catch(() => setAfter([]));
  }, []);
  const answered = answers.filter((answer) => answer.correct !== null);
  const touched = [...new Set(answered.map((answer) => answer.topicId))];
  const of = (list: TopicMastery[] | null, id: string) => list?.find((item) => item.topicId === id);
  return (
    <section className="card p-4 sm:p-5" aria-labelledby="practice-results">
      <h2 id="practice-results" className="font-display text-ink-900 text-xl font-bold">
        {copy.results.title}
      </h2>
      <p className="text-ink-900 font-display mt-1 text-2xl font-bold tabular-nums">{copy.results.score(answered.filter((answer) => answer.correct).length, answered.length)}</p>
      {answers.length > answered.length && <p className="text-ink-500 text-sm">{copy.results.skipped(answers.length - answered.length)}</p>}
      {touched.length > 0 && (
        <>
          <h3 className="text-ink-900 mt-4 mb-2 text-sm font-bold">{copy.results.topics}</h3>
          {!after ? (
            <LoadingState count={1} variant="block" />
          ) : (
            <ul className="divide-line divide-y">
              {touched.map((id) => {
                const found = topics.get(id);
                const was = of(before, id);
                const now = of(after, id);
                return (
                  <li key={id} className="flex flex-wrap items-center gap-2 py-2">
                    <Link to={`/learning/topics/${encodeURIComponent(id)}`} className="min-w-0 flex-1 hover:underline">
                      <span className="text-ink-900 block truncate text-sm font-medium" lang="km">
                        {found?.topic.nameKm ?? id}
                      </span>
                      <span className="text-ink-500 block truncate text-xs">{found ? `${found.chapter.number}. ${found.topic.nameEn}` : ""}</span>
                    </Link>
                    <span className="text-ink-500 text-xs">{copy.results.before}</span>
                    <MasteryBadge label={was?.label ?? "unknown"} />
                    <span className="text-ink-500 text-xs">{copy.results.after}</span>
                    <MasteryBadge label={now?.label ?? "unknown"} />
                    {now?.label !== "unknown" && now?.score != null && <span className="text-ink-700 text-xs tabular-nums">{t.learning.mastery.score(now.score)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <p className="text-ink-500 mt-3 text-xs">{copy.results.note}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onAgain} className="btn-primary">
          {copy.results.again}
        </button>
        <Link to="/learning/practice" className="btn-secondary">
          {copy.results.otherMode}
        </Link>
        <Link to="/bacii" className="btn-secondary">
          {copy.results.back}
        </Link>
      </div>
      <span className="sr-only">{copy.modes[mode].name}</span>
    </section>
  );
}

function Session({ mode, onAgain }: { mode: PracticeMode; onAgain: () => void }) {
  const { subjects } = useCurriculum();
  const [setup, setSetup] = useState<{ context: StudyContext; plan: SessionPlan; pool: Question[]; last: Map<string, number> } | null>(null);
  const [failed, setFailed] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [current, setCurrent] = useState<Question | null>(null);
  const [checked, setChecked] = useState(false);
  const [difficulty, setDifficulty] = useState(rules.startDifficulty);
  const [done, setDone] = useState(false);
  const [ranOut, setRanOut] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const context = await loadStudyContext();
      const [lists, events] = await Promise.all([Promise.all(context.subjectIds.map((subjectId) => getQuestions({ subjectId }))), getLearningEvents(1000)]);
      const recommended = rankCandidates(context.input, RECOMMENDATION_RULES).map((item) => item.topicId);
      const plan = sessionPlan(mode, { topics: context.input.topics, links: context.input.links, mastery: context.input.mastery, recommended }, rules);
      if (!active) return;
      const first = context.input.mastery.find((item) => item.topicId === plan.topics[0]);
      setDifficulty(startingDifficulty(first, rules, plan.difficultyOffset));
      setSetup({ context, plan, pool: lists.flat(), last: lastAnswered(events) });
    })().catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [mode]);

  const pick = useCallback(
    (asked: Answer[], level: number) => {
      if (!setup) return null;
      const next = pickNext({ pool: setup.pool, topics: topicsForTurn(setup.plan, asked.map((answer) => answer.topicId)), difficulty: level, asked: new Set(asked.map((answer) => answer.questionId)), lastAnswered: setup.last }, rules);
      return next ? (setup.pool.find((question) => question.id === next.id) ?? null) : null;
    },
    [setup],
  );
  useEffect(() => {
    if (setup && !current && !done && answers.length === 0) setCurrent(pick([], difficulty));
  }, [setup, current, done, answers.length, pick, difficulty]);

  const advance = (list: Answer[], level: number) => {
    const next = list.length >= setup!.plan.count ? null : pick(list, level);
    setChecked(false);
    if (next) setCurrent(next);
    else {
      setRanOut(list.length < setup!.plan.count);
      setDone(true);
    }
  };
  const skip = () => {
    const list = [...answers, { questionId: current!.id, topicId: current!.topicId!, correct: null }];
    setAnswers(list);
    advance(list, difficulty);
  };
  const onChecked = (correct: boolean) => {
    if (checked) return;
    setChecked(true);
    setAnswers((list) => [...list, { questionId: current!.id, topicId: current!.topicId!, correct }]);
    setDifficulty((level) => nextDifficulty(level, correct, rules));
  };

  const chapterOf = useMemo(() => (setup ? new Map([...setup.context.topics.values()].map(({ chapter }) => [chapter.id, chapter])) : new Map()), [setup]);
  if (failed) return <ErrorState onRetry={() => window.location.reload()} />;
  if (!setup) return <LoadingState count={2} variant="block" />;
  if (done || (answers.length === 0 && !current)) {
    if (answers.length === 0) return <p className="card text-ink-700 p-4 text-sm">{copy.emptyPlan[mode] ?? copy.emptyPlan.other}</p>;
    return (
      <>
        {ranOut && <p className="text-ink-500 mb-2 text-sm">{copy.ranOut}</p>}
        <Results answers={answers} before={setup.context.input.mastery} topics={setup.context.topics} mode={mode} onAgain={onAgain} />
      </>
    );
  }
  if (!current) return <LoadingState count={2} variant="block" />;
  const chapter = current.chapterId ? chapterOf.get(current.chapterId) : undefined;
  const subject = subjects.find((item) => item.id === chapter?.subjectId);
  const index = answers.length + (checked ? 0 : 1);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-ink-900 font-semibold">{copy.progress(Math.min(index, setup.plan.count), setup.plan.count)}</span>
        <span className="text-ink-500 text-xs" data-testid="practice-level">
          {copy.level(difficulty)}
        </span>
      </div>
      <ol>
        <PracticeQuestion key={current.id} question={current} number={answers.length + (checked ? 0 : 1)} chapter={chapter} subjectKey={subject?.subjectKey ?? ""} onChecked={(correct) => onChecked(correct)} />
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {checked ? (
          <button type="button" onClick={() => advance(answers, difficulty)} className="btn-primary">
            {answers.length >= setup.plan.count ? copy.finish : copy.next}
          </button>
        ) : (
          <button type="button" onClick={skip} className="btn-secondary">
            {copy.skip}
          </button>
        )}
        {answers.length > 0 && !checked && (
          <button type="button" onClick={() => setDone(true)} className="btn-ghost">
            {copy.finish}
          </button>
        )}
      </div>
      {current.origin === "demo" && <p className="text-ink-500 mt-3 text-xs">{copy.demoNote}</p>}
    </>
  );
}

/** Adaptive practice (Learning OS 5.3): pick a mode, answer one question at a time, see how your estimates moved. */
export default function AdaptivePractice() {
  const [params] = useSearchParams();
  const [run, setRun] = useState(0);
  const raw = params.get("mode");
  const mode = PRACTICE_MODES.includes(raw as PracticeMode) ? (raw as PracticeMode) : null;
  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
  }, []);
  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to={mode ? "/learning/practice" : "/bacii"} className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {mode ? copy.chooseMode : t.bacii.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">
        {mode ? copy.modes[mode].name : copy.title} <span className="text-ink-500 text-base font-normal" lang="km">{`· ${copy.titleKm}`}</span>
      </h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{mode ? copy.modes[mode].hint : copy.intro}</p>
      {mode ? <Session key={`${mode}:${run}`} mode={mode} onAgain={() => setRun((value) => value + 1)} /> : <ModePicker />}
    </div>
  );
}
