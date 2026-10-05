import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import { getTrending, type TrendingView } from "../services/api";
import Avatar from "./Avatar";
import { GraduationIcon } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";

/** The dashboard's right column: topics, schools and people worth a look. */
export default function TrendingSidebar() {
  const [data, setData] = useState<TrendingView | null>(null);

  useEffect(() => {
    getTrending()
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return <div className="bg-surface-hover animate-shimmer h-72 rounded-md" aria-hidden="true" />;
  }

  return (
    <div className="animate-fade space-y-6">
      <section>
        <h2 className="text-ink-900 mb-3 text-sm font-semibold">{t.feed.trendingTags}</h2>
        <ul className="flex flex-wrap gap-1.5">
          {data.tags.map((item) => (
            <li key={item.tag}>
              <Link to={`/?q=${encodeURIComponent(item.tag)}`} className="topic">
                {item.tag}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-line border-t pt-5">
        <h2 className="text-ink-900 mb-2 text-sm font-semibold">{t.feed.topSchools}</h2>
        <ul>
          {data.schools.map((school) => (
            <li key={school.name}>
              <Link
                to={`/?school=${encodeURIComponent(school.name)}`}
                className="hover:bg-surface-hover -mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1.5"
              >
                <GraduationIcon className="text-ink-500 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="text-ink-900 block truncate text-sm">{school.name}</span>
                  <span className="text-ink-500 block truncate text-xs">
                    {t.search.schoolMeta(school.country, school.students, school.posts)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-line border-t pt-5">
        <h2 className="text-ink-900 mb-2 text-sm font-semibold">{t.feed.topContributors}</h2>
        <ul>
          {data.people.map((person) => (
            <li key={person.id}>
              <Link to={`/u/${person.username}`} className="hover:bg-surface-hover -mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
                <Avatar user={person} size="sm" />
                <span className="min-w-0">
                  <span className="text-ink-900 flex items-center gap-1 text-sm font-semibold">
                    <span className="truncate">{person.displayName}</span>
                    {person.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                  </span>
                  <span className="text-ink-500 block truncate text-xs">{person.username}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
