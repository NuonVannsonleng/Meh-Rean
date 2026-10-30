import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, BulbIcon, CalendarIcon, FileTextIcon, TableIcon, VideoIcon } from "../components/Icons";
import Photo from "../components/Photo";
import StudyNext from "../components/StudyNext";
import { useAuth } from "../context/AuthContext";
import { BACII_TOOLS } from "../lib/baciiTools";
import { t } from "../i18n/en";
import { getDailyStreak } from "../services/api";
import type { DailyStreak } from "../types";

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
      <header className="card relative mb-4 overflow-hidden">
        {/* The wide picture shows whole on a phone; wider, it fills the banner and fades behind the text. */}
        <div className="relative aspect-[8/3] sm:absolute sm:inset-0 sm:aspect-auto">
          <Photo name="banner" widths={[800, 1600]} sizes="(min-width: 896px) 832px, 100vw" eager className="h-full w-full object-right" />
          <div className="from-surface via-surface/85 absolute inset-0 hidden bg-linear-to-r via-40% to-transparent to-65% sm:block" />
        </div>
        <div className="relative z-10 p-5 sm:max-w-[52%] sm:p-7">
          <p className="text-accent text-xs font-semibold tracking-wide uppercase">{t.bacii.grade}</p>
          <h1 className="text-ink-900 mt-1 text-3xl sm:text-4xl">
            {t.bacii.title}
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
      </header>

      <Link to="/bacii/today" className="card press group hover:border-brand-500 mb-6 flex items-center gap-3 p-3 transition-colors sm:gap-4 sm:p-4">
        <span className="bg-brand-50 text-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          {streak ? <span className="font-display text-xl leading-none font-bold tabular-nums">{streak.current}</span> : <CalendarIcon className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display text-ink-900 block font-bold sm:text-lg">
            {daily.title}
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
          {BACII_TOOLS.map(({ to, title, description, Icon }) => (
            <li key={to}>
              <Link to={to} className="card press group hover:border-brand-500 relative flex h-full flex-col gap-2 p-4 transition-colors sm:p-5 sm:pr-14">
                {/* Icon above the title on a phone (two narrow columns), beside it on wider screens. */}
                <span className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="bg-brand-50 text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-ink-900 min-w-0 text-base leading-snug font-bold sm:text-lg">{title}</span>
                </span>
                {/* On a phone the title says enough; the longer line is for wider screens. */}
                <span className="text-ink-500 hidden text-sm leading-relaxed sm:block">{description}</span>
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
