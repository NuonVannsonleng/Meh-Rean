import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, ExternalLinkIcon, FileTextIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import TopicStatusBadge from "../../components/TopicStatusBadge";
import { useCurriculum } from "../../hooks/useCurriculum";
import { t } from "../../i18n/en";
import { dependentsOf, missingPrerequisites, prerequisitesOf, relatedTo } from "../../lib/conceptGraph";
import { topicStatus, type TopicResult } from "../../lib/learningProfile";
import { getConceptLinks, getPost, getQuestions, getResourceTopics, getTopicResults } from "../../services/api";
import type { ConceptLink, CurriculumChapter, CurriculumTopic, ResourceTopic } from "../../types";

const copy = t.learning.topic;

/** One topic of the knowledge graph (Learning OS 2.2): what comes before and after, and where to learn it. */
export default function TopicPage() {
  const { topicId = "" } = useParams();
  const { chapters, loaded } = useCurriculum();
  const [links, setLinks] = useState<ConceptLink[]>([]);
  const [results, setResults] = useState<TopicResult[]>([]);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [resources, setResources] = useState<ResourceTopic[]>([]);
  const [notes, setNotes] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    let active = true;
    getConceptLinks().then((list) => active && setLinks(list)).catch(() => {});
    getTopicResults().then((list) => active && setResults(list)).catch(() => {});
    getQuestions({ topicId })
      .then((list) => active && setQuestionCount(list.length))
      .catch(() => active && setQuestionCount(0));
    getResourceTopics({ topicId })
      .then(async (list) => {
        if (!active) return;
        setResources(list);
        const found = await Promise.all(
          list
            .filter((item) => item.resourceType === "note")
            .map((item) =>
              getPost(item.resourceId)
                .then((view) => ({ id: item.resourceId, title: view.title }))
                .catch(() => null),
            ),
        );
        if (active) setNotes(found.filter((item): item is { id: string; title: string } => item !== null));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [topicId]);

  const topicIndex = useMemo(() => {
    const map = new Map<string, { topic: CurriculumTopic; chapter: CurriculumChapter }>();
    for (const chapter of chapters) for (const topic of chapter.topics) map.set(topic.id, { topic, chapter });
    return map;
  }, [chapters]);
  const resultOf = useMemo(() => new Map(results.map((result) => [result.topicId, result])), [results]);
  const statusOf = (id: string) => topicStatus(resultOf.get(id));

  const here = topicIndex.get(topicId);
  useEffect(() => {
    if (here) document.title = `${here.topic.nameEn} · ${t.common.appName}`;
  }, [here]);

  if (!loaded) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={3} variant="block" />
      </div>
    );
  }
  if (!here) {
    return (
      <div className="container-page max-w-3xl py-16 text-center">
        <p className="text-ink-700">{copy.notFound}</p>
        <Link to="/bacii" className="btn-secondary mt-4">
          {t.bacii.title}
        </Link>
      </div>
    );
  }

  const { topic, chapter } = here;
  const result = resultOf.get(topicId);
  const status = statusOf(topicId);
  const before = prerequisitesOf(topicId, links);
  const after = dependentsOf(topicId, links).filter((item) => item.distance === 1);
  const related = relatedTo(topicId, links);
  // Direct prerequisites only: further back would crowd a new student's page.
  const missing = missingPrerequisites(topicId, links, statusOf).filter((item) => item.distance === 1);
  const videos = resources.filter((item) => item.resourceType === "video");
  const practiceLink = `/bacii/practice?subject=${encodeURIComponent(chapter.subjectId)}&chapter=${encodeURIComponent(chapter.id)}&topic=${encodeURIComponent(topicId)}`;
  const provisional = links.some((link) => link.verification !== "verified");

  const topicChip = (id: string, extra?: string) => {
    const found = topicIndex.get(id);
    return (
      <li key={id}>
        <Link to={`/learning/topics/${encodeURIComponent(id)}`} className="border-line hover:border-ink-400 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="text-ink-900 block truncate font-medium">{found ? found.topic.nameKm : id}</span>
            <span className="text-ink-500 block truncate text-xs">{found ? `${found.chapter.number}. ${found.topic.nameEn}${extra ? ` · ${extra}` : ""}` : extra}</span>
          </span>
          <TopicStatusBadge status={statusOf(id)} />
        </Link>
      </li>
    );
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-5">
        <p className="text-accent text-xs font-semibold tracking-wide uppercase">{copy.chapter(chapter.number, chapter.nameEn)}</p>
        <h1 className="text-ink-900 mt-1 text-2xl sm:text-3xl" lang="km">
          {topic.nameKm}
        </h1>
        <p className="text-ink-500 text-sm">{topic.nameEn}</p>
        {topic.verification !== "verified" && <p className="bg-ribbon-50 text-ribbon-fg mt-2 inline-block rounded-md px-2 py-1 text-xs">{copy.provisionalTopic}</p>}
      </header>

      <section className="card mb-4 p-4 sm:p-5" aria-labelledby="topic-you">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="topic-you" className="font-display text-ink-900 text-lg font-bold">
            {copy.youHere}
          </h2>
          <TopicStatusBadge status={status} />
        </div>
        <p className="text-ink-700 mt-1 text-sm">{result ? copy.results(result.correct, result.answered) : copy.noResults}</p>
        <p className="text-ink-500 mt-1 text-xs">{copy.estimateNote}</p>
        {missing.length > 0 && (
          <div className="bg-surface-muted mt-3 rounded-md px-3 py-2 text-sm">
            <p className="text-ink-900 font-medium">{copy.checkFirst}</p>
            <ul className="text-ink-700 mt-1 list-disc pl-5">
              {missing.map((item) => (
                <li key={item.topicId}>
                  <Link to={`/learning/topics/${encodeURIComponent(item.topicId)}`} className="hover:underline">
                    {topicIndex.get(item.topicId) ? `${topicIndex.get(item.topicId)!.chapter.number}. ${topicIndex.get(item.topicId)!.topic.nameKm} · ${topicIndex.get(item.topicId)!.topic.nameEn}` : item.topicId}
                  </Link>{" "}
                  <span className="text-ink-500 text-xs">({t.learning.status[item.status]})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={practiceLink} className="btn-primary">
            {copy.practise(questionCount ?? 0)}
          </Link>
          <Link to={`/bacii/videos?text=${encodeURIComponent(`${topic.nameKm} ${topic.nameEn}`)}&subject=mathematics&chapter=${encodeURIComponent(chapter.id)}`} className="btn-secondary">
            {copy.findVideo}
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="card p-4" aria-labelledby="topic-before">
          <h2 id="topic-before" className="text-ink-900 mb-2 text-sm font-bold">
            {copy.before}
          </h2>
          {before.length ? <ul className="space-y-1.5">{before.map((item) => topicChip(item.topicId, item.distance > 1 ? copy.stepsBack(item.distance) : undefined))}</ul> : <p className="text-ink-500 text-sm">{copy.startingPoint}</p>}
        </section>
        <section className="card p-4" aria-labelledby="topic-after">
          <h2 id="topic-after" className="text-ink-900 mb-2 text-sm font-bold">
            {copy.after}
          </h2>
          {after.length ? <ul className="space-y-1.5">{after.map((item) => topicChip(item.topicId))}</ul> : <p className="text-ink-500 text-sm">{copy.nothingAfter}</p>}
          {related.length > 0 && (
            <>
              <h3 className="text-ink-900 mt-3 mb-2 text-sm font-bold">{copy.related}</h3>
              <ul className="space-y-1.5">{related.map((id) => topicChip(id))}</ul>
            </>
          )}
        </section>
      </div>
      {provisional && <p className="text-ink-500 mt-2 text-xs">{copy.provisionalLinks}</p>}

      <section className="card mt-4 p-4" aria-labelledby="topic-videos">
        <h2 id="topic-videos" className="text-ink-900 mb-2 text-sm font-bold">
          {copy.videos}
        </h2>
        {videos.length ? (
          <ul className="space-y-2">
            {videos.map((video) => (
              <li key={video.id}>
                <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.resourceId)}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm hover:underline">
                  <img src={`https://i.ytimg.com/vi/${encodeURIComponent(video.resourceId)}/default.jpg`} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />
                  <span className="text-ink-900 min-w-0 flex-1">{video.title}</span>
                  <ExternalLinkIcon className="text-ink-500 h-4 w-4 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-500 text-sm">{copy.noVideos}</p>
        )}
      </section>

      <section className="card mt-4 p-4" aria-labelledby="topic-notes">
        <h2 id="topic-notes" className="text-ink-900 mb-2 text-sm font-bold">
          {copy.notes}
        </h2>
        {notes.length ? (
          <ul className="space-y-1.5">
            {notes.map((note) => (
              <li key={note.id}>
                <Link to={`/post/${note.id}`} className="text-ink-900 flex items-center gap-2 text-sm hover:underline">
                  <FileTextIcon className="text-ink-500 h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{note.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-500 text-sm">{copy.noNotes}</p>
        )}
      </section>
    </div>
  );
}
