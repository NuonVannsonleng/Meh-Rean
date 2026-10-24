import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, BulbIcon, CalendarIcon, CameraIcon, FileTextIcon, GraduationIcon, PenIcon, StarIcon, TableIcon, VideoIcon } from "../components/Icons";
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
    to: "/bacii/papers",
    title: t.bacii.papers.optionTitle,
    titleKm: t.bacii.papers.optionTitleKm,
    description: t.bacii.papers.optionDescription,
    Icon: FileTextIcon,
  },
  {
    to: "/bacii/practice",
    title: t.bacii.practice.optionTitle,
    titleKm: t.bacii.practice.optionTitleKm,
    description: t.bacii.practice.optionDescription,
    Icon: BulbIcon,
  },
  {
    to: "/bacii/timer",
    title: t.bacii.timer.optionTitle,
    titleKm: t.bacii.timer.optionTitleKm,
    description: t.bacii.timer.optionDescription,
    Icon: CalendarIcon,
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

/** A stack of books and a mortar board, drawn in grey with one green book. */
function BooksArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={className} aria-hidden="true">
      <ellipse cx="104" cy="150" rx="78" ry="8" className="fill-ink-400/15" />
      <rect x="34" y="112" width="140" height="30" rx="5" className="fill-surface-hover stroke-line" strokeWidth="2" />
      <rect x="40" y="119" width="128" height="4" rx="2" className="fill-line" />
      <rect x="46" y="80" width="124" height="30" rx="5" className="fill-brand-600" />
      <rect x="52" y="87" width="112" height="4" rx="2" fill="white" opacity="0.35" />
      <rect x="40" y="50" width="130" height="28" rx="5" className="fill-surface stroke-line" strokeWidth="2" />
      <rect x="46" y="57" width="118" height="4" rx="2" className="fill-line" />
      <path d="M62 34 L108 16 L154 34 L108 52 Z" className="fill-ink-900" />
      <path d="M80 41 V52 C80 58 136 58 136 52 V41 L108 52 Z" className="fill-ink-700" />
      <path d="M154 34 V54" className="stroke-brand-600" strokeWidth="3" strokeLinecap="round" />
      <circle cx="154" cy="58" r="4" className="fill-brand-600" />
    </svg>
  );
}

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
        <div className="relative z-10 max-w-[34rem] sm:pr-44">
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
        <BooksArt className="pointer-events-none absolute -right-2 bottom-0 hidden h-40 w-48 sm:block" />
        <GraduationIcon className="text-accent pointer-events-none absolute top-4 right-4 h-8 w-8 opacity-80 sm:hidden" />
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
          {OPTIONS.map(({ to, title, titleKm, description, Icon }) => (
            <li key={to}>
              <Link to={to} className="card press group hover:border-brand-500 flex h-full flex-col gap-3 p-4 transition-colors sm:p-5">
                <span className="flex items-start justify-between gap-2">
                  <span className="bg-brand-50 text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="h-5 w-5" />
                  </span>
                  {/* The arrow fills with the signature colour on hover: the only colour on the card. */}
                  <span className="bg-surface-hover text-ink-700 group-hover:bg-brand-600 hidden h-8 w-8 items-center justify-center rounded-full transition-colors group-hover:text-white sm:flex">
                    <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                  </span>
                </span>
                <span>
                  <span className="font-display text-ink-900 block text-base leading-snug font-bold sm:text-lg">{title}</span>
                  <span className="text-ink-500 block text-xs sm:text-sm" lang="km">
                    {titleKm}
                  </span>
                </span>
                {/* On a phone the title says enough; the longer line is for wider screens. */}
                <span className="text-ink-500 hidden text-sm leading-relaxed sm:block">{description}</span>
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
