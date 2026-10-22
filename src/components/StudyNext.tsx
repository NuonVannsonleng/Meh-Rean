import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import { reasonSignature, type RecommendationAction, type RecommendationWithAction } from "../lib/recommend";
import { reasonText } from "../lib/recommendText";
import { getRecommendations, RECOMMENDATION_RULES, type StudyNext as StudyNextData } from "../services/recommendations";
import { BulbIcon, CloseIcon, ExternalLinkIcon } from "./Icons";
import LoadingState from "./LoadingState";

const copy = t.learning.next;
const HUB_LIMIT = 3;
type Snooze = { topicId: string; signature: string; until: string };

// "Not now" is a convenience on this device only; nothing depends on it.
const snoozeKey = (userId: string) => `meh-rean:next-snoozed:${userId}`;
function readSnoozed(userId: string): Snooze[] {
  try {
    const list = JSON.parse(localStorage.getItem(snoozeKey(userId)) ?? "[]") as Snooze[];
    return Array.isArray(list) ? list.filter((item) => Date.parse(item.until) > Date.now()) : [];
  } catch {
    return [];
  }
}
function writeSnoozed(userId: string, list: Snooze[]) {
  try {
    localStorage.setItem(snoozeKey(userId), JSON.stringify(list));
  } catch {
    // Storage blocked: "Not now" lasts until the page is left.
  }
}

function actionLink(action: RecommendationAction, practiceHref: string) {
  switch (action.type) {
    case "review":
      return { href: "/bacii/mistakes", label: copy.actions.review(action.due), external: false };
    case "practise":
      return { href: practiceHref, label: copy.actions.practise(action.questions), external: false };
    case "video":
      return { href: `https://www.youtube.com/watch?v=${encodeURIComponent(action.id)}`, label: copy.actions.video, external: true };
    case "note":
      return { href: `/post/${encodeURIComponent(action.id)}`, label: copy.actions.note, external: false };
  }
}

/** BacII → "Study next" (Learning OS 4.5): a few suggestions, each with its reasons and one thing to do. */
export default function StudyNext({ userId }: { userId: string }) {
  const [data, setData] = useState<StudyNextData | null>(null);
  const [failed, setFailed] = useState(false);
  const [snoozed, setSnoozed] = useState<Snooze[]>(() => readSnoozed(userId));

  const load = useCallback((list: Snooze[]) => {
    getRecommendations(list)
      .then(setData)
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => load(snoozed), [load, snoozed]);

  const notNow = (item: RecommendationWithAction) => {
    const next = [...readSnoozed(userId), { topicId: item.topicId, signature: reasonSignature(item), until: new Date(Date.now() + RECOMMENDATION_RULES.snoozeDays * 86_400_000).toISOString() }];
    writeSnoozed(userId, next);
    setSnoozed(next);
  };
  const showAll = () => {
    writeSnoozed(userId, []);
    setSnoozed([]);
  };

  if (failed) return null;
  const language = data?.language ?? "km";
  // Hidden at once; the reload that follows fills the place.
  const visible = (data?.items ?? []).filter((item) => !snoozed.some((s) => s.topicId === item.topicId && s.signature === reasonSignature(item)));
  // The top few keep the hub short; "Practise these" covers the whole list.
  const shown = visible.slice(0, HUB_LIMIT);
  const nameOf = (id: string) => {
    const found = data?.topics.get(id);
    return found ? (language === "km" ? found.topic.nameKm : found.topic.nameEn) : id;
  };

  return (
    <section className="card mt-6 p-4 sm:p-5" aria-labelledby="study-next">
      <h2 id="study-next" className="font-display text-ink-900 mb-3 flex items-center gap-2 text-lg font-bold">
        <BulbIcon className="text-accent h-5 w-5 shrink-0" />
        {copy.title} <span className="text-ink-500 text-sm font-normal" lang="km">{`· ${copy.titleKm}`}</span>
      </h2>
      {!data ? (
        <LoadingState count={2} variant="block" />
      ) : visible.length === 0 ? (
        <p className="text-ink-700 text-sm">{copy.empty}</p>
      ) : (
        <ol className="divide-line divide-y">
          {shown.map((item, index) => {
            const found = data.topics.get(item.topicId);
            if (!found) return null;
            const { topic, chapter } = found;
            const practiceHref = `/bacii/practice?subject=${encodeURIComponent(chapter.subjectId)}&chapter=${encodeURIComponent(chapter.id)}&topic=${encodeURIComponent(topic.id)}`;
            const main = actionLink(item.action, practiceHref);
            const label = copy.short[item.action.type];
            // One reason is enough here (the topic page has the rest), and not the same one twice in a row.
            const reason = item.reasons[0];
            const previous = shown[index - 1]?.reasons[0];
            const sameAsAbove = reason && previous && reasonText(reason, language, nameOf) === reasonText(previous, language, nameOf);
            return (
              <li key={item.topicId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0" data-kind={item.kind}>
                <div className="min-w-0 flex-1">
                  <Link to={`/learning/topics/${encodeURIComponent(topic.id)}`} className="text-ink-900 block truncate font-medium hover:underline" lang="km" title={topic.nameEn}>
                    {topic.nameKm}
                  </Link>
                  {/* The topic alone ("Properties") needs its chapter to make sense. */}
                  <p className="text-ink-500 truncate text-xs" lang="km">
                    {copy.chapter(chapter.number, chapter.nameKm)}
                  </p>
                  {reason && !sameAsAbove && (
                    <p className="text-ink-700 mt-0.5 text-xs" lang={language}>
                      {reasonText(reason, language, nameOf)}
                    </p>
                  )}
                </div>
                {main.external ? (
                  <a href={main.href} target="_blank" rel="noreferrer" className="btn-primary h-9 shrink-0 px-3 text-sm" aria-label={main.label}>
                    {label}
                    <ExternalLinkIcon className="ml-1 h-3.5 w-3.5" />
                  </a>
                ) : (
                  <Link to={main.href} className="btn-primary h-9 shrink-0 px-3 text-sm" aria-label={main.label}>
                    {label}
                  </Link>
                )}
                <button type="button" onClick={() => notNow(item)} aria-label={copy.notNowLabel(topic.nameEn)} title={copy.notNow} className="text-ink-500 hover:text-ink-900 hover:bg-surface-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <CloseIcon className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {visible.length > 1 && (
          <Link to="/learning/practice?mode=recommended" className="text-accent font-semibold hover:underline">
            {t.learning.practice.fromStudyNext}
          </Link>
        )}
        {snoozed.length > 0 && (
          <button type="button" onClick={showAll} className="text-ink-500 hover:text-ink-900 text-xs">
            {copy.snoozedNote(snoozed.length)} {copy.showAll}
          </button>
        )}
      </div>
      <p className="text-ink-500 mt-2 text-xs">{copy.note}</p>
    </section>
  );
}
