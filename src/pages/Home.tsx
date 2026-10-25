import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { BookmarkIcon, ChatIcon, CloseIcon, PlusIcon, SearchIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import { LogoMark } from "../components/Logo";
import NoteRow from "../components/NoteRow";
import Photo from "../components/Photo";
import TrendingSidebar from "../components/TrendingSidebar";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { t } from "../i18n/en";
import { SUBJECT_COLORS } from "../lib/subjects";
import type { TopicMastery } from "../lib/mastery";
import { getFeed, getTopicMastery } from "../services/api";
import {
  EDUCATION_LEVELS,
  SUBJECTS,
  type EducationLevel,
  type FeedSort,
  type MediaFilter,
  type PostView,
  type Subject,
} from "../types";

const SORTS = ["latest", "top", "discussed"] as const;
const MEDIA = ["all", "documents", "images", "videos"] as const;

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? t.home.morning : hour < 18 ? t.home.afternoon : t.home.evening;
}

/** Signed in: a hello, and the three things people come to do. */
function Welcome() {
  const { user } = useAuth();
  const { unread } = useChat();
  if (!user) return null;
  const first = user.displayName.split(" ")[0];

  const actions = [
    { to: "/create", Icon: PlusIcon, label: t.nav.newNote, tone: "bg-brand-600 text-white" },
    { to: "/messages", Icon: ChatIcon, label: unread ? t.home.messagesWaiting(unread) : t.nav.messages, tone: "bg-surface-hover text-ink-700" },
    { to: `/u/${user.username}?tab=saved`, Icon: BookmarkIcon, label: t.nav.saved, tone: "bg-surface-hover text-ink-700" },
  ];

  return (
    <section className="card ruled-paper relative mb-6 overflow-hidden p-5 sm:p-6 md:pr-52">
      {/* Written on the rules: the avatar spans two, each line of text sits on one. */}
      <div className="flex items-start gap-4 pr-10">
        <div className="flex h-16 shrink-0 items-center">
          <Avatar user={user} size="lg" />
        </div>
        <div className="min-w-0">
          <h1 className="on-rule text-ink-900 truncate text-xl sm:text-2xl">{t.home.hello(greeting(), first)}</h1>
          <p className="on-rule text-ink-500 truncate text-sm">{t.home.prompt}</p>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {actions.map(({ to, Icon, label, tone }) => (
          <Link
            key={to}
            to={to}
            className="press border-line bg-surface hover:bg-surface-hover flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-semibold sm:flex-row sm:px-3.5 sm:py-2 sm:text-sm"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-ink-900 leading-tight">{label}</span>
          </Link>
        ))}
      </div>
      <LogoMark animated className="absolute top-1/2 right-10 hidden h-32 w-32 -translate-y-1/2 md:block" />
    </section>
  );
}

/**
 * Signed in, for students already practising (Learning OS 11.4): a way back
 * to My learning. One light request; nothing shows for anyone else.
 */
function ContinueLearning() {
  const { user } = useAuth();
  const [mastery, setMastery] = useState<TopicMastery[] | null>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    getTopicMastery()
      .then((list) => active && setMastery(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);
  if (!user || !mastery?.length) return null;
  const strong = mastery.filter((item) => item.label === "strong" || item.label === "consistently-strong").length;
  return (
    <Link to="/learning" className="card press hover:border-brand-500 mb-6 flex items-center gap-4 p-4 transition-colors" data-testid="continue-learning">
      <Photo name="practice" sizes="48px" className="h-12 w-12 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="font-display text-ink-900 block font-bold">
          {t.home.continueTitle} <span className="text-ink-500 text-sm font-normal" lang="km">{`· ${t.learning.home.titleKm}`}</span>
        </span>
        <span className="text-ink-700 block text-sm">{t.home.continueLine(mastery.length, strong)}</span>
      </span>
      <span className="text-accent shrink-0 text-sm font-semibold">{t.home.continueGo}</span>
    </Link>
  );
}

const GUIDE_HIDDEN_KEY = "mehrean.guideCardHidden";

/** Signed in: a way to the guide until the student hides it (remembered in this browser only). */
function GuideCard() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(GUIDE_HIDDEN_KEY, "1");
    } catch {
      // Storage can be blocked; the card simply comes back next visit.
    }
  };
  return (
    <div className="card mb-6 flex items-center gap-3 p-3 sm:gap-4 sm:p-4" data-testid="guide-card">
      <Photo name="share" sizes="48px" className="h-12 w-12 shrink-0 rounded-xl" />
      <Link to="/guide" className="min-w-0 flex-1">
        <span className="font-display text-ink-900 block font-bold">{t.home.guideTitle}</span>
        <span className="text-ink-500 block text-sm">{t.home.guideBody}</span>
      </Link>
      <Link to="/guide" className="btn-primary hidden h-9 shrink-0 px-4 text-sm sm:inline-flex">
        {t.home.guideOpen}
      </Link>
      <button type="button" onClick={hide} aria-label={t.home.guideHide} className="text-ink-500 hover:bg-surface-hover hover:text-ink-900 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Signed out: what Meh Rean is, in one look. */
function Intro() {
  const points = [
    { image: "share", title: t.home.pointShare, body: t.home.pointShareBody },
    { image: "ask", title: t.home.pointAsk, body: t.home.pointAskBody },
    { image: "school", title: t.home.pointSchool, body: t.home.pointSchoolBody },
  ];
  return (
    <section className="card ruled-paper relative mb-8 overflow-hidden px-5 py-8 sm:px-10 sm:py-12">
      <Photo name="learning" sizes="384px" eager className="absolute top-12 right-10 hidden h-72 w-96 rounded-2xl shadow-sm lg:block" />
      <div className="max-w-2xl pr-8">
        <div className="flex h-16 items-center">
          <LogoMark animated className="h-14 w-14" />
        </div>
        <h1 className="on-rule sm:on-rule-2 text-ink-900 text-3xl sm:text-5xl">{t.feed.title}</h1>
        <p className="on-rule text-ink-700 text-base sm:text-lg">{t.feed.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link to="/signup" className="btn-primary h-11 px-5">
            {t.home.join}
          </Link>
          <Link to="/login" className="btn-secondary h-11 px-5">
            {t.nav.signIn}
          </Link>
          <Link to="/guide" className="text-accent inline-flex h-11 items-center px-2 font-semibold hover:underline">
            {t.guide.title}
          </Link>
        </div>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {points.map(({ image, title, body }) => (
          <li key={title} className="bg-surface border-line overflow-hidden rounded-xl border">
            <Photo name={image} sizes="(min-width: 640px) 360px, 100vw" className="aspect-video w-full" />
            <div className="p-4">
              <p className="text-ink-900 text-sm font-semibold">{title}</p>
              <p className="text-ink-500 mt-0.5 text-sm">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One tap per subject, each with its colour, scrolling sideways on phones. */
function SubjectChips({ value, onChange }: { value: Subject | "all"; onChange: (value: Subject | "all") => void }) {
  const chip = (active: boolean) =>
    `press inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
      active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 hover:border-ink-400"
    }`;
  return (
    <div role="group" aria-label={t.feed.subjectLabel} className="chip-row mb-3 pr-8">
      <button type="button" aria-pressed={value === "all"} onClick={() => onChange("all")} className={chip(value === "all")}>
        {t.feed.all}
      </button>
      {SUBJECTS.map((subject) => (
        <button key={subject} type="button" aria-pressed={value === subject} onClick={() => onChange(subject)} className={chip(value === subject)}>
          <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70" style={{ backgroundColor: SUBJECT_COLORS[subject] }} />
          {t.subjects[subject]}
        </button>
      ))}
    </div>
  );
}

function SmallSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="border-line bg-surface text-ink-700 hover:border-ink-400 h-9 shrink-0 cursor-pointer appearance-none rounded-full border py-0 pr-8 pl-3.5 text-sm font-medium"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="text-ink-500 pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px]">
        ▾
      </span>
    </label>
  );
}

export default function Home() {
  const { user, status } = useAuth();
  const [params, setParams] = useSearchParams();

  const query = params.get("q") ?? "";
  const school = params.get("school") ?? "";
  const sort = pick<FeedSort>(params.get("sort"), SORTS, "latest");
  const subject = pick<Subject | "all">(params.get("subject"), SUBJECTS, "all");
  const level = pick<EducationLevel | "all">(params.get("level"), EDUCATION_LEVELS, "all");
  const media = pick<MediaFilter>(params.get("media"), MEDIA, "all");

  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const setParam = useCallback(
    (key: string, value: string, fallback: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === fallback || value === "") next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const load = useCallback(async () => {
    setHasError(false);
    setRefreshing(true);
    try {
      setPosts(await getFeed({ search: query, school, sort, subject, level, media }));
    } catch {
      setHasError(true);
    } finally {
      setRefreshing(false);
    }
  }, [query, school, sort, subject, level, media]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const hasFilters = Boolean(query) || Boolean(school) || subject !== "all" || level !== "all" || media !== "all";
  const resetFilters = () => setParams(sort === "latest" ? {} : { sort }, { replace: true });
  const heading = query ? t.feed.resultsFor(query) : school ? t.feed.schoolFilter(school) : t.home.latest;

  return (
    <div className="container-page py-6 sm:py-8 xl:max-w-7xl">
      {/* Nothing until the session is known, so a signed-in student never sees the sign-up intro. */}
      {!hasFilters && status !== "loading" && (user ? <Welcome /> : <Intro />)}
      {!hasFilters && user && <GuideCard />}
      {!hasFilters && user && <ContinueLearning />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="feed-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="feed-title" className="font-display text-ink-900 min-w-0 truncate text-lg font-bold">
              {heading}
              {posts && !hasError && (
                <span className="text-ink-500 ml-2 font-sans text-sm font-normal" aria-live="polite">
                  {t.feed.results(posts.length)}
                </span>
              )}
            </h2>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 text-sm font-medium">
                <CloseIcon className="h-3.5 w-3.5" />
                {t.feed.clearAll}
              </button>
            )}
          </div>

          <SubjectChips value={subject} onChange={(value) => setParam("subject", value, "all")} />

          <div className="chip-row mb-4 pr-8">
            <SmallSelect
              label={t.feed.levelLabel}
              value={level}
              onChange={(value) => setParam("level", value, "all")}
              options={[{ value: "all", label: t.home.levelAny }, ...EDUCATION_LEVELS.map((value) => ({ value, label: t.levels[value] }))]}
            />
            <SmallSelect
              label={t.feed.mediaLabel}
              value={media}
              onChange={(value) => setParam("media", value, "all")}
              options={MEDIA.map((value) => ({ value, label: value === "all" ? t.home.typeAny : t.feed.media[value] }))}
            />
            <SmallSelect
              label={t.feed.sortLabel}
              value={sort}
              onChange={(value) => setParam("sort", value, "latest")}
              options={SORTS.map((value) => ({ value, label: t.feed.sort[value] }))}
            />
          </div>

          {hasError ? (
            <ErrorState onRetry={load} />
          ) : posts === null ? (
            <LoadingState count={3} variant="block" />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" />}
              title={t.feed.emptyTitle}
              body={t.feed.emptyBody}
              action={
                hasFilters ? (
                  <button type="button" onClick={resetFilters} className="btn-secondary">
                    {t.feed.reset}
                  </button>
                ) : user ? (
                  <Link to="/create" className="btn-primary">
                    <PlusIcon className="h-4 w-4" />
                    {t.nav.newNote}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className={`space-y-3 transition-opacity ${refreshing ? "opacity-60" : ""}`} aria-busy={refreshing}>
              {posts.map((post) => (
                <NoteRow key={`${post.id}-${user?.id ?? "guest"}`} post={post} />
              ))}
            </ul>
          )}
        </section>

        <aside className="hidden lg:block" aria-label={t.home.explore}>
          <div className="sticky top-24">
            <TrendingSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}
