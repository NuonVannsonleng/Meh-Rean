import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { CloseIcon, FileTextIcon, PlusIcon, SearchIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import { LogoMark } from "../components/Logo";
import NoteRow from "../components/NoteRow";
import TrendingSidebar from "../components/TrendingSidebar";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { normalizeText } from "../lib/institutions";
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

/** "Your notes" down the left of the dashboard, like a list of your projects. */
function YourNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<PostView[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!user) return;
    getFeed({ authorUsername: user.username })
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [user]);

  const shown = useMemo(() => {
    const term = normalizeText(filter.trim());
    return (notes ?? []).filter((note) => !term || normalizeText(note.title).includes(term)).slice(0, 12);
  }, [notes, filter]);

  if (!user) return null;

  return (
    <section aria-labelledby="your-notes-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="your-notes-title" className="text-ink-900 text-sm font-semibold">
          {t.nav.yourNotes}
        </h2>
        <Link to="/create" className="btn-primary h-7 px-2 text-xs">
          <PlusIcon className="h-3.5 w-3.5" />
          {t.home.new}
        </Link>
      </div>
      <label className="relative block">
        <span className="sr-only">{t.profile.findNote}</span>
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t.profile.findNote}
          className="input h-8 text-sm"
        />
      </label>
      {notes === null ? (
        <p className="text-ink-500 mt-3 text-sm">{t.common.loading}</p>
      ) : notes.length === 0 ? (
        <p className="text-ink-500 mt-3 text-sm">{t.home.noNotesYet}</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {shown.map((note) => (
            <li key={note.id}>
              <Link to={`/post/${note.id}`} className="hover:bg-surface-hover flex items-center gap-2 rounded-md px-1.5 py-1 text-sm">
                <Avatar user={user} size="sm" className="h-4 w-4 text-[8px]" />
                <span className="text-ink-900 min-w-0 truncate">
                  {user.username}/<span className="font-semibold">{note.title}</span>
                </span>
              </Link>
            </li>
          ))}
          {notes.length > shown.length && !filter && (
            <li>
              <Link to={`/u/${user.username}?tab=notes`} className="text-ink-500 hover:text-ribbon-fg block px-1.5 py-1 text-xs">
                {t.home.showAll(notes.length)}
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function Intro() {
  return (
    <section className="card bg-surface-muted mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <LogoMark className="h-12 w-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <h1 className="text-ink-900 text-xl font-semibold">{t.feed.title}</h1>
        <p className="text-ink-500 mt-1 text-sm">{t.feed.subtitle}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link to="/login" className="btn-secondary">
          {t.nav.signIn}
        </Link>
        <Link to="/signup" className="btn-primary">
          {t.nav.signUp}
        </Link>
      </div>
    </section>
  );
}

/** A dropdown that looks like a toolbar button. */
function FilterSelect<T extends string>({
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
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="btn-secondary h-8 max-w-44 cursor-pointer appearance-none pr-7 text-sm font-medium"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="text-ink-500 pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px]">
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
    <div className="container-page py-6 xl:max-w-7xl">
      {!user && !hasFilters && <Intro />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        {user && (
          <aside className="hidden xl:block" aria-label={t.nav.yourNotes}>
            <div className="sticky top-20">
              <YourNotes />
            </div>
          </aside>
        )}
        {!user && <div className="hidden xl:block" />}

        <section aria-labelledby="feed-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h1 id="feed-title" className="text-ink-900 min-w-0 truncate text-base font-semibold">
              {heading}
            </h1>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="text-ink-500 hover:text-ribbon-fg inline-flex items-center gap-1 text-sm">
                <CloseIcon className="h-3.5 w-3.5" />
                {t.feed.clearAll}
              </button>
            )}
          </div>

          <div role="group" aria-label={t.feed.controlsLabel} className="mb-4 flex flex-wrap gap-2">
            <FilterSelect
              label={t.feed.subjectLabel}
              value={subject}
              onChange={(value) => setParam("subject", value, "all")}
              options={[
                { value: "all", label: t.home.subjectAny },
                ...SUBJECTS.map((value) => ({ value, label: t.subjects[value] })),
              ]}
            />
            <FilterSelect
              label={t.feed.levelLabel}
              value={level}
              onChange={(value) => setParam("level", value, "all")}
              options={[
                { value: "all", label: t.home.levelAny },
                ...EDUCATION_LEVELS.map((value) => ({ value, label: t.levels[value] })),
              ]}
            />
            <FilterSelect
              label={t.feed.mediaLabel}
              value={media}
              onChange={(value) => setParam("media", value, "all")}
              options={MEDIA.map((value) => ({ value, label: value === "all" ? t.home.typeAny : t.feed.media[value] }))}
            />
            <FilterSelect
              label={t.feed.sortLabel}
              value={sort}
              onChange={(value) => setParam("sort", value, "latest")}
              options={SORTS.map((value) => ({ value, label: t.home.sortPrefix(t.feed.sort[value]) }))}
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
                    <FileTextIcon className="h-4 w-4" />
                    {t.nav.newNote}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className={`card px-4 transition-opacity ${refreshing ? "opacity-60" : ""}`} aria-busy={refreshing}>
              <p className="text-ink-500 border-line border-b py-3 text-xs" aria-live="polite">
                {t.feed.results(posts.length)}
              </p>
              <ul>
                {posts.map((post) => (
                  <NoteRow key={`${post.id}-${user?.id ?? "guest"}`} post={post} />
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="hidden lg:block" aria-label={t.home.explore}>
          <div className="sticky top-20">
            <TrendingSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}
