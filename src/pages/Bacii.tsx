import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, BulbIcon, CalendarIcon, CameraIcon, FileTextIcon, PenIcon, StarIcon, TableIcon, VideoIcon } from "../components/Icons";
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
  /** A 3D picture from public/illustrations (Microsoft Fluent Emoji, MIT). */
  image: string;
}

/** Everything in the BacII section; a new tool is one more entry here. */
const OPTIONS: BaciiOption[] = [
  {
    to: "/bacii/papers",
    title: t.bacii.papers.optionTitle,
    titleKm: t.bacii.papers.optionTitleKm,
    description: t.bacii.papers.optionDescription,
    Icon: FileTextIcon,
    image: "papers",
  },
  {
    to: "/bacii/practice",
    title: t.bacii.practice.optionTitle,
    titleKm: t.bacii.practice.optionTitleKm,
    description: t.bacii.practice.optionDescription,
    Icon: BulbIcon,
    image: "practice",
  },
  {
    to: "/bacii/timer",
    title: t.bacii.timer.optionTitle,
    titleKm: t.bacii.timer.optionTitleKm,
    description: t.bacii.timer.optionDescription,
    Icon: CalendarIcon,
    image: "timer",
  },
  {
    to: "/live",
    title: t.bacii.live.optionTitle,
    titleKm: t.bacii.live.optionTitleKm,
    description: t.bacii.live.optionDescription,
    Icon: StarIcon,
    image: "live",
  },
  {
    to: "/bacii/solve",
    title: t.bacii.solve.optionTitle,
    titleKm: t.bacii.solve.optionTitleKm,
    description: t.bacii.solve.optionDescription,
    Icon: CameraIcon,
    image: "solve",
  },
  {
    to: "/bacii/mistakes",
    title: t.bacii.mistakes.optionTitle,
    titleKm: t.bacii.mistakes.optionTitleKm,
    description: t.bacii.mistakes.optionDescription,
    Icon: PenIcon,
    image: "mistakes",
  },
  {
    to: "/bacii/plan",
    title: t.bacii.plan.optionTitle,
    titleKm: t.bacii.plan.optionTitleKm,
    description: t.bacii.plan.optionDescription,
    Icon: TableIcon,
    image: "plan",
  },
  {
    to: "/bacii/videos",
    title: t.bacii.videos.optionTitle,
    titleKm: t.bacii.videos.optionTitleKm,
    description: t.bacii.videos.optionDescription,
    Icon: VideoIcon,
    image: "videos",
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
      {/* The banner: what this section is, with the learning links one tap away. */}
      <header className="card relative mb-4 overflow-hidden p-5 sm:p-7">
        <div className="relative z-10 max-w-[36rem] pr-20 sm:pr-48">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">{t.bacii.grade}</p>
          <h1 className="text-ink-900 mt-1 text-3xl sm:text-4xl">
            {t.bacii.title} <span className="text-ink-500 font-normal">· {t.bacii.titleKm}</span>
          </h1>
          <p className="text-ink-500 mt-1.5 text-sm sm:text-base">{t.bacii.tagline}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {user && (
              <Link to="/learning" className="pill">
                {t.learning.home.link}
              </Link>
            )}
            <Link to="/learning/map" className="pill">
              {t.learning.map.title}
            </Link>
            {user && (
              <Link to="/learning/profile" className="pill">
                {t.learning.profileLink}
              </Link>
            )}
          </div>
        </div>
        <img src="/illustrations/banner.webp" alt="" width={224} height={285} className="pointer-events-none absolute right-8 bottom-3 hidden h-44 w-auto sm:block" />
        <img src="/illustrations/banner.webp" alt="" width={224} height={285} className="pointer-events-none absolute top-4 right-4 h-20 w-auto sm:hidden" />
      </header>

      <Link to="/bacii/today" className="card press group hover:border-brand-500 mb-6 flex items-center gap-3 p-3 transition-colors sm:gap-4 sm:p-4">
        <span className="bg-brand-50 text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          {streak ? <span className="font-display text-xl leading-none font-bold tabular-nums">{streak.current}</span> : <CalendarIcon className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display text-ink-900 block font-bold sm:text-lg">
            {daily.title} <span className="text-ink-500 hidden text-sm font-normal sm:inline" lang="km">{`· ${daily.titleKm}`}</span>
          </span>
          <span className="text-ink-500 block truncate text-sm">
            {!user ? daily.hubSignIn : streak ? `${daily.streakDays(streak.current)} · ${streak.answeredToday ? daily.hubDone : daily.hubCta}` : daily.hubCta}
          </span>
        </span>
        <span className={`h-9 shrink-0 px-3 text-sm sm:px-4 ${streak?.answeredToday ? "btn-secondary" : "btn-primary"}`}>
          {streak?.answeredToday ? daily.hubOpen : daily.hubStart}
          <ArrowLeftIcon className="h-4 w-4 rotate-180" />
        </span>
      </Link>

      <nav aria-label={t.bacii.optionsLabel}>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4">
          {OPTIONS.map(({ to, title, titleKm, description, Icon, image }) => (
            <li key={to}>
              <Link to={to} className="card press group hover:border-brand-500 relative flex h-full flex-col gap-2 overflow-hidden p-4 transition-colors sm:min-h-44 sm:flex-row sm:gap-4 sm:p-5">
                {/* On a phone the picture leads the card; on wider screens it sits on the right. */}
                <img src={`/illustrations/${image}.webp`} alt="" width={192} height={192} loading="lazy" decoding="async" className="h-16 w-16 shrink-0 object-contain sm:order-2 sm:h-24 sm:w-24" />
                <span className="flex min-w-0 flex-1 flex-col gap-2 sm:order-1 sm:pb-8">
                  <span className="flex items-center gap-3">
                    <span className="bg-brand-50 text-accent hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="font-display text-ink-900 block text-base leading-snug font-bold sm:text-lg">{title}</span>
                      <span className="text-ink-500 block text-xs sm:text-sm" lang="km">
                        {titleKm}
                      </span>
                    </span>
                  </span>
                  {/* On a phone the title says enough; the longer line is for wider screens. */}
                  <span className="text-ink-500 hidden text-sm leading-relaxed sm:block">{description}</span>
                </span>
                {/* The arrow fills with the signature colour on hover. */}
                <span className="bg-surface-hover text-ink-700 group-hover:bg-brand-600 absolute right-4 bottom-4 hidden h-8 w-8 items-center justify-center rounded-full transition-colors group-hover:text-white sm:flex">
                  <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Suggestions come after the tools, so the tools stay one tap away. */}
      {user ? <StudyNext userId={user.id} /> : <p className="text-ink-500 mt-6 text-sm">{t.learning.next.signIn}</p>}

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
