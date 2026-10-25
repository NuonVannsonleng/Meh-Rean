import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, TrashIcon } from "../../components/Icons";
import TopicPicker from "../../components/TopicPicker";
import { useCurriculum } from "../../hooks/useCurriculum";
import { t } from "../../i18n/en";
import { videoIdFrom } from "../../lib/videoQuiz";
import { getResourceTopics, linkResourceTopic, unlinkResourceTopic } from "../../services/api";
import type { ResourceTopic } from "../../types";

const copy = t.learning.topicVideos;

/** BacII → Admin → Videos by topic (Learning OS 1.2): videos that explain each topic. */
export default function AdminTopicVideos() {
  const { chapters } = useCurriculum();
  const [topicId, setTopicId] = useState("");
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [videos, setVideos] = useState<ResourceTopic[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
  }, []);
  useEffect(() => {
    let active = true;
    getResourceTopics({ resourceType: "video" })
      .then((list) => active && setVideos(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const topicName = useMemo(
    () => new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => [topic.id, `${chapter.number}. ${topic.nameEn}`] as const))),
    [chapters],
  );
  const shown = topicId ? videos.filter((video) => video.topicId === topicId) : videos;

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const videoId = videoIdFrom(link);
    if (!topicId) return setProblem(copy.needTopic);
    if (!videoId) return setProblem(copy.badVideo);
    if (!title.trim()) return setProblem(copy.needTitle);
    setProblem(null);
    try {
      const added = await linkResourceTopic({ resourceType: "video", resourceId: videoId, topicId, title: title.trim() });
      setVideos([...videos, added]);
      setLink("");
      setTitle("");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  const remove = async (video: ResourceTopic) => {
    setVideos(videos.filter((item) => item.id !== video.id));
    await unlinkResourceTopic(video.id).catch(() => setVideos(videos));
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.subtitle}</p>

      <form onSubmit={add} className="card mb-5 space-y-3 p-4 sm:p-5">
        <div className="flex gap-2">
          <TopicPicker chapters={chapters} value={topicId} onChange={setTopicId} label={copy.topic} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-ink-700 block text-sm font-medium">
            {copy.video}
            <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://youtu.be/…" className="input mt-1 h-10" />
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.videoTitle}
            <input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} className="input mt-1 h-10" />
          </label>
        </div>
        {problem && (
          <p role="alert" className="text-danger-fg text-sm font-medium">
            {problem}
          </p>
        )}
        <button type="submit" className="btn-primary">
          {copy.add}
        </button>
      </form>

      {shown.length === 0 ? (
        <p className="card text-ink-700 p-4 text-sm">{copy.none}</p>
      ) : (
        <ul className="card divide-line divide-y">
          {shown.map((video) => (
            <li key={video.id} className="flex items-start gap-3 px-4 py-3">
              <img src={`https://i.ytimg.com/vi/${video.resourceId}/default.jpg`} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <a href={`https://www.youtube.com/watch?v=${video.resourceId}`} target="_blank" rel="noreferrer" className="text-ink-900 text-sm font-semibold hover:underline">
                  {video.title}
                </a>
                <p className="text-ink-500 truncate text-xs">{topicName.get(video.topicId) ?? video.topicId}</p>
              </div>
              <button type="button" onClick={() => void remove(video)} aria-label={copy.remove(video.title)} className="text-ink-500 hover:text-danger-fg flex h-8 w-8 shrink-0 items-center justify-center">
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
