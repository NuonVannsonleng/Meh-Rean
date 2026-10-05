import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { BookmarkIcon, ChatIcon, CloseIcon, CommentIcon, FileTextIcon, GraduationIcon, PlusIcon, SearchIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import { LogoMark } from "../components/Logo";
import NoteRow from "../components/NoteRow";
import TrendingSidebar from "../components/TrendingSidebar";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";
import { t } from "../i18n/en";
import { SUBJECT_COLORS } from "../lib/subjects";
import { getFeed } from "../services/api";
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
    { to: "/messages", Icon: ChatIcon, label: unread ? t.home.messagesWaiting(unread) : t.nav.messages, tone: "bg-ribbon-50 text-ribbon-fg" },
    { to: `/u/${user.username}?tab=saved`, Icon: BookmarkIcon, label: t.nav.saved, tone: "bg-[color-mix(in_oklch,var(--color-rule)_25%,transparent)] text-ink-900" },
  ];

  return (
    <section className="card ruled-paper relative mb-6 overflow-hidden p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="bg-logo-ribbon animate-ribbon absolute top-0 right-6 h-14 w-5 [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)] sm:right-10 sm:h-16 sm:w-6"
      />
      <div className="flex items-center gap-4 pr-10">
        <Avatar user={user} size="lg" />
        <div className="min-w-0">
          <h1 className="text-ink-900 text-xl sm:text-2xl">{t.home.hello(greeting(), first)}</h1>
          <p className="text-ink-500 text-sm">{t.home.prompt}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
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
    </section>
  );
}

/** Signed out: what Meh Rean is, in one look. */
function Intro() {
  const points = [
    { Icon: FileTextIcon, title: t.home.pointShare, body: t.home.pointShareBody },
    { Icon: CommentIcon, title: t.home.pointAsk, body: t.home.pointAskBody },
    { Icon: GraduationIcon, title: t.home.pointSchool, body: t.home.pointSchoolBody },
  ];
  return (
    <section className="card ruled-paper relative mb-8 overflow-hidden px-5 py-8 sm:px-10 sm:py-12">
      <span
        aria-hidden="true"
        className="bg-logo-ribbon animate-ribbon absolute top-0 right-6 h-16 w-6 [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)] sm:right-12 sm:h-24 sm:w-8"
      />
      <div className="max-w-2xl pr-8">
        <LogoMark animated className="mb-4 h-14 w-14" />
        <h1 className="text-ink-900 text-3xl leading-tight sm:text-5xl">{t.feed.title}</h1>
        <p className="text-ink-700 mt-3 text-base sm:text-lg">{t.feed.subtitle}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/signup" className="btn-primary h-11 px-5">
            {t.home.join}
          </Link>
          <Link to="/login" className="btn-secondary h-11 px-5">
            {t.nav.signIn}
          </Link>
        </div>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {points.map(({ Icon, title, body }) => (
          <li key={title} className="bg-surface/80 border-line rounded-xl border p-4 backdrop-blur-sm">
            <span className="bg-brand-50 text-accent mb-2 flex h-9 w-9 items-center justify-center rounded-lg">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <p className="text-ink-900 text-sm font-semibold">{title}</p>
            <p className="text-ink-500 mt-0.5 text-sm">{body}</p>
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
  const { user } = useAuth();
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
      {!hasFilters && (user ? <Welcome /> : <Intro />)}

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
