import { useCallback, useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import ChipGroup, { type ChipOption } from "../components/ChipGroup";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ChipScroller from "../components/ChipScroller";
import FilterMenu from "../components/FilterMenu";
import { ChevronDownIcon, CloseIcon, FileTextIcon, ImageIcon, SearchIcon, VideoIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import PostCard from "../components/PostCard";
import SideNav from "../components/SideNav";
import TrendingSidebar from "../components/TrendingSidebar";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
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

const sortOptions: ChipOption<FeedSort>[] = (["latest", "top", "discussed"] as const).map((value) => ({
  value,
  label: t.feed.sort[value],
}));

const subjectOptions: ChipOption<Subject | "all">[] = [
  { value: "all", label: t.feed.all },
  ...SUBJECTS.map((value) => ({ value, label: t.subjects[value] })),
];

const levelOptions: ChipOption<EducationLevel | "all">[] = [
  { value: "all", label: t.feed.all },
  ...EDUCATION_LEVELS.map((value) => ({ value, label: t.levels[value] })),
];

const mediaOptions: ChipOption<MediaFilter>[] = (["all", "documents", "images", "videos"] as const).map((value) => ({
  value,
  label: t.feed.media[value],
}));

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

function Composer() {
  const { user } = useAuth();

  if (!user) {
    return (
      <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ink-700 text-sm sm:text-base">{t.feed.composerGuest}</p>
        <div className="flex shrink-0 gap-2">
          <Link to="/login" className="btn-secondary flex-1 sm:flex-none">
            {t.nav.signIn}
          </Link>
          <Link to="/signup" className="btn-primary flex-1 sm:flex-none">
            {t.nav.signUp}
          </Link>
        </div>
      </section>
    );
  }

  const quick = [
    { Icon: ImageIcon, label: t.feed.media.images, tone: "text-ribbon-fg" },
    { Icon: VideoIcon, label: t.feed.media.videos, tone: "text-react-wow" },
    { Icon: FileTextIcon, label: t.feed.media.documents, tone: "text-accent" },
  ];

  return (
    <section className="card p-3 sm:p-4" aria-label={t.feed.composerAction}>
      <div className="flex items-center gap-3">
        <Avatar user={user} />
        <Link
          to="/create"
          className="bg-surface-hover text-ink-500 hover:text-ink-700 press flex h-11 min-w-0 flex-1 items-center rounded-full px-4 text-sm sm:text-[15px]"
        >
          <span className="truncate">{t.feed.composerPrompt(user.displayName.split(" ")[0])}</span>
        </Link>
      </div>
      <div className="border-line mt-3 flex gap-1 border-t pt-2">
        {quick.map(({ Icon, label, tone }) => (
          <Link
            key={label}
            to="/create"
            className="press text-ink-700 hover:bg-surface-hover flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap sm:gap-2 sm:text-sm"
          >
            <Icon className={`h-5 w-5 ${tone}`} />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-brand-50 text-accent animate-pop inline-flex h-8 max-w-full items-center gap-1 rounded-full pr-1 pl-3 text-sm font-medium">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t.feed.removeFilter(label)}
        className="hover:bg-brand-100 press flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

export default function Home() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const query = params.get("q") ?? "";
  const school = params.get("school") ?? "";
  const sort = pick(params.get("sort"), ["latest", "top", "discussed"] as const, "latest");
  const subject = pick<Subject | "all">(params.get("subject"), SUBJECTS, "all");
  const level = pick<EducationLevel | "all">(params.get("level"), EDUCATION_LEVELS, "all");
  const media = pick(params.get("media"), ["all", "documents", "images", "videos"] as const, "all");
  const sortId = useId();

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

  const menuFilters = (level !== "all" ? 1 : 0) + (media !== "all" ? 1 : 0);
  const hasFilters = Boolean(query) || Boolean(school) || subject !== "all" || menuFilters > 0;

  const resetFilters = () => setParams(sort === "latest" ? {} : { sort }, { replace: true });
  const clearMenuFilters = () => {
    setParam("level", "all", "all");
    setParam("media", "all", "all");
  };

  const activeChips: ActiveChip[] = [];
  if (school) activeChips.push({ key: "school", label: t.feed.schoolFilter(school), remove: () => setParam("school", "", "") });
  if (media !== "all") activeChips.push({ key: "media", label: t.feed.media[media], remove: () => setParam("media", "all", "all") });
  if (level !== "all") activeChips.push({ key: "level", label: t.levels[level], remove: () => setParam("level", "all", "all") });

  return (
    <div className="container-page py-6 sm:py-10 xl:max-w-7xl">
      {!user && !query && !school && (
        <section className="card ruled-paper animate-rise relative mb-8 overflow-hidden px-5 py-8 sm:px-10 sm:py-12">
          <span
            aria-hidden="true"
            className="bg-logo-ribbon animate-ribbon absolute top-0 right-5 h-16 w-6 [animation-delay:200ms] [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)] sm:right-12 sm:h-28 sm:w-9"
          />
          <div className="max-w-2xl pr-8 sm:pr-16">
            <p className="text-accent mb-3 text-sm font-semibold tracking-wide uppercase">{t.common.tagline}</p>
            <h1 className="text-ink-900 text-3xl leading-[1.05] sm:text-5xl">{t.feed.title}</h1>
            <p className="text-ink-700 mt-4 text-base sm:text-lg">{t.feed.subtitle}</p>
          </div>
        </section>
      )}
      {(user || query || school) && <h1 className="sr-only">{query ? t.feed.resultsFor(query) : t.nav.feed}</h1>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <SideNav />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {query ? (
            <div className="animate-fade flex items-center justify-between gap-3">
              <p className="text-ink-900 min-w-0 truncate text-lg font-semibold" aria-hidden="true">
                {t.feed.resultsFor(query)}
              </p>
              <button type="button" onClick={() => setParam("q", "", "")} className="link shrink-0 text-sm">
                {t.feed.clearSearch}
              </button>
            </div>
          ) : (
            <Composer />
          )}

          <section aria-label={t.feed.controlsLabel} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="relative">
                <label htmlFor={sortId} className="sr-only">
                  {t.feed.sortLabel}
                </label>
                <select
                  id={sortId}
                  value={sort}
                  onChange={(event) => setParam("sort", event.target.value, "latest")}
                  className="press border-line bg-surface text-ink-900 hover:border-brand-300 h-9 cursor-pointer appearance-none rounded-full border py-0 pr-9 pl-3.5 text-base font-semibold sm:text-sm"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="text-ink-500 pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
              </div>

              <FilterMenu activeCount={menuFilters} onClear={clearMenuFilters}>
                <ChipGroup
                  legend={t.feed.mediaLabel}
                  layout="wrap"
                  options={mediaOptions}
                  selected={media}
                  onSelect={(value) => setParam("media", value, "all")}
                />
                <ChipGroup
                  legend={t.feed.levelLabel}
                  layout="wrap"
                  options={levelOptions}
                  selected={level}
                  onSelect={(value) => setParam("level", value, "all")}
                />
              </FilterMenu>
            </div>

            <ChipScroller
              label={t.feed.subjectLabel}
              options={subjectOptions}
              selected={subject}
              onSelect={(value) => setParam("subject", value, "all")}
              scrollLeftLabel={t.feed.scrollLeft}
              scrollRightLabel={t.feed.scrollRight}
            />

            {activeChips.length > 0 && (
              <div role="group" aria-label={t.feed.activeFilters} className="flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <RemovableChip key={chip.key} label={chip.label} onRemove={chip.remove} />
                ))}
              </div>
            )}
          </section>

          <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
            <p className="text-ink-500" aria-live="polite">
              {posts && !hasError ? t.feed.results(posts.length) : ""}
            </p>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="link">
                {t.feed.clearAll}
              </button>
            )}
          </div>

          {hasError ? (
            <ErrorState onRetry={load} />
          ) : posts === null ? (
            <LoadingState />
          ) : posts.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" />}
              title={t.feed.emptyTitle}
              body={t.feed.emptyBody}
              action={
                <button type="button" onClick={resetFilters} className="btn-primary">
                  {t.feed.reset}
                </button>
              }
            />
          ) : (
            <div
              className={`space-y-4 transition-opacity duration-200 ${refreshing ? "opacity-60" : ""}`}
              aria-busy={refreshing}
            >
              {posts.map((post, index) => (
                <PostCard
                  key={`${post.id}-${user?.id ?? "guest"}`}
                  post={post}
                  index={index}
                  onDeleted={(id) => setPosts((current) => current?.filter((item) => item.id !== id) ?? null)}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-2xl [scrollbar-width:thin]">
            <TrendingSidebar />
          </div>
        </aside>
      </div>
    </div>
  );
}
