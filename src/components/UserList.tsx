import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import type { PublicUser } from "../types";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";

interface UserListProps {
  people: PublicUser[];
}

/** Rows of accounts, used for follower and following lists. */
export default function UserList({ people }: UserListProps) {
  return (
    <ul className="card animate-fade divide-line divide-y">
      {people.map((person) => (
        <li key={person.id}>
          <Link
            to={`/u/${person.username}`}
            className="hover:bg-surface-hover flex items-center gap-3 p-4 transition-colors"
          >
            <Avatar user={person} size="lg" className="h-12 w-12" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="text-ink-900 truncate font-semibold">{person.displayName}</span>
                {person.verified && <VerifiedBadge />}
              </span>
              <span className="text-ink-500 block truncate text-sm">@{person.username}</span>
              {person.school && <span className="text-ink-500 block truncate text-sm">{person.school}</span>}
            </span>
            <span className="text-accent shrink-0 text-sm font-semibold">{t.profile.viewProfile}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
