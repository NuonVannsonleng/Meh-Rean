import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { t } from "../i18n/en";
import { normalizeText } from "../lib/institutions";
import { MORE_SUBJECTS, SUBJECT_COLORS, type SubjectEntry } from "../lib/subjects";
import { SUBJECTS } from "../types";
import { CheckIcon, SearchIcon } from "./Icons";

/**
 * Every specific subject, grouped under its main one, with a search box.
 * Picking is one tap; nothing has to be typed unless the student wants to
 * narrow the list.
 */
export default function SubjectPicker({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    inputRef.current?.focus();
  }, []);

  const groups = useMemo(() => {
    const terms = normalizeText(query.trim()).split(/\s+/).filter(Boolean);
    const matches = (entry: SubjectEntry) => {
      const haystack = normalizeText(`${entry.label} ${t.subjects[entry.category]}`);
      return terms.every((term) => haystack.includes(term));
    };
    return SUBJECTS.map((category) => ({
      category,
      entries: MORE_SUBJECTS.filter((entry) => entry.category === category && matches(entry)),
    })).filter((group) => group.entries.length);
  }, [query]);

  const first = groups[0]?.entries[0];
  const choose = (id: string) => {
    onSelect(id);
    dialogRef.current?.close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // The picker sits inside the New note form, which must not submit from here.
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (first) choose(first.id);
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={t.create.subjectPickerTitle}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-ink-900/25 backdrop:backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="bg-surface animate-page flex h-full flex-col pt-[env(safe-area-inset-top)] sm:mx-auto sm:mt-16 sm:h-auto sm:max-h-[min(40rem,calc(100dvh-6rem))] sm:w-[min(36rem,calc(100vw-2rem))] sm:rounded-2xl sm:border sm:border-line sm:pt-0 sm:shadow-2xl">
        <div className="border-line flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4">
          <SearchIcon className="text-ink-400 h-5 w-5" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.create.subjectSearchPlaceholder}
            aria-label={t.create.subjectSearchLabel}
            autoComplete="off"
            enterKeyHint="search"
            className="text-ink-900 placeholder:text-ink-400 h-10 min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="text-ink-700 hover:bg-surface-hover press rounded-lg px-2.5 py-1.5 text-sm font-medium"
          >
            {t.common.cancel}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {groups.length === 0 && <p className="text-ink-500 px-3 py-8 text-center text-sm">{t.create.subjectNoMatch(query.trim())}</p>}
          {groups.map(({ category, entries }) => (
            <section key={category} aria-label={t.subjects[category]}>
              <h3 className="text-ink-500 flex items-center gap-2 px-3 pt-4 pb-1.5 text-xs font-semibold tracking-wide uppercase">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[category] }} />
                {t.subjects[category]}
              </h3>
              <ul className="grid gap-1 sm:grid-cols-2">
                {entries.map((entry) => {
                  const selected = entry.id === value;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => choose(entry.id)}
                        aria-pressed={selected}
                        className={`press flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm ${
                          selected ? "bg-brand-50 text-accent font-semibold" : "text-ink-900 hover:bg-surface-hover"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                        {selected && <CheckIcon className="h-4 w-4 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <div className="border-line mt-3 border-t px-1 pt-3">
            <button
              type="button"
              onClick={() => choose("other")}
              aria-pressed={value === "other"}
              className={`press flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm ${
                value === "other" ? "bg-brand-50 text-accent font-semibold" : "text-ink-700 hover:bg-surface-hover"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SUBJECT_COLORS.other }} />
              {t.create.subjectNotListed}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
