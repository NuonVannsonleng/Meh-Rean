import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon, CheckIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import MasteryBadge from "../../components/MasteryBadge";
import journeyRules from "../../data/learning/journey-rules.json";
import { t } from "../../i18n/en";
import { buildJourney, type Journey, type JourneyRules, type JourneyState, type Milestone } from "../../lib/journey";
import { rankCandidates } from "../../lib/recommend";
import { loadStudyContext, RECOMMENDATION_RULES, type StudyContext } from "../../services/recommendations";

const copy = t.learning.journey;
const STATES: JourneyState[] = ["done", "in-progress", "next", "ready", "later"];
const STATE_STYLE: Record<JourneyState, { chip: string; bar: string }> = {
  done: { chip: "bg-brand-600 text-white", bar: "bg-brand-600" },
  "in-progress": { chip: "bg-brand-50 text-accent", bar: "bg-brand-300" },
  next: { chip: "bg-ribbon-100 text-ribbon-fg", bar: "bg-ribbon-500" },
  ready: { chip: "bg-surface-hover text-ink-700", bar: "bg-ink-400" },
  later: { chip: "bg-surface-muted text-ink-500", bar: "bg-line" },
};

function StateChip({ state }: { state: JourneyState }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATE_STYLE[state].chip}`}>{copy.states[state]}</span>;
}

/** My learning journey (Learning OS 6.1, 6.2): done, in progress, next, reviews and milestones — nothing locked. */
export default function JourneyPage() {
  const [data, setData] = useState<{ context: StudyContext; journey: Journey } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    loadStudyContext()
      .then((context) => {
        const recommended = rankCandidates(context.input, RECOMMENDATION_RULES).map((item) => item.topicId);
        const journey = buildJourney({ topics: context.input.topics, links: context.input.links, mastery: context.input.mastery, reviews: context.input.reviews, recommended }, journeyRules as JourneyRules);
        setData({ context, journey });
      })
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

  const { context, journey } = data;
  const info = (id: string) => context.topics.get(id);
  const chapterName = (id: string) => {
    const chapter = [...context.topics.values()].find((item) => item.chapter.id === id)?.chapter;
    return chapter ? `${chapter.number}. ${chapter.nameEn}` : id;
  };
  const practiceHref = (id: string) => {
    const found = info(id);
    return found ? `/bacii/practice?subject=${encodeURIComponent(found.chapter.subjectId)}&chapter=${encodeURIComponent(found.chapter.id)}&topic=${encodeURIComponent(id)}` : "/bacii/practice";
  };
  const nextTopics = journey.chapters.flatMap((chapter) => chapter.topics).filter((topic) => topic.state === "next");
  const milestoneText = (milestone: Milestone) =>
    milestone.kind === "topics-practised" || milestone.kind === "topics-strong"
      ? copy.milestone[milestone.kind](milestone.target)
      : milestone.kind === "chapter-practised"
        ? copy.milestone["chapter-practised"](chapterName(milestone.chapterId))
        : copy.milestone[milestone.kind];
  // Reached milestones, then only the next target of each kind; chapters once started.
  const started = new Set(journey.chapters.filter((chapter) => chapter.practised > 0).map((chapter) => chapter.chapterId));
  const milestones = journey.milestones.filter((milestone, index, all) => {
    if (milestone.reached) return true;
    if (milestone.kind === "chapter-practised") return started.has(milestone.chapterId);
    return all.findIndex((other) => other.kind === milestone.kind && !other.reached) === index;
  });
  // Chapters with something going on open by default; with nothing yet, the first one.
  const active = (chapter: Journey["chapters"][number]) => chapter.topics.some((topic) => topic.state === "in-progress" || topic.state === "next" || topic.reviewsDue > 0);
  const anyActive = journey.chapters.some(active);

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

      <section className="card mb-4 p-4 sm:p-5" aria-labelledby="journey-summary">
        <h2 id="journey-summary" className="font-display text-ink-900 text-lg font-bold">
          {copy.summary(journey.counts.done, journey.total)}
        </h2>
        <div role="img" aria-label={`${copy.progressLabel}: ${STATES.map((state) => `${copy.states[state]} ${journey.counts[state]}`).join(", ")}`} className="bg-surface-hover mt-2 flex h-3 overflow-hidden rounded-full">
          {STATES.map((state) => journey.counts[state] > 0 && <span key={state} className={STATE_STYLE[state].bar} style={{ width: `${(journey.counts[state] / journey.total) * 100}%` }} />)}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-hidden="true">
          {STATES.map((state) => (
            <li key={state} className="text-ink-700 inline-flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATE_STYLE[state].bar}`} />
              {copy.states[state]} <span className="tabular-nums">{journey.counts[state]}</span>
            </li>
          ))}
        </ul>
        {journey.reviewsDue > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-900 font-medium">{copy.reviewsDue(journey.reviewsDue)}</span>
            <Link to="/bacii/mistakes" className="btn-primary h-8 px-3 text-sm">
              {copy.reviewNow}
            </Link>
          </p>
        )}
      </section>

      <section className="card mb-4 p-4 sm:p-5" aria-labelledby="journey-next">
        <h2 id="journey-next" className="font-display text-ink-900 mb-2 text-lg font-bold">
          {copy.nextTitle}
        </h2>
        {nextTopics.length ? (
          <ul className="grid gap-2 sm:grid-cols-3">
            {nextTopics.map((topic) => (
              <li key={topic.topicId} className="border-line rounded-lg border p-3">
                <Link to={`/learning/topics/${encodeURIComponent(topic.topicId)}`} className="text-ink-900 block font-medium hover:underline" lang="km">
                  {info(topic.topicId)?.topic.nameKm ?? topic.topicId}
                </Link>
                <p className="text-ink-500 text-xs">{info(topic.topicId) ? `${info(topic.topicId)!.chapter.number}. ${info(topic.topicId)!.topic.nameEn}` : ""}</p>
                <Link to={practiceHref(topic.topicId)} className="text-accent mt-1 inline-block text-sm font-semibold hover:underline">
                  {copy.practise}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-700 text-sm">{copy.nextEmpty}</p>
        )}
      </section>

      <section className="card mb-4 p-4 sm:p-5" aria-labelledby="journey-milestones">
        <h2 id="journey-milestones" className="font-display text-ink-900 mb-2 text-lg font-bold">
          {copy.milestonesTitle}
        </h2>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {milestones.map((milestone) => (
            <li key={milestone.id} className={`flex items-center gap-2 text-sm ${milestone.reached ? "text-ink-900" : "text-ink-500"}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${milestone.reached ? "bg-brand-600 text-white" : "border-line border"}`}>{milestone.reached && <CheckIcon className="h-3.5 w-3.5" />}</span>
              <span className="min-w-0 flex-1">{milestoneText(milestone)}</span>
              <span className="text-xs tabular-nums">
                {"target" in milestone && !milestone.reached ? copy.milestoneProgress(milestone.count, milestone.target) : <span className="sr-only">{milestone.reached ? copy.reached : copy.notYet}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-3">
        {journey.chapters.map((chapter, index) => {
          const first = info(chapter.topics[0]?.topicId ?? "")?.chapter;
          return (
            <details key={chapter.chapterId} open={active(chapter) || (!anyActive && index === 0)} className="card group">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-4">
                <span className="min-w-0 flex-1">
                  <span className="text-ink-900 block font-semibold">{first ? `${first.number}. ${first.nameEn}` : chapter.chapterId}</span>
                  <span className="text-ink-500 block text-xs" lang="km">
                    {first?.nameKm}
                  </span>
                </span>
                <span className="text-ink-500 text-xs whitespace-nowrap">{copy.chapterLine(chapter.practised, chapter.topics.length)}</span>
              </summary>
              <ol className="divide-line border-line divide-y border-t px-4">
                {chapter.topics.map((topic) => {
                  const found = info(topic.topicId);
                  return (
                    <li key={topic.topicId} className="py-2.5" data-state={topic.state}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/learning/topics/${encodeURIComponent(topic.topicId)}`} className="min-w-0 flex-1 basis-full hover:underline sm:basis-0">
                          <span className="text-ink-900 block text-sm font-medium" lang="km">
                            {found?.topic.nameKm ?? topic.topicId}
                          </span>
                          <span className="text-ink-500 block text-xs">{found?.topic.nameEn}</span>
                        </Link>
                        <StateChip state={topic.state} />
                        {topic.label !== "unknown" && <MasteryBadge label={topic.label} />}
                        {topic.reviewsDue > 0 && (
                          <Link to="/bacii/mistakes" className="text-ribbon-fg text-xs font-semibold hover:underline">
                            {copy.reviews(topic.reviewsDue)}
                          </Link>
                        )}
                        <Link to={practiceHref(topic.topicId)} className="text-accent text-xs font-semibold hover:underline">
                          {copy.practise}
                        </Link>
                      </div>
                      {topic.buildsOn.length > 0 && (
                        <p className="text-ink-500 mt-1 text-xs">
                          {copy.buildsOn}{" "}
                          {topic.buildsOn.map((id, i) => (
                            <span key={id}>
                              {i > 0 && ", "}
                              <Link to={`/learning/topics/${encodeURIComponent(id)}`} className="hover:underline">
                                {info(id)?.topic.nameEn ?? id}
                              </Link>
                            </span>
                          ))}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
      </div>
      <p className="text-ink-500 mt-3 text-xs">{copy.note}</p>
    </div>
  );
}
