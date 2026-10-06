import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { subjectColor } from "../lib/subjects";
import { getFeed, getTrending, type TrendingView } from "../services/api";
import type { PostView } from "../types";
import Avatar from "./Avatar";
import { GraduationIcon, PlusIcon } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-ink-900 text-base font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The signed-in student's own shelf, one click from anywhere on the home page. */
function YourNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<PostView[] | null>(null);

  useEffect(() => {
    if (!user) return;
    getFeed({ authorUsername: user.username })
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [user]);

  if (!user) return null;

  return (
    <Panel
      title={t.home.yourNotes}
      action={
        <Link to="/create" className="btn-primary h-8 px-3 text-xs">
          <PlusIcon className="h-3.5 w-3.5" />
          {t.home.new}
        </Link>
      }
    >
      {notes === null ? (
        <p className="text-ink-500 text-sm">{t.common.loading}</p>
      ) : notes.length === 0 ? (
        <p className="text-ink-500 text-sm">{t.home.noNotesYet}</p>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {notes.slice(0, 5).map((note) => (
            <li key={note.id}>
              <Link to={`/post/${note.id}`} className="hover:bg-surface-hover flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
                <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: subjectColor(note.subject) }} />
                <span className="text-ink-900 min-w-0 truncate text-sm font-medium">{note.title}</span>
              </Link>
            </li>
          ))}
          {notes.length > 5 && (
            <li>
              <Link to={`/u/${user.username}?tab=notes`} className="text-accent block px-1.5 pt-1 text-xs font-semibold hover:underline">
                {t.home.showAll(notes.length)}
              </Link>
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

/** The home page's right column: your notes, then topics, schools and people. */
export default function TrendingSidebar() {
  const [data, setData] = useState<TrendingView | null>(null);

  useEffect(() => {
    getTrending()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className="animate-fade space-y-4">
      <YourNotes />
      {!data ? (
        <div className="bg-surface-hover animate-shimmer h-72 rounded-xl" aria-hidden="true" />
      ) : (
        <>
          <Panel title={t.feed.trendingTags}>
            <ul className="flex flex-wrap gap-1.5">
              {data.tags.map((item) => (
                <li key={item.tag}>
                  <Link to={`/?q=${encodeURIComponent(item.tag)}`} className="topic">
                    #{item.tag}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t.feed.topSchools}>
            <ul className="-mx-1.5">
              {data.schools.map((school) => (
                <li key={school.name}>
                  <Link
                    to={`/?school=${encodeURIComponent(school.name)}`}
                    className="hover:bg-surface-hover flex items-center gap-2.5 rounded-lg px-1.5 py-1.5"
                  >
                    <span className="bg-ribbon-50 text-ribbon-fg flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <GraduationIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="text-ink-900 block truncate text-sm font-medium">{school.name}</span>
                      <span className="text-ink-500 block truncate text-xs">
                        {t.search.schoolMeta(school.country, school.students, school.posts)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t.feed.topContributors}>
            <ul className="-mx-1.5">
              {data.people.map((person) => (
                <li key={person.id}>
                  <Link to={`/u/${person.username}`} className="hover:bg-surface-hover flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
                    <Avatar user={person} size="sm" />
                    <span className="min-w-0">
                      <span className="text-ink-900 flex items-center gap-1 text-sm font-semibold">
                        <span className="truncate">{person.displayName}</span>
                        {person.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                      </span>
                      <span className="text-ink-500 block truncate text-xs">@{person.username}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
