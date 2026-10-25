import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import { ArrowLeftIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import MasteryBadge from "../components/MasteryBadge";
import gradeScale from "../data/grade-scale.json";
import { useCurriculum } from "../hooks/useCurriculum";
import { t } from "../i18n/en";
import { addDays, cambodiaDay } from "../lib/daily";
import { formatDate } from "../lib/format";
import { activitySummary, chapterIndicators, type ChapterIndicator } from "../lib/learningProfile";
import type { TopicMastery } from "../lib/mastery";
import { getChapterProgress, getLearningEvents, getLearningProfile, getTopicMastery, saveLearningProfile } from "../services/api";
import type { ChapterProgress, LearningEvent, LearningProfile } from "../types";

const copy = t.learning.profile;
const TARGETS = gradeScale.bands.map((band) => band.grade).filter((grade) => grade !== "F");
const SESSION_MINUTES = [15, 20, 30, 45, 60, 90, 120];

/** The student's learning profile (Learning OS 1.4): their choices, and — apart — what their answers suggest. */
export default function LearningProfilePage() {
  const { subjects, chapters } = useCurriculum();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [progress, setProgress] = useState<ChapterProgress[]>([]);
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "saved" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    getLearningProfile()
      .then(setProfile)
      .catch(() => setFailed(true));
    getChapterProgress().then(setProgress).catch(() => {});
    getLearningEvents(200).then(setEvents).catch(() => {});
    getTopicMastery().then(setMastery).catch(() => {});
  }, []);

  const tracks = useMemo(() => [...new Map(subjects.map((subject) => [subject.trackId, subject])).values()], [subjects]);
  const chapterOf = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const indicators = chapterIndicators(progress);
  const activity = activitySummary(events);
  const topicOf = useMemo(() => new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => [topic.id, { topic, chapter }] as const))), [chapters]);
  // Weakest first; topics still without a label go last, most answered first.
  const topics = [...mastery].sort((a, b) => Number(a.label === "unknown") - Number(b.label === "unknown") || (a.score ?? 0) - (b.score ?? 0) || b.evidence - a.evidence);
  const today = cambodiaDay(new Date());

  if (failed) {
    return (
      <div className="container-page max-w-3xl py-8">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={3} variant="block" />
      </div>
    );
  }

  const update = (changes: Partial<LearningProfile>) => {
    setProfile({ ...profile, ...changes });
    setStatus(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { updatedAt: _updatedAt, ...input } = profile;
      setProfile(await saveLearningProfile(input));
      setStatus({ kind: "saved", text: copy.saved });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : copy.saveFailed });
    } finally {
      setSaving(false);
    }
  };

  const indicatorList = (items: ChapterIndicator[], empty: string) =>
    items.length ? (
      <ul className="space-y-1.5">
        {items.map((item) => {
          const chapter = chapterOf.get(item.chapterId);
          return (
            <li key={item.chapterId} className="flex items-center justify-between gap-3 text-sm">
              <Link
                to={chapter ? `/bacii/practice?subject=${encodeURIComponent(chapter.subjectId)}&chapter=${encodeURIComponent(chapter.id)}` : "/bacii/practice"}
                className="text-ink-900 min-w-0 truncate hover:underline"
              >
                {chapter ? `${chapter.number}. ${chapter.nameEn}` : item.chapterId}
              </Link>
              <span className="text-ink-500 shrink-0 text-xs tabular-nums">{copy.rightOf(item.correct, item.answered)}</span>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="text-ink-500 text-sm">{empty}</p>
    );

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-5">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
      </header>

      <form onSubmit={save} className="card mb-5 space-y-4 p-4 sm:p-5" aria-labelledby="profile-settings">
        <div>
          <h2 id="profile-settings" className="font-display text-ink-900 text-lg font-bold">
            {copy.settingsTitle}
          </h2>
          <p className="text-ink-500 text-xs">{profile.updatedAt ? copy.savedOn(formatDate(profile.updatedAt)) : copy.suggested}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-ink-700 block text-sm font-medium">
            {copy.track}
            <select value={profile.trackId ?? ""} onChange={(event) => update({ trackId: event.target.value || null })} className="input mt-1 h-10">
              <option value="">{copy.notSet}</option>
              {tracks.map((subject) => (
                <option key={subject.trackId} value={subject.trackId}>{subject.trackNameEn}</option>
              ))}
            </select>
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.examDate}
            <input
              type="date"
              min={addDays(today, 1)}
              max={addDays(today, 365)}
              value={profile.examDate ?? ""}
              onChange={(event) => update({ examDate: event.target.value || null })}
              className="input mt-1 h-10"
            />
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.targetGrade}
            <select value={profile.targetGrade ?? ""} onChange={(event) => update({ targetGrade: event.target.value || null })} className="input mt-1 h-10">
              <option value="">{copy.notSet}</option>
              {TARGETS.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.session}
            <select value={profile.sessionMinutes} onChange={(event) => update({ sessionMinutes: Number(event.target.value) })} className="input mt-1 h-10">
              {[...new Set([...SESSION_MINUTES, profile.sessionMinutes])].sort((a, b) => a - b).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {copy.minutes(minutes)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.daysPerWeek}
            <select value={profile.daysPerWeek ?? ""} onChange={(event) => update({ daysPerWeek: event.target.value ? Number(event.target.value) : null })} className="input mt-1 h-10">
              <option value="">{copy.notSet}</option>
              {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                <option key={days} value={days}>
                  {copy.days(days)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="text-ink-700 text-sm font-medium">{copy.subjects}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5">
            {subjects.map((subject) => (
              <label key={subject.id} className="text-ink-700 inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={profile.subjectIds.includes(subject.id)}
                  onChange={(event) =>
                    update({ subjectIds: event.target.checked ? [...profile.subjectIds, subject.id] : profile.subjectIds.filter((id) => id !== subject.id) })
                  }
                />
                {subject.nameEn}
              </label>
            ))}
          </div>
        </fieldset>
        {status && (
          <p role={status.kind === "error" ? "alert" : "status"} className={`text-sm font-medium ${status.kind === "error" ? "text-danger-fg" : "text-accent"}`}>
            {status.text}
          </p>
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {copy.save}
        </button>
      </form>

      <section className="card mb-5 p-4 sm:p-5" aria-labelledby="profile-inferred">
        <h2 id="profile-inferred" className="font-display text-ink-900 text-lg font-bold">
          {copy.inferredTitle}
        </h2>
        <p className="text-ink-500 mb-3 text-xs">{copy.inferredNote}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-ink-700 mb-1.5 text-sm font-semibold">{copy.strengths}</h3>
            {indicatorList(indicators.strengths, copy.noneYet)}
          </div>
          <div>
            <h3 className="text-ink-700 mb-1.5 text-sm font-semibold">{copy.workOn}</h3>
            {indicatorList(indicators.workOn, copy.noneYet)}
          </div>
        </div>
      </section>

      <section className="card mb-5 p-4 sm:p-5" aria-labelledby="profile-topics">
        <h2 id="profile-topics" className="font-display text-ink-900 text-lg font-bold">
          {copy.topicsTitle}
        </h2>
        <p className="text-ink-500 mb-3 text-xs">{copy.topicsNote}</p>
        {topics.length ? (
          <ul className="divide-line divide-y">
            {topics.map((item) => {
              const found = topicOf.get(item.topicId);
              return (
                <li key={item.topicId}>
                  <Link to={`/learning/topics/${encodeURIComponent(item.topicId)}`} className="flex items-center gap-3 py-2 hover:underline">
                    <span className="min-w-0 flex-1">
                      <span className="text-ink-900 block truncate text-sm font-medium">
                        {found?.topic.nameEn ?? item.topicId}
                      </span>
                      <span className="text-ink-500 block truncate text-xs">{found ? `${found.chapter.number}. ${found.topic.nameEn}` : ""}</span>
                    </span>
                    {item.label !== "unknown" && item.score !== null && <span className="text-ink-700 text-xs tabular-nums">{t.learning.mastery.score(item.score)}</span>}
                    <MasteryBadge label={item.label} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-ink-500 text-sm">{copy.noTopics}</p>
        )}
        <p className="text-ink-500 mt-2 text-xs">{t.learning.mastery.note}</p>
      </section>

      <section className="card p-4 sm:p-5" aria-labelledby="profile-activity">
        <h2 id="profile-activity" className="font-display text-ink-900 text-lg font-bold">
          {copy.activityTitle}
        </h2>
        {activity.answers === 0 && activity.examsCompleted === 0 ? (
          <p className="text-ink-500 mt-1 text-sm">{copy.noActivity}</p>
        ) : (
          <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [copy.answers, String(activity.answers)],
              [copy.right, activity.answers ? `${Math.round((activity.correct / activity.answers) * 100)}%` : "–"],
              [copy.reviews, String(activity.reviews)],
              [copy.activeDays, `${activity.activeDays} / 7`],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface-muted rounded-md px-3 py-2">
                <dt className="text-ink-500 text-xs">{label}</dt>
                <dd className="text-ink-900 font-display text-xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {activity.lastActiveAt && <p className="text-ink-500 mt-2 text-xs">{copy.lastActive(formatDate(activity.lastActiveAt))}</p>}
        <Link to="/learning/history" className="text-accent mt-2 inline-block text-sm font-semibold hover:underline">
          {t.learning.history.link}
        </Link>
      </section>
    </div>
  );
}
