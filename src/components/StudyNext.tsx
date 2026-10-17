import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import { reasonSignature, type RecommendationAction, type RecommendationWithAction } from "../lib/recommend";
import { reasonText } from "../lib/recommendText";
import { getRecommendations, RECOMMENDATION_RULES, type StudyNext as StudyNextData } from "../services/recommendations";
import { BulbIcon, ExternalLinkIcon, FileTextIcon, VideoIcon } from "./Icons";
import LoadingState from "./LoadingState";

const copy = t.learning.next;
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
  const nameOf = (id: string) => {
    const found = data?.topics.get(id);
    return found ? (language === "km" ? found.topic.nameKm : found.topic.nameEn) : id;
  };

  return (
    <section className="card mb-4 p-4 sm:p-5" aria-labelledby="study-next">
      <div className="mb-1 flex items-center gap-2">
        <BulbIcon className="text-accent h-5 w-5 shrink-0" />
        <h2 id="study-next" className="font-display text-ink-900 text-lg font-bold">
          {copy.title} <span className="text-ink-500 text-sm font-normal" lang="km">{`· ${copy.titleKm}`}</span>
        </h2>
      </div>
      <p className="text-ink-500 mb-3 text-xs">{copy.intro}</p>
      {!data ? (
        <LoadingState count={2} variant="block" />
      ) : visible.length === 0 ? (
        <p className="text-ink-700 text-sm">{copy.empty}</p>
      ) : (
        <ol className="space-y-3">
          {visible.map((item) => {
            const found = data.topics.get(item.topicId);
            if (!found) return null;
            const { topic, chapter } = found;
            const practiceHref = `/bacii/practice?subject=${encodeURIComponent(chapter.subjectId)}&chapter=${encodeURIComponent(chapter.id)}&topic=${encodeURIComponent(topic.id)}`;
            const main = actionLink(item.action, practiceHref);
            return (
              <li key={item.topicId} className="border-line rounded-lg border p-3" data-kind={item.kind}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Link to={`/learning/topics/${encodeURIComponent(topic.id)}`} className="text-ink-900 block font-medium hover:underline" lang="km">
                      {topic.nameKm}
                    </Link>
                    <p className="text-ink-500 text-xs">{`${chapter.number}. ${topic.nameEn}`}</p>
                  </div>
                  <button type="button" onClick={() => notNow(item)} aria-label={copy.notNowLabel(topic.nameEn)} className="btn-ghost h-8 shrink-0 px-2 text-xs">
                    {copy.notNow}
                  </button>
                </div>
                <ul className="text-ink-700 mt-1.5 space-y-0.5 text-sm" lang={language}>
                  {item.reasons.map((reason, index) => (
                    <li key={index}>{reasonText(reason, language, nameOf)}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {main.external ? (
                    <a href={main.href} target="_blank" rel="noreferrer" className="btn-primary h-9 px-3 text-sm">
                      {main.label}
                      <ExternalLinkIcon className="ml-1 h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <Link to={main.href} className="btn-primary h-9 px-3 text-sm">
                      {main.label}
                    </Link>
                  )}
                  {item.also.map((extra) =>
                    extra.type === "video" ? (
                      <a key="video" href={`https://www.youtube.com/watch?v=${encodeURIComponent(extra.id)}`} target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline">
                        <VideoIcon className="h-4 w-4" />
                        {copy.actions.video}
                      </a>
                    ) : extra.type === "note" ? (
                      <Link key="note" to={`/post/${encodeURIComponent(extra.id)}`} className="text-accent inline-flex items-center gap-1 text-sm font-medium hover:underline">
                        <FileTextIcon className="h-4 w-4" />
                        {copy.actions.note}
                      </Link>
                    ) : null,
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {snoozed.length > 0 && (
        <p className="text-ink-500 mt-3 text-xs">
          {copy.snoozedNote(snoozed.length)}{" "}
          <button type="button" onClick={showAll} className="text-accent font-semibold hover:underline">
            {copy.showAll}
          </button>
        </p>
      )}
      {visible.length > 0 && (
        <Link to="/learning/practice?mode=recommended" className="btn-secondary mt-3 h-9 px-3 text-sm">
          {t.learning.practice.fromStudyNext}
        </Link>
      )}
      <p className="text-ink-500 mt-3 text-xs">{copy.note}</p>
    </section>
  );
}
