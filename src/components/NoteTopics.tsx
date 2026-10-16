import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCurriculum } from "../hooks/useCurriculum";
import { t } from "../i18n/en";
import { getResourceTopics, linkResourceTopic, unlinkResourceTopic } from "../services/api";
import type { ResourceTopic } from "../types";
import { CloseIcon } from "./Icons";
import TopicPicker from "./TopicPicker";

const copy = t.learning.noteTopics;

/**
 * The BacII topics a note covers (Learning OS 1.2), so it can be suggested to
 * students working on them. Its author (or an admin) adds and removes them.
 */
export default function NoteTopics({ postId, title, canEdit }: { postId: string; title: string; canEdit: boolean }) {
  const { chapters } = useCurriculum();
  const [links, setLinks] = useState<ResourceTopic[] | null>(null);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getResourceTopics({ resourceType: "note", resourceId: postId })
      .then((list) => active && setLinks(list))
      .catch(() => active && setLinks([]));
    return () => {
      active = false;
    };
  }, [postId]);

  const topicOf = useMemo(
    () => new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => [topic.id, { topic, chapter }] as const))),
    [chapters],
  );

  if (!links || (!links.length && !canEdit)) return null;

  const add = async () => {
    if (!adding) return;
    setError(null);
    try {
      const link = await linkResourceTopic({ resourceType: "note", resourceId: postId, topicId: adding, title: title.slice(0, 200) });
      setLinks([...links, link]);
      setAdding("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };
  const remove = async (link: ResourceTopic) => {
    setLinks(links.filter((item) => item.id !== link.id));
    await unlinkResourceTopic(link.id).catch(() => setLinks(links));
  };

  return (
    <section className="card p-4" aria-labelledby="note-topics">
      <h2 id="note-topics" className="text-ink-900 text-sm font-bold">
        {copy.title}
      </h2>
      <p className="text-ink-500 mt-0.5 text-xs">{canEdit ? copy.hintOwner : copy.hint}</p>
      {links.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {links.map((link) => {
            const found = topicOf.get(link.topicId);
            return (
              <li key={link.id} className="bg-brand-50 text-accent inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-semibold">
                <Link
                  to={`/learning/topics/${encodeURIComponent(link.topicId)}`}
                  className="truncate hover:underline"
                >
                  {found ? `${found.chapter.number}. ${found.topic.nameKm}` : link.topicId}
                </Link>
                {canEdit ? (
                  <button type="button" onClick={() => void remove(link)} aria-label={copy.remove(found?.topic.nameEn ?? link.topicId)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/10">
                    <CloseIcon className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="w-1" />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && (
        <div className="mt-3 flex gap-2">
          <TopicPicker chapters={chapters} value={adding} onChange={setAdding} label={copy.add} exclude={links.map((link) => link.topicId)} />
          <button type="button" onClick={() => void add()} disabled={!adding} className="btn-secondary h-9 shrink-0 px-3 text-sm">
            {copy.addButton}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger-fg mt-2 text-xs font-medium">
          {error}
        </p>
      )}
    </section>
  );
}
