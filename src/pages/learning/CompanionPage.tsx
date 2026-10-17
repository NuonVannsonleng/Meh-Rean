import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import companionRules from "../../data/learning/companion-rules.json";
import { t } from "../../i18n/en";
import { planSession, progressFacts, type CompanionRules, type PlanStep } from "../../lib/companion";
import { stepText, summaryLines } from "../../lib/companionText";
import { activitySummary } from "../../lib/learningProfile";
import { recommend, type RecommendationWithAction } from "../../lib/recommend";
import { reasonText } from "../../lib/recommendText";
import { askCompanion, LookupError, type CompanionAnswer } from "../../lib/bacii";
import { getLearningEvents } from "../../services/api";
import { loadStudyContext, RECOMMENDATION_RULES, type StudyContext } from "../../services/recommendations";
import type { LearningEvent } from "../../types";

const copy = t.learning.companion;
const rules = companionRules as CompanionRules;
const MINUTES = [15, 20, 30, 45, 60, 90];

/** Study companion (Learning OS 8.1): summary, why these suggestions, a session plan — from rules, no AI. */
export default function CompanionPage() {
  const [data, setData] = useState<{ context: StudyContext; items: RecommendationWithAction[]; events: LearningEvent[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [ai, setAi] = useState<Partial<Record<CompanionAnswer["kind"], CompanionAnswer>>>({});
  const [asking, setAsking] = useState<CompanionAnswer["kind"] | null>(null);
  const [aiProblem, setAiProblem] = useState<Partial<Record<CompanionAnswer["kind"], string>>>({});

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    Promise.all([loadStudyContext(), getLearningEvents(200)])
      .then(([context, events]) => {
        setData({ context, items: recommend(context.input, RECOMMENDATION_RULES), events });
        setMinutes((current) => current ?? context.sessionMinutes ?? rules.defaultMinutes);
      })
      .catch(() => setFailed(true));
  }, []);

  const derived = useMemo(() => {
    if (!data || minutes === null) return null;
    const { context, items, events } = data;
    const now = new Date();
    const reviewsDue = context.input.reviews.filter((review) => review.nextReviewAt && Date.parse(review.nextReviewAt) <= now.getTime()).length;
    const facts = progressFacts({ topicIds: context.input.topics.map((topic) => topic.id), mastery: context.input.mastery, reviewsDue, activity: activitySummary(events, now), examDate: context.input.examDate, now });
    const plan = planSession({ minutes, reviewsDue, recommendations: items }, rules);
    return { facts, plan };
  }, [data, minutes]);

  if (failed) {
    return (
      <div className="container-page max-w-3xl py-8">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data || !derived || minutes === null) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={3} variant="block" />
      </div>
    );
  }

  const { context, items } = data;
  const language = context.language;
  const nameOf = (id: string) => {
    const found = context.topics.get(id);
    return found ? (language === "km" ? found.topic.nameKm : found.topic.nameEn) : id;
  };
  const stepLink = (step: PlanStep): { href: string; external: boolean } => {
    if (step.activity === "review") return { href: "/learning/revision", external: false };
    const item = items.find((entry) => entry.topicId === step.topicId);
    if (step.activity === "watch" && item?.action.type === "video") return { href: `https://www.youtube.com/watch?v=${encodeURIComponent(item.action.id)}`, external: true };
    if (step.activity === "read" && item?.action.type === "note") return { href: `/post/${encodeURIComponent(item.action.id)}`, external: false };
    const found = step.topicId ? context.topics.get(step.topicId) : undefined;
    return found
      ? { href: `/bacii/practice?subject=${encodeURIComponent(found.chapter.subjectId)}&chapter=${encodeURIComponent(found.chapter.id)}&topic=${encodeURIComponent(found.topic.id)}`, external: false }
      : { href: "/learning/practice?mode=recommended", external: false };
  };
  const ask = async (kind: CompanionAnswer["kind"]) => {
    setAsking(kind);
    setAiProblem((map) => ({ ...map, [kind]: undefined }));
    try {
      const recommendations = items.map((item) => ({
        topicId: item.topicId,
        reasons: item.reasons.map((reason) => reason.code),
        neededFor: item.reasons.find((reason) => reason.code === "needed-for")?.topicId,
      }));
      const answer = await askCompanion(kind, recommendations, minutes);
      setAi((map) => ({ ...map, [kind]: answer }));
    } catch (error) {
      setAiProblem((map) => ({ ...map, [kind]: `${error instanceof LookupError || error instanceof Error ? error.message : String(error)} ${copy.fallback}` }));
    } finally {
      setAsking(null);
    }
  };
  // Asks for one part; the AI's words sit above Meh Rean's own, which always stay.
  const aiPart = (kind: CompanionAnswer["kind"]) => {
    const answer = ai[kind];
    return (
      <div className="mt-3">
        {answer && (
          <div className="bg-ribbon-50 rounded-md p-3" data-testid={`ai-${kind}`}>
            <p className="text-ribbon-fg mb-1 text-[11px] font-semibold">{copy.aiLabel(answer.model)}</p>
            <p className="text-ink-900 text-sm whitespace-pre-line" lang={language}>
              {answer.text}
            </p>
            {kind === "plan" && <p className="text-ink-500 mt-1 text-xs">{answer.steps ? copy.aiPlanKept : copy.aiPlanDropped}</p>}
          </div>
        )}
        {aiProblem[kind] && (
          <p role="alert" className="text-ink-700 text-xs">
            {aiProblem[kind]}
          </p>
        )}
        <button type="button" onClick={() => void ask(kind)} disabled={asking !== null} className="btn-ghost text-accent mt-1 h-8 px-2 text-xs">
          {asking === kind ? copy.asking : copy.ask}
        </button>
      </div>
    );
  };
  // A sound AI plan replaces the list; Meh Rean's own stays otherwise.
  const shownPlan: PlanStep[] = ai.plan?.steps && ai.plan.minutes === minutes ? ai.plan.steps : derived.plan;
  const first = shownPlan.find((step) => step.activity !== "break");
  const firstLink = first ? stepLink(first) : null;

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">
        {copy.title} <span className="text-ink-500 text-base font-normal" lang="km">{`· ${copy.titleKm}`}</span>
      </h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.intro}</p>

      <section className="card mb-4 p-4 sm:p-5" aria-labelledby="companion-summary">
        <h2 id="companion-summary" className="font-display text-ink-900 mb-2 text-lg font-bold">
          {copy.summaryTitle}
        </h2>
        <ul className="text-ink-700 space-y-1 text-sm" lang={language}>
          {summaryLines(derived.facts, language, nameOf).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {aiPart("summary")}
      </section>

      <section className="card mb-4 p-4 sm:p-5" aria-labelledby="companion-explain">
        <h2 id="companion-explain" className="font-display text-ink-900 mb-2 text-lg font-bold">
          {copy.explainTitle}
        </h2>
        {items.length ? (
          <ol className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.topicId}>
                <Link to={`/learning/topics/${encodeURIComponent(item.topicId)}`} className="text-ink-900 font-medium hover:underline" lang={language}>
                  {nameOf(item.topicId)}
                </Link>
                <span className="text-ink-700" lang={language}>
                  {" — "}
                  {item.reasons.map((reason) => reasonText(reason, language, nameOf)).join(" ")}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-ink-700 text-sm">{copy.noSuggestions}</p>
        )}
        {items.length > 0 && aiPart("explain")}
      </section>

      <section className="card mb-4 p-4 sm:p-5" aria-labelledby="companion-plan">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="companion-plan" className="font-display text-ink-900 text-lg font-bold">
            {copy.planTitle}
          </h2>
          <label className="text-ink-700 flex items-center gap-2 text-sm">
            {copy.minutesLabel}
            <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="input h-9 w-auto text-sm">
              {[...new Set([...MINUTES, minutes])]
                .sort((a, b) => a - b)
                .map((value) => (
                  <option key={value} value={value}>
                    {copy.minutes(value)}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <ol className="divide-line divide-y" data-testid="companion-plan">
          {shownPlan.map((step, index) => (
            <li key={index} className="flex items-center gap-3 py-2 text-sm" data-activity={step.activity}>
              <span className="bg-surface-hover text-ink-900 w-16 shrink-0 rounded-md px-2 py-1 text-center text-xs font-semibold tabular-nums">{copy.minutes(step.minutes)}</span>
              <span className="text-ink-900 min-w-0 flex-1" lang={language}>
                {stepText(step, language, nameOf)}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-ink-500 mt-1 text-xs">{copy.totalMinutes(shownPlan.reduce((sum, step) => sum + step.minutes, 0))}</p>
        {aiPart("plan")}
        {firstLink &&
          (firstLink.external ? (
            <a href={firstLink.href} target="_blank" rel="noreferrer" className="btn-primary mt-3">
              {copy.startPlan}
            </a>
          ) : (
            <Link to={firstLink.href} className="btn-primary mt-3">
              {copy.startPlan}
            </Link>
          ))}
      </section>
      <p className="text-ink-500 text-xs">{copy.fromRules}</p>
      <p className="text-ink-500 mt-1 text-xs">{copy.askNote}</p>
    </div>
  );
}
