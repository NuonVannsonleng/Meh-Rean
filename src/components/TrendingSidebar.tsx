import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import { getTrending, type TrendingView } from "../services/api";
import Avatar from "./Avatar";
import { GraduationIcon } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";

/** Discovery column: trending tags, active schools and top contributors. */
export default function TrendingSidebar() {
  const [data, setData] = useState<TrendingView | null>(null);

  useEffect(() => {
    getTrending()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return <div className="card bg-surface-hover animate-shimmer h-72" aria-hidden="true" />;
  }

  return (
    <div className="animate-fade space-y-4">
      <section className="card p-5">
        <h2 className="text-ink-900 mb-3 text-base font-semibold">{t.feed.trendingTags}</h2>
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((item) => (
            <Link
              key={item.tag}
              to={`/?q=${encodeURIComponent(item.tag)}`}
              className="bg-surface-hover text-accent hover:bg-brand-50 press inline-flex h-8 items-center rounded-full px-3 text-sm font-medium"
            >
              #{item.tag}
            </Link>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-ink-900 mb-2 text-base font-semibold">{t.feed.topSchools}</h2>
        <ul className="-mx-2">
          {data.schools.map((school) => (
            <li key={school.name}>
              <Link
                to={`/?school=${encodeURIComponent(school.name)}`}
                className="hover:bg-surface-hover flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
              >
                <span className="bg-ribbon-50 text-ribbon-fg flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <GraduationIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="text-ink-700 block truncate text-sm font-medium">{school.name}</span>
                  <span className="text-ink-500 block truncate text-xs">
                    {t.search.schoolMeta(school.country, school.students, school.posts)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-ink-900 mb-2 text-base font-semibold">{t.feed.topContributors}</h2>
        <ul className="-mx-2">
          {data.people.map((person) => (
            <li key={person.id}>
              <Link
                to={`/u/${person.username}`}
                className="hover:bg-surface-hover flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
              >
                <Avatar user={person} size="sm" />
                <span className="min-w-0">
                  <span className="text-ink-700 flex items-center gap-1 text-sm font-medium">
                    <span className="truncate">{person.displayName}</span>
                    {person.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-ink-500 block truncate text-xs">@{person.username}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
