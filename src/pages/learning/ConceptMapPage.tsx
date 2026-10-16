import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import TopicStatusBadge from "../../components/TopicStatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useCurriculum } from "../../hooks/useCurriculum";
import { t } from "../../i18n/en";
import { dependentsOf, MAP_SIZES, mapLayout, prerequisitesOf } from "../../lib/conceptGraph";
import { topicStatus, type TopicStatus } from "../../lib/learningProfile";
import { getConceptLinks, getTopicResults } from "../../services/api";
import type { ConceptLink, CurriculumChapter, CurriculumTopic } from "../../types";

const copy = t.learning.map;
const VIEW_KEY = "meh-rean:concept-map-view";
const NODE_STYLE: Record<TopicStatus, { box: string; text: string }> = {
  unknown: { box: "fill-surface stroke-line", text: "fill-ink-900" },
  "work-on": { box: "fill-ribbon-50 stroke-ribbon-fg", text: "fill-ink-900" },
  practising: { box: "fill-brand-50 stroke-brand-500", text: "fill-ink-900" },
  "going-well": { box: "fill-brand-600 stroke-brand-600", text: "fill-white" },
};

function initialView(): "map" | "list" {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "map" || saved === "list") return saved;
  } catch {
    // Storage blocked: fall back to the screen size.
  }
  return window.matchMedia("(min-width: 768px)").matches ? "map" : "list";
}

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The knowledge graph as a map and as a list (Learning OS 2.3). */
export default function ConceptMapPage() {
  const { user } = useAuth();
  const { subjects, chapters, loaded } = useCurriculum();
  const [links, setLinks] = useState<ConceptLink[]>([]);
  const [statuses, setStatuses] = useState<Map<string, TopicStatus>>(() => new Map());
  const [view, setView] = useState<"map" | "list">(initialView);
  const [selected, setSelected] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    getConceptLinks().then(setLinks).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) return;
    getTopicResults()
      .then((results) => setStatuses(new Map(results.map((result) => [result.topicId, topicStatus(result)]))))
      .catch(() => {});
  }, [user]);

  const subject = subjects.find((item) => item.id === subjectId) ?? subjects[0];
  const subjectChapters = useMemo(() => chapters.filter((chapter) => chapter.subjectId === subject?.id), [chapters, subject]);
  const topicIndex = useMemo(() => {
    const map = new Map<string, { topic: CurriculumTopic; chapter: CurriculumChapter }>();
    for (const chapter of subjectChapters) for (const topic of chapter.topics) map.set(topic.id, { topic, chapter });
    return map;
  }, [subjectChapters]);
  const topicIds = useMemo(() => [...topicIndex.keys()], [topicIndex]);
  const subjectLinks = useMemo(() => links.filter((link) => topicIndex.has(link.fromTopic) && topicIndex.has(link.toTopic)), [links, topicIndex]);
  const layout = useMemo(() => mapLayout(topicIds, subjectLinks), [topicIds, subjectLinks]);
  const position = useMemo(() => new Map(layout.nodes.map((node) => [node.topicId, node])), [layout]);
  const statusOf = (id: string) => statuses.get(id) ?? "unknown";

  // The selected topic's chain: everything before it and directly after it.
  const chain = useMemo(() => {
    if (!selected) return null;
    return new Set([selected, ...prerequisitesOf(selected, subjectLinks).map((item) => item.topicId), ...dependentsOf(selected, subjectLinks, 1).map((item) => item.topicId)]);
  }, [selected, subjectLinks]);

  const choose = (next: "map" | "list") => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; still switches now.
    }
  };

  if (!loaded) {
    return (
      <div className="container-page max-w-5xl py-8">
        <LoadingState count={3} variant="block" />
      </div>
    );
  }

  const selectedInfo = selected ? topicIndex.get(selected) : undefined;
  const directBefore = selected ? prerequisitesOf(selected, subjectLinks, 1) : [];

  return (
    <div className="container-page max-w-5xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-4">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="text-ink-500 mt-1 text-sm" lang="km">
          {copy.titleKm}
        </p>
        <p className="text-ink-700 mt-2 text-sm">{copy.intro}</p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {subjects.length > 1 && (
          <select value={subject?.id ?? ""} onChange={(event) => setSubjectId(event.target.value)} aria-label={copy.subject} className="input h-9 w-auto text-sm">
            {subjects.map((item) => (
              <option key={item.id} value={item.id}>{`${item.nameKm} · ${item.nameEn}`}</option>
            ))}
          </select>
        )}
        <div role="group" aria-label={copy.viewLabel} className="flex gap-1">
          {(["map", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => choose(option)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${view === option ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink-700 hover:border-ink-400"}`}
            >
              {copy.views[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" aria-label={copy.legend}>
        {(["unknown", "work-on", "practising", "going-well"] as const).map((status) => (
          <TopicStatusBadge key={status} status={status} />
        ))}
        {!user && <span className="text-ink-500 text-xs">{copy.signInForStatus}</span>}
      </div>

      {view === "map" ? (
        <>
          <div className="card overflow-x-auto p-2" data-testid="concept-map">
            <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label={copy.mapLabel}>
              <defs>
                <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" className="fill-ink-400" />
                </marker>
              </defs>
              {subjectLinks.map((link) => {
                const from = position.get(link.fromTopic);
                const to = position.get(link.toTopic);
                if (!from || !to) return null;
                const lit = !chain || (chain.has(link.fromTopic) && chain.has(link.toTopic));
                if (link.kind === "related") {
                  return (
                    <line
                      key={link.id}
                      x1={from.x + MAP_SIZES.nodeWidth / 2}
                      y1={from.y + MAP_SIZES.nodeHeight}
                      x2={to.x + MAP_SIZES.nodeWidth / 2}
                      y2={to.y}
                      strokeDasharray="4 4"
                      className={`stroke-ink-400 ${lit ? "opacity-60" : "opacity-10"}`}
                    />
                  );
                }
                const x1 = from.x + MAP_SIZES.nodeWidth;
                const y1 = from.y + MAP_SIZES.nodeHeight / 2;
                const x2 = to.x - 2;
                const y2 = to.y + MAP_SIZES.nodeHeight / 2;
                const bend = (x2 - x1) / 2;
                return (
                  <path
                    key={link.id}
                    d={`M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`}
                    fill="none"
                    markerEnd="url(#arrow)"
                    className={`${chain && lit ? "stroke-brand-600" : "stroke-ink-400"} ${lit ? "opacity-80" : "opacity-10"}`}
                    strokeWidth={chain && lit ? 2 : 1.25}
                  />
                );
              })}
              {layout.nodes.map((node) => {
                const info = topicIndex.get(node.topicId)!;
                const style = NODE_STYLE[statusOf(node.topicId)];
                const dim = chain && !chain.has(node.topicId);
                const onKey = (event: KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(selected === node.topicId ? null : node.topicId);
                  }
                };
                return (
                  <g
                    key={node.topicId}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected === node.topicId}
                    aria-label={`${info.chapter.number}. ${info.topic.nameEn} — ${t.learning.status[statusOf(node.topicId)]}`}
                    onClick={() => setSelected(selected === node.topicId ? null : node.topicId)}
                    onKeyDown={onKey}
                    className={`cursor-pointer outline-none ${dim ? "opacity-30" : ""}`}
                  >
                    <rect x={node.x} y={node.y} width={MAP_SIZES.nodeWidth} height={MAP_SIZES.nodeHeight} rx={10} className={style.box} strokeWidth={selected === node.topicId ? 2.5 : 1} />
                    <text x={node.x + 10} y={node.y + 19} className={`${style.text} text-[12px] font-semibold`} lang="km">
                      {shorten(info.topic.nameKm, 18)}
                    </text>
                    <text x={node.x + 10} y={node.y + 36} className={`${style.text} text-[10px] opacity-80`}>
                      {shorten(`${info.chapter.number}. ${info.topic.nameEn}`, 26)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="text-ink-500 mt-2 text-xs">{copy.mapHint}</p>
          {selectedInfo && (
            <section className="card mt-3 p-4" aria-live="polite" aria-labelledby="map-selected">
              <h2 id="map-selected" className="text-ink-900 text-base font-bold">
                {`${selectedInfo.chapter.number}. ${selectedInfo.topic.nameKm} · ${selectedInfo.topic.nameEn}`}
              </h2>
              <p className="text-ink-700 mt-1 text-sm">
                {directBefore.length ? copy.needs(directBefore.map((item) => topicIndex.get(item.topicId)?.topic.nameEn ?? item.topicId).join(", ")) : copy.startingPoint}
              </p>
              <Link to={`/learning/topics/${encodeURIComponent(selected!)}`} className="btn-primary mt-3">
                {copy.openTopic}
              </Link>
            </section>
          )}
        </>
      ) : (
        <ol className="space-y-3" aria-label={copy.listLabel}>
          {subjectChapters.map((chapter) => (
            <li key={chapter.id} className="card p-4">
              <h2 className="text-ink-900 mb-2 text-sm font-bold">{`${chapter.number}. ${chapter.nameKm} · ${chapter.nameEn}`}</h2>
              <ul className="divide-line divide-y">
                {chapter.topics.map((topic) => {
                  const before = prerequisitesOf(topic.id, subjectLinks, 1);
                  return (
                    <li key={topic.id}>
                      <Link to={`/learning/topics/${encodeURIComponent(topic.id)}`} className="hover:bg-surface-hover -mx-2 flex items-center gap-3 rounded-md px-2 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="text-ink-900 block text-sm font-medium" lang="km">
                            {topic.nameKm}
                          </span>
                          <span className="text-ink-500 block text-xs">
                            {topic.nameEn}
                            {before.length > 0 && ` · ${copy.needs(before.map((item) => topicIndex.get(item.topicId)?.topic.nameEn ?? item.topicId).join(", "))}`}
                          </span>
                        </span>
                        <TopicStatusBadge status={statusOf(topic.id)} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <p className="text-ink-500 mt-3 text-xs">{t.learning.topic.provisionalLinks}</p>
    </div>
  );
}
