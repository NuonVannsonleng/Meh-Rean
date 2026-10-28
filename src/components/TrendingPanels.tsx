import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import { getTrending, type TrendingView } from "../services/api";
import Avatar from "./Avatar";
import { GraduationIcon } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card min-w-0 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-ink-900 text-base font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Popular tags, schools and people, for the Explore page. */
export default function TrendingPanels({ className = "space-y-4" }: { className?: string }) {
  const [data, setData] = useState<TrendingView | null>(null);

  useEffect(() => {
    getTrending()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <div className={`animate-fade ${className}`}>
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
