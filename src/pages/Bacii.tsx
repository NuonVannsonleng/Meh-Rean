import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { BulbIcon, CalendarIcon, CameraIcon, FileTextIcon, GraduationIcon, PenIcon, StarIcon, TableIcon, VideoIcon } from "../components/Icons";
import StudyNext from "../components/StudyNext";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { getDailyStreak } from "../services/api";
import type { DailyStreak } from "../types";

interface BaciiOption {
  to: string;
  title: string;
  titleKm: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}

/** Everything in the BacII section; a new tool is one more entry here. */
const OPTIONS: BaciiOption[] = [
  {
    to: "/bacii/practice",
    title: t.bacii.practice.optionTitle,
    titleKm: t.bacii.practice.optionTitleKm,
    description: t.bacii.practice.optionDescription,
    Icon: BulbIcon,
  },
  {
    to: "/bacii/papers",
    title: t.bacii.papers.optionTitle,
    titleKm: t.bacii.papers.optionTitleKm,
    description: t.bacii.papers.optionDescription,
    Icon: FileTextIcon,
  },
  {
    to: "/live",
    title: t.bacii.live.optionTitle,
    titleKm: t.bacii.live.optionTitleKm,
    description: t.bacii.live.optionDescription,
    Icon: StarIcon,
  },
  {
    to: "/bacii/solve",
    title: t.bacii.solve.optionTitle,
    titleKm: t.bacii.solve.optionTitleKm,
    description: t.bacii.solve.optionDescription,
    Icon: CameraIcon,
  },
  {
    to: "/bacii/mistakes",
    title: t.bacii.mistakes.optionTitle,
    titleKm: t.bacii.mistakes.optionTitleKm,
    description: t.bacii.mistakes.optionDescription,
    Icon: PenIcon,
  },
  {
    to: "/bacii/plan",
    title: t.bacii.plan.optionTitle,
    titleKm: t.bacii.plan.optionTitleKm,
    description: t.bacii.plan.optionDescription,
    Icon: TableIcon,
  },
  {
    to: "/bacii/videos",
    title: t.bacii.videos.optionTitle,
    titleKm: t.bacii.videos.optionTitleKm,
    description: t.bacii.videos.optionDescription,
    Icon: VideoIcon,
  },
];

/** The BacII section: tools for Grade 12 students preparing for the national exam. */
export default function Bacii() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<DailyStreak | null>(null);
  useEffect(() => {
    document.title = `${t.bacii.title} · ${t.common.appName}`;
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getDailyStreak()
      .then((current) => active && setStreak(current))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);
  const daily = t.bacii.daily;

  return (
    <div className="container-page max-w-4xl py-6 sm:py-10">
      <header className="mb-8 flex items-start gap-4">
        <span className="bg-ribbon-50 text-ribbon-fg flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
          <GraduationIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">{t.bacii.grade}</p>
          <h1 className="text-ink-900 text-3xl sm:text-4xl">
            {t.bacii.title} <span className="text-ink-500 font-normal">· {t.bacii.titleKm}</span>
          </h1>
          <p className="text-ink-500 mt-1 text-sm sm:text-base">{t.bacii.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/learning/map" className="text-accent text-sm font-semibold hover:underline">
              {t.learning.map.title}
            </Link>
            {user && (
              <Link to="/learning/revision" className="text-accent text-sm font-semibold hover:underline">
                {t.learning.revision.link}
              </Link>
            )}
            {user && (
              <Link to="/learning/journey" className="text-accent text-sm font-semibold hover:underline">
                {t.learning.journey.link}
              </Link>
            )}
            {user && (
              <Link to="/learning/practice" className="text-accent text-sm font-semibold hover:underline">
                {t.learning.practice.link}
              </Link>
            )}
            {user && (
              <Link to="/learning/profile" className="text-accent text-sm font-semibold hover:underline">
                {t.learning.profileLink}
              </Link>
            )}
          </div>
        </div>
      </header>

      <Link to="/bacii/today" className="card press hover:border-brand-500 mb-4 flex items-center gap-4 p-4 transition-colors sm:p-5">
        <span className="bg-ribbon-50 text-ribbon-fg flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl">
          {streak ? <span className="font-display text-xl leading-none font-bold tabular-nums">{streak.current}</span> : <CalendarIcon className="h-6 w-6" />}
        </span>
        <span className="min-w-0">
          <span className="font-display text-ink-900 block text-lg font-bold">
            {daily.title} <span className="text-ink-500 text-sm font-normal" lang="km">{`· ${daily.titleKm}`}</span>
          </span>
          <span className="text-ink-700 block text-sm">
            {!user ? daily.hubSignIn : streak ? `${daily.streakDays(streak.current)} · ${streak.answeredToday ? daily.hubDone : daily.hubCta}` : daily.hubCta}
          </span>
        </span>
      </Link>

      {user ? (
        <StudyNext userId={user.id} />
      ) : (
        <p className="text-ink-500 mb-4 text-sm">{t.learning.next.signIn}</p>
      )}

      <nav aria-label={t.bacii.optionsLabel}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map(({ to, title, titleKm, description, Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="card press group hover:border-brand-500 flex h-full flex-col gap-3 p-5 transition-colors"
              >
                <span className="bg-brand-50 text-accent flex h-11 w-11 items-center justify-center rounded-xl">
                  <Icon className="h-5.5 w-5.5" />
                </span>
                <span>
                  <span className="font-display text-ink-900 group-hover:text-accent block text-lg font-bold">{title}</span>
                  <span className="text-ink-500 block text-sm">{titleKm}</span>
                </span>
                <span className="text-ink-700 text-sm leading-relaxed">{description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {user?.isAdmin && (
        <Link
          to="/bacii/admin/questions"
          className="card press hover:border-brand-500 mt-6 flex items-center gap-3 p-4 transition-colors"
        >
          <span className="bg-surface-hover text-ink-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <FileTextIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="text-ink-900 block text-sm font-semibold">{t.admin.manageQuestions}</span>
            <span className="text-ink-500 block text-xs">{t.admin.manageQuestionsHint}</span>
          </span>
        </Link>
      )}
      {user?.isAdmin && (
        <Link
          to="/bacii/admin/channels"
          className="card press hover:border-brand-500 mt-3 flex items-center gap-3 p-4 transition-colors"
        >
          <span className="bg-surface-hover text-ink-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <VideoIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="text-ink-900 block text-sm font-semibold">{t.admin.manageChannels}</span>
            <span className="text-ink-500 block text-xs">{t.admin.manageChannelsHint}</span>
          </span>
        </Link>
      )}
      {user?.isAdmin && (
        <Link
          to="/bacii/admin/topic-links"
          className="card press hover:border-brand-500 mt-3 flex items-center gap-3 p-4 transition-colors"
        >
          <span className="bg-surface-hover text-ink-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <TableIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="text-ink-900 block text-sm font-semibold">{t.admin.manageTopicLinks}</span>
            <span className="text-ink-500 block text-xs">{t.admin.manageTopicLinksHint}</span>
          </span>
        </Link>
      )}
      {user?.isAdmin && (
        <Link
          to="/bacii/admin/topic-videos"
          className="card press hover:border-brand-500 mt-3 flex items-center gap-3 p-4 transition-colors"
        >
          <span className="bg-surface-hover text-ink-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <VideoIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="text-ink-900 block text-sm font-semibold">{t.admin.manageTopicVideos}</span>
            <span className="text-ink-500 block text-xs">{t.admin.manageTopicVideosHint}</span>
          </span>
        </Link>
      )}
      {user?.isAdmin && (
        <Link
          to="/bacii/admin/quizzes"
          className="card press hover:border-brand-500 mt-3 flex items-center gap-3 p-4 transition-colors"
        >
          <span className="bg-surface-hover text-ink-700 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <BulbIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="text-ink-900 block text-sm font-semibold">{t.admin.manageQuizzes}</span>
            <span className="text-ink-500 block text-xs">{t.admin.manageQuizzesHint}</span>
          </span>
        </Link>
      )}
    </div>
  );
}
