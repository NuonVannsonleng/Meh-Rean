import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../i18n/en";
import { getTrending, searchSuggestions, type TrendingView } from "../services/api";
import type { SearchScope, SearchSuggestions } from "../types";
import Avatar from "./Avatar";
import { CloseIcon, FileTextIcon, GraduationIcon, SearchIcon } from "./Icons";

const RECENT_KEY = "meh-rean:recent-searches";
const SCOPES: SearchScope[] = ["all", "people", "schools", "subjects", "tags"];
const EMPTY: SearchSuggestions = { people: [], schools: [], subjects: [], tags: [] };

type ItemKind = "query" | "person" | "school" | "subject" | "tag";

interface RecentItem {
  kind: ItemKind;
  label: string;
  href: string;
}

interface Option extends RecentItem {
  key: string;
  group: string | null;
  render: ReactNode;
}

function readRecent(): RecentItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as RecentItem[]).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function writeRecent(items: RecentItem[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 6)));
  } catch {
    // Recent searches are a convenience only.
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bolds the parts of `text` that match the query terms. */
function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!terms.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${terms.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="text-ink-900 rounded-sm bg-transparent font-semibold">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Glyph({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>{children}</span>
  );
}

function buildOptions(query: string, scope: SearchScope, results: SearchSuggestions): Option[] {
  const q = query.trim();
  const options: Option[] = [];

  if (scope === "all") {
    options.push({
      key: "query",
      kind: "query",
      group: null,
      label: q,
      href: `/?q=${encodeURIComponent(q)}`,
      render: (
        <>
          <Glyph tone="bg-brand-50 text-accent">
            <SearchIcon className="h-4 w-4" />
          </Glyph>
          <span className="text-ink-900 truncate text-sm font-medium">{t.search.searchPostsFor(q)}</span>
        </>
      ),
    });
  }

  for (const person of results.people) {
    options.push({
      key: `person-${person.id}`,
      kind: "person",
      group: t.search.people,
      label: person.displayName,
      href: `/u/${person.username}`,
      render: (
        <>
          <Avatar user={person} size="sm" className="mx-0.5" />
          <span className="min-w-0">
            <span className="text-ink-700 block truncate text-sm">
              <Highlight text={person.displayName} query={q} />
            </span>
            <span className="text-ink-500 block truncate text-xs">
              @<Highlight text={person.username} query={q} />
              {person.school && (
                <>
                  {" · "}
                  <Highlight text={person.school} query={q} />
                </>
              )}
            </span>
          </span>
        </>
      ),
    });
  }

  for (const school of results.schools) {
    options.push({
      key: `school-${school.name}`,
      kind: "school",
      group: t.search.schools,
      label: school.name,
      href: `/?school=${encodeURIComponent(school.name)}`,
      render: (
        <>
          <Glyph tone="bg-ribbon-50 text-ribbon-fg">
            <GraduationIcon className="h-4.5 w-4.5" />
          </Glyph>
          <span className="min-w-0">
            <span className="text-ink-700 block truncate text-sm">
              <Highlight text={school.name} query={q} />
            </span>
            <span className="text-ink-500 block truncate text-xs">
              {t.search.schoolMeta(school.country, school.students, school.posts)}
            </span>
          </span>
        </>
      ),
    });
  }

  for (const item of results.subjects) {
    options.push({
      key: `subject-${item.subject}`,
      kind: "subject",
      group: t.search.subjects,
      label: t.subjects[item.subject],
      href: `/?subject=${item.subject}`,
      render: (
        <>
          <Glyph tone="bg-surface-hover text-ink-700">
            <FileTextIcon className="h-4 w-4" />
          </Glyph>
          <span className="min-w-0">
            <span className="text-ink-700 block truncate text-sm">
              <Highlight text={t.subjects[item.subject]} query={q} />
            </span>
            <span className="text-ink-500 block text-xs">{t.search.postsCount(item.posts)}</span>
          </span>
        </>
      ),
    });
  }

  for (const item of results.tags) {
    options.push({
      key: `tag-${item.tag}`,
      kind: "tag",
      group: t.search.tags,
      label: `#${item.tag}`,
      href: `/?q=${encodeURIComponent(item.tag)}`,
      render: (
        <>
          <Glyph tone="bg-surface-hover text-accent">
            <span className="text-base font-bold">#</span>
          </Glyph>
          <span className="min-w-0">
            <span className="text-ink-700 block truncate text-sm">
              <Highlight text={item.tag} query={q} />
            </span>
            <span className="text-ink-500 block text-xs">{t.search.postsCount(item.posts)}</span>
          </span>
        </>
      ),
    });
  }

  return options;
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [results, setResults] = useState<SearchSuggestions>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentItem[]>(readRecent);
  const [trending, setTrending] = useState<TrendingView | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    inputRef.current?.focus();
    getTrending()
      .then(setTrending)
      .catch(() => setTrending(null));
  }, []);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchSuggestions(trimmed, scope, t.subjects)
        .then((next) => live && setResults(next))
        .catch(() => live && setResults(EMPTY))
        .finally(() => live && setLoading(false));
    }, 140);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [trimmed, scope]);

  const options = useMemo(
    () => (trimmed ? buildOptions(trimmed, scope, results) : []),
    [trimmed, scope, results],
  );

  useEffect(() => setActive(0), [trimmed, scope]);

  const go = useCallback(
    (item: RecentItem) => {
      const next = [item, ...readRecent().filter((entry) => entry.href !== item.href)];
      writeRecent(next);
      onClose();
      navigate(item.href);
    },
    [navigate, onClose],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[active];
      if (option) go({ kind: option.kind, label: option.label, href: option.href });
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const hasMatches = options.some((option) => option.kind !== "query");

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={t.search.label}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-ink-900/25 backdrop:backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="bg-surface animate-page flex h-full flex-col pt-[env(safe-area-inset-top)] sm:mx-auto sm:mt-16 sm:h-auto sm:max-h-[min(38rem,calc(100dvh-6rem))] sm:w-[min(40rem,calc(100vw-2rem))] sm:rounded-2xl sm:border sm:border-line sm:pt-0 sm:shadow-2xl [@media(max-height:500px)]:sm:mt-3 [@media(max-height:500px)]:sm:max-h-[calc(100dvh-1.5rem)]">
        {/* Input */}
        <div className="border-line flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4">
          <SearchIcon className="text-ink-400 h-5 w-5" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={options.length ? `${listId}-${active}` : undefined}
            aria-label={t.search.label}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.search.placeholder}
            autoComplete="off"
            enterKeyHint="search"
            className="text-ink-900 placeholder:text-ink-400 h-10 min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label={t.search.clear} className="icon-btn animate-pop h-8 w-8">
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t.search.close}
            className="text-ink-700 hover:bg-surface-hover press rounded-lg px-2.5 py-1.5 text-sm font-medium"
          >
            <span aria-hidden="true" className="sm:hidden">
              {t.common.cancel}
            </span>
            <kbd aria-hidden="true" className="border-line text-ink-500 hidden rounded-md border px-1.5 py-0.5 text-xs font-medium sm:inline">
              Esc
            </kbd>
          </button>
        </div>

        {/* Scopes */}
        <div role="group" aria-label={t.search.scopesLabel} className="scroll-row mx-0 shrink-0 px-3 pt-3 pb-1 sm:px-4">
          {SCOPES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => {
                setScope(value);
                inputRef.current?.focus();
              }}
              className={`press h-8 shrink-0 rounded-full px-3 text-sm font-medium ${
                scope === value ? "bg-brand-600 text-white" : "bg-surface-hover text-ink-700 hover:text-ink-900"
              }`}
            >
              {t.search.scopes[value]}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-3 sm:px-2.5">
          {trimmed ? (
            <>
              <ul id={listId} role="listbox" aria-label={t.search.label} className="space-y-0.5">
                {options.map((option, index) => {
                  const showGroup = option.group && option.group !== options[index - 1]?.group;
                  return (
                    <li key={option.key} role="presentation">
                      {showGroup && (
                        <p className="text-ink-500 px-2.5 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase" aria-hidden="true">
                          {option.group}
                        </p>
                      )}
                      <div
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={index === active}
                        onPointerMove={() => setActive(index)}
                        onClick={() => go({ kind: option.kind, label: option.label, href: option.href })}
                        style={{ animationDelay: `${Math.min(index, 8) * 18}ms` }}
                        className={`animate-fade flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-100 ${
                          index === active ? "bg-surface-hover" : ""
                        }`}
                      >
                        {option.render}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {loading && !hasMatches && (
                <p role="status" className="text-ink-500 px-3 py-4 text-sm">
                  {t.search.loading}
                </p>
              )}
              {!loading && !hasMatches && (
                <p className="text-ink-500 px-3 py-4 text-sm">{t.search.noResults(trimmed)}</p>
              )}
            </>
          ) : (
            <div className="animate-fade space-y-5 px-1.5 pt-2">
              {recent.length > 0 && (
                <section>
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-ink-500 text-xs font-semibold tracking-wide uppercase">{t.search.recent}</h2>
                    <button
                      type="button"
                      onClick={() => {
                        writeRecent([]);
                        setRecent([]);
                      }}
                      className="link text-xs"
                    >
                      {t.search.clearRecent}
                    </button>
                  </div>
                  <ul className="mt-1.5">
                    {recent.map((item) => (
                      <li key={item.href}>
                        <button
                          type="button"
                          onClick={() => go(item)}
                          className="hover:bg-surface-hover text-ink-700 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm"
                        >
                          <SearchIcon className="text-ink-400 h-4 w-4" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {trending && (
                <section>
                  <h2 className="text-ink-500 px-1 text-xs font-semibold tracking-wide uppercase">{t.search.trending}</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {trending.tags.map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => go({ kind: "tag", label: `#${item.tag}`, href: `/?q=${encodeURIComponent(item.tag)}` })}
                        className="bg-surface-hover text-accent hover:bg-brand-50 press h-8 rounded-full px-3 text-sm font-medium"
                      >
                        #{item.tag}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {trending && trending.schools.length > 0 && (
                <section>
                  <h2 className="text-ink-500 px-1 text-xs font-semibold tracking-wide uppercase">{t.search.schools}</h2>
                  <ul className="mt-1.5">
                    {trending.schools.map((school) => (
                      <li key={school.name}>
                        <button
                          type="button"
                          onClick={() =>
                            go({ kind: "school", label: school.name, href: `/?school=${encodeURIComponent(school.name)}` })
                          }
                          className="hover:bg-surface-hover flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
                        >
                          <Glyph tone="bg-ribbon-50 text-ribbon-fg">
                            <GraduationIcon className="h-4.5 w-4.5" />
                          </Glyph>
                          <span className="min-w-0">
                            <span className="text-ink-700 block truncate text-sm">{school.name}</span>
                            <span className="text-ink-500 block truncate text-xs">
                              {t.search.schoolMeta(school.country, school.students, school.posts)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <p className="border-line text-ink-400 hidden shrink-0 border-t px-4 py-2 text-xs sm:block [@media(max-height:500px)]:hidden">{t.search.keyboardHint}</p>
      </div>
    </dialog>
  );
}

/** Compact search trigger for the navbar; opens a full search panel. */
export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if ((event.key === "/" && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.search.open}
        aria-haspopup="dialog"
        aria-keyshortcuts="/ Control+K"
        className="press group border-line bg-surface-muted text-ink-500 hover:border-brand-300 hover:text-ink-700 flex h-9 w-9 items-center justify-center gap-2 rounded-full border sm:w-44 sm:justify-start sm:px-3 md:w-56 lg:w-64"
      >
        <SearchIcon className="group-hover:text-accent h-4 w-4 transition-colors" />
        <span className="hidden flex-1 text-left text-sm sm:inline">{t.search.open}</span>
        <kbd className="border-line bg-surface hidden rounded-md border px-1.5 text-[11px] font-medium md:inline">
          {t.search.shortcutHint}
        </kbd>
      </button>
      {open && <SearchPanel onClose={close} />}
    </>
  );
}
