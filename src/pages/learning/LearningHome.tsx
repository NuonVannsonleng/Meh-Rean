import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { BookmarkIcon, BulbIcon, CalendarIcon, FileTextIcon, GraduationIcon, PenIcon, TableIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import MasteryBadge, { MASTERY_LABELS } from "../../components/MasteryBadge";
import journeyRules from "../../data/learning/journey-rules.json";
import masteryRules from "../../data/learning/mastery-rules.json";
import readinessRules from "../../data/learning/readiness-rules.json";
import revisionRules from "../../data/learning/revision-rules.json";
import { t } from "../../i18n/en";
import { buildJourney, type JourneyRules } from "../../lib/journey";
import type { MasteryRules } from "../../lib/mastery";
import { buildReadiness, type ReadinessRules } from "../../lib/readiness";
import { rankCandidates, recommend } from "../../lib/recommend";
import { reasonText } from "../../lib/recommendText";
import { getDailyStreak, getFlashcards, getMyExamAttempts } from "../../services/api";
import { loadStudyContext, RECOMMENDATION_RULES, type StudyContext } from "../../services/recommendations";
import type { DailyStreak, ExamAttempt, Flashcard } from "../../types";

const copy = t.learning.home;
const DAY = 86_400_000;

function Card({ id, title, titleKm, link, children }: { id: string; title: string; titleKm?: string; link?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="card flex flex-col p-4" aria-labelledby={`home-${id}`}>
      <h2 id={`home-${id}`} className="text-ink-900 mb-2 text-sm font-bold">
        {title} {titleKm && <span className="text-ink-500 font-normal" lang="km">{`· ${titleKm}`}</span>}
      </h2>
      <div className="flex-1">{children}</div>
      {link && (
        <Link to={link.to} className="text-accent mt-2 text-sm font-semibold hover:underline">
          {link.label}
        </Link>
      )}
    </section>
  );
}

/** My learning (Learning OS 10.1): today's focus and every part of the Learning OS at a glance. */
export default function LearningHome() {
  const [data, setData] = useState<{ context: StudyContext; exams: ExamAttempt[]; cards: Flashcard[]; streak: DailyStreak | null } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    // No event history here: the readiness card uses the stored estimates (slow networks).
    Promise.all([loadStudyContext(), getMyExamAttempts(), getFlashcards().catch(() => []), getDailyStreak().catch(() => null)])
      .then(([context, exams, cards, streak]) => setData({ context, exams, cards, streak }))
      .catch(() => setFailed(true));
  }, []);

  const derived = useMemo(() => {
    if (!data) return null;
    const { context, exams, cards } = data;
    const now = Date.now();
    const items = recommend(context.input, RECOMMENDATION_RULES);
    const ranked = rankCandidates(context.input, RECOMMENDATION_RULES).map((item) => item.topicId);
    const journey = buildJourney({ topics: context.input.topics, links: context.input.links, mastery: context.input.mastery, reviews: context.input.reviews, recommended: ranked }, journeyRules as JourneyRules);
    const readiness = buildReadiness({ topics: context.input.topics, events: [], exams, mastery: context.input.mastery }, readinessRules as ReadinessRules, masteryRules as MasteryRules);
    // Notebook reviews and flashcards: the revision page holds both.
    const dueAt = [...context.input.reviews.map((review) => review.nextReviewAt), ...cards.map((card) => card.nextReviewAt)].map((at) => (at ? Date.parse(at) : null)).filter((at): at is number => at !== null);
    const due = dueAt.filter((at) => at <= now).length;
    const soon = dueAt.filter((at) => at > now && at - now <= revisionRules.upcomingDays * DAY).length;
    const labels = new Map(MASTERY_LABELS.map((label) => [label, 0]));
    for (const item of context.input.mastery) if (item.label !== "unknown") labels.set(item.label, (labels.get(item.label) ?? 0) + 1);
    return { items, journey, readiness, due, soon, labels };
  }, [data]);

  if (failed) {
    return (
      <div className="container-page max-w-4xl py-8">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!data || !derived) {
    return (
      <div className="container-page max-w-4xl py-8">
        <LoadingState count={4} variant="block" />
      </div>
    );
  }

  const { context, streak } = data;
  const { items, journey, readiness, due, soon, labels } = derived;
  const language = context.language;
  const nameOf = (id: string) => {
    const found = context.topics.get(id);
    return found ? (language === "km" ? found.topic.nameKm : found.topic.nameEn) : id;
  };
  const practiceHref = (id: string) => {
    const found = context.topics.get(id);
    return found ? `/bacii/practice?subject=${encodeURIComponent(found.chapter.subjectId)}&chapter=${encodeURIComponent(found.chapter.id)}&topic=${encodeURIComponent(id)}` : "/learning/practice";
  };
  const top = items.find((item) => item.action.type !== "review");
  const focusLink = due > 0 ? "/learning/revision" : top ? practiceHref(top.topicId) : "/learning/practice?mode=mixed";
  const labelled = [...labels.values()].reduce((sum, count) => sum + count, 0);
  const actions: [string, string, typeof PenIcon][] = [
    [copy.actions.practice, "/learning/practice", PenIcon],
    [copy.actions.companion, "/learning/companion", BulbIcon],
    [copy.actions.map, "/learning/map", TableIcon],
    [copy.actions.notebook, "/bacii/mistakes", FileTextIcon],
    [copy.actions.flashcards, "/learning/flashcards", BookmarkIcon],
    [copy.actions.exams, "/bacii/papers", GraduationIcon],
    [copy.actions.history, "/learning/history", CalendarIcon],
  ];

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <h1 className="text-ink-900 text-2xl sm:text-3xl">
        {copy.title} <span className="text-ink-500 text-base font-normal" lang="km">{`· ${copy.titleKm}`}</span>
      </h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.intro}</p>

      <section className="card border-brand-500 mb-4 p-4 sm:p-5" aria-labelledby="home-focus">
        <h2 id="home-focus" className="font-display text-ink-900 text-lg font-bold">
          {copy.focusTitle} <span className="text-ink-500 text-sm font-normal" lang="km">{`· ${copy.focusTitleKm}`}</span>
        </h2>
        <p className="text-ink-900 mt-1 text-sm" data-testid="home-focus-text">
          {due > 0 ? copy.focusReview(due) : top ? (top.reasons[0].code === "start-here" ? copy.focusStart(nameOf(top.topicId)) : `${nameOf(top.topicId)} — ${reasonText(top.reasons[0], language, nameOf)}`) : copy.focusNone}
          {due > 0 && top && ` ${copy.focusTopic(nameOf(top.topicId))}`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link to={focusLink} className="btn-primary">
            {copy.go}
          </Link>
          <Link to="/bacii/today" className="text-accent text-sm font-semibold hover:underline">
            {copy.daily(streak?.current ?? 0, streak?.answeredToday ?? false)}
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card id="next" title={copy.nextTitle} titleKm={t.learning.next.titleKm} link={{ to: "/bacii", label: copy.allSuggestions }}>
          {items.length ? (
            <ol className="space-y-2">
              {items.slice(0, 3).map((item) => (
                <li key={item.topicId} className="text-sm">
                  <Link to={`/learning/topics/${encodeURIComponent(item.topicId)}`} className="text-ink-900 font-medium hover:underline" lang={language}>
                    {nameOf(item.topicId)}
                  </Link>
                  <p className="text-ink-500 text-xs" lang={language}>
                    {reasonText(item.reasons[0], language, nameOf)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ink-700 text-sm">{t.learning.next.empty}</p>
          )}
        </Card>

        <Card id="mastery" title={copy.masteryTitle} link={{ to: "/learning/profile", label: copy.masteryLink }}>
          {labelled ? (
            <ul className="flex flex-wrap gap-1.5">
              {MASTERY_LABELS.filter((label) => label !== "unknown" && (labels.get(label) ?? 0) > 0).map((label) => (
                <li key={label} className="flex items-center gap-1">
                  <MasteryBadge label={label} />
                  <span className="text-ink-700 text-xs tabular-nums">{labels.get(label)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-700 text-sm">{copy.masteryNone}</p>
          )}
        </Card>

        <Card id="revision" title={copy.revisionTitle} link={{ to: "/learning/revision", label: copy.revisionLink }}>
          <p className="text-ink-900 text-sm">{copy.revisionLine(due, soon)}</p>
        </Card>

        <Card id="journey" title={copy.journeyTitle} link={{ to: "/learning/journey", label: copy.journeyLink }}>
          <p className="text-ink-900 text-sm">{copy.journeyLine(journey.counts.done, journey.total)}</p>
          <div role="img" aria-label={copy.journeyLine(journey.counts.done, journey.total)} className="bg-surface-hover mt-2 h-2 overflow-hidden rounded-full">
            <div className="bg-brand-600 h-full" style={{ width: `${(journey.counts.done / Math.max(1, journey.total)) * 100}%` }} />
          </div>
          {journey.counts.next > 0 && (
            <p className="text-ink-500 mt-2 text-xs" lang={language}>
              {t.learning.journey.states.next}:{" "}
              {journey.chapters
                .flatMap((chapter) => chapter.topics)
                .filter((topic) => topic.state === "next")
                .map((topic) => nameOf(topic.topicId))
                .join(language === "km" ? " · " : ", ")}
            </p>
          )}
        </Card>

        <Card id="readiness" title={copy.readinessTitle} link={{ to: "/learning/readiness", label: copy.readinessLink }}>
          <p className="text-ink-900 text-sm font-semibold">
            {t.learning.readiness.levels[readiness.readiness.level]}
            {readiness.readiness.score !== null && <span className="text-ink-700 ml-2 font-normal tabular-nums">{t.learning.readiness.score(readiness.readiness.score)}</span>}
          </p>
          {readiness.readiness.score === null && <p className="text-ink-500 text-xs">{t.learning.readiness.needMore(readinessRules.minAnswers - readiness.readiness.answers)}</p>}
        </Card>

        <Card id="actions" title={copy.actionsTitle}>
          <ul className="grid grid-cols-2 gap-2">
            {actions.map(([label, to, Icon]) => (
              <li key={to}>
                <Link to={to} className="border-line hover:border-ink-400 flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium">
                  <Icon className="text-accent h-4 w-4 shrink-0" />
                  <span className="min-w-0">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="text-ink-500 mt-4 text-xs">{copy.note}</p>
    </div>
  );
}
