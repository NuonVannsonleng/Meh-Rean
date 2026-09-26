import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { searchSuggestions } from "../services/api";
import type { PublicUser } from "../types";
import Avatar from "./Avatar";
import { SearchIcon } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";

/** Finds someone by name or username and opens a thread with them. */
export default function NewMessageDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PublicUser[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setPeople(null);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      searchSuggestions(term, "people", t.subjects)
        .then((result) => {
          if (!current) return;
          setPeople(result.people.filter((person) => person.id !== user?.id));
          setActive(0);
        })
        .catch(() => {
          if (current) setPeople([]);
        });
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query, user?.id]);

  const open = (person: PublicUser) => {
    dialogRef.current?.close();
    navigate(`/messages/${person.username}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = people?.length ?? 0;
    if (event.key === "Enter") {
      event.preventDefault();
      if (people?.[active]) open(people[active]);
    } else if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      setActive((index) => (index + 1) % count);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      setActive((index) => (index - 1 + count) % count);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={t.messages.newMessage}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-ink-900/25 backdrop:backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="bg-surface animate-page flex h-full flex-col pt-[env(safe-area-inset-top)] sm:mx-auto sm:mt-16 sm:h-auto sm:max-h-[min(32rem,calc(100dvh-6rem))] sm:w-[min(28rem,calc(100vw-2rem))] sm:rounded-2xl sm:border sm:border-line sm:pt-0 sm:shadow-2xl [@media(max-height:500px)]:sm:mt-3 [@media(max-height:500px)]:sm:max-h-[calc(100dvh-1.5rem)]">
        <div className="border-line flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4">
          <SearchIcon className="text-ink-400 h-5 w-5" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={Boolean(people?.length)}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={people?.length ? `${listId}-${active}` : undefined}
            aria-label={t.messages.searchPeople}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t.messages.searchPlaceholder}
            autoComplete="off"
            enterKeyHint="go"
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:min-h-40">
          {people === null ? (
            <p className="text-ink-500 px-3 py-6 text-center text-sm">{t.messages.searchPlaceholder}</p>
          ) : people.length === 0 ? (
            <p className="text-ink-500 px-3 py-6 text-center text-sm">{t.messages.noPeople}</p>
          ) : (
            <ul id={listId} role="listbox" aria-label={t.messages.searchPeople}>
              {people.map((person, index) => (
                <li
                  key={person.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onClick={() => open(person)}
                  onPointerMove={() => setActive(index)}
                  className={`press flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${
                    index === active ? "bg-surface-hover" : ""
                  }`}
                >
                  <Avatar user={person} />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink-900 flex items-center gap-1 text-sm font-semibold">
                      <span className="truncate">{person.displayName}</span>
                      {person.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                    </span>
                    <span className="text-ink-500 block truncate text-sm">
                      @{person.username}
                      {person.school && ` · ${person.school}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
