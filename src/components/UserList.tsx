import { Link } from "react-router-dom";
import type { PublicUser } from "../types";
import Avatar from "./Avatar";
import { GraduationIcon } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";

interface UserListProps {
  people: PublicUser[];
}

/** Rows of accounts, used for follower and following lists. */
export default function UserList({ people }: UserListProps) {
  return (
    <ul className="animate-fade">
      {people.map((person) => (
        <li key={person.id} className="border-line flex gap-4 border-b py-5 first:pt-0 last:border-b-0">
          <Link to={`/u/${person.username}`} className="shrink-0 rounded-full" tabIndex={-1} aria-hidden="true">
            <Avatar user={person} size="lg" className="h-12 w-12" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <Link to={`/u/${person.username}`} className="text-ink-900 inline-flex items-center gap-1 font-semibold hover:underline">
                {person.displayName}
                {person.verified && <VerifiedBadge className="h-4 w-4" />}
              </Link>
              <span className="text-ink-500 text-sm">{person.username}</span>
            </p>
            {person.bio && <p className="text-ink-500 mt-1 line-clamp-2 text-sm">{person.bio}</p>}
            {person.school && (
              <p className="text-ink-500 mt-1.5 flex items-center gap-1.5 text-xs">
                <GraduationIcon className="h-3.5 w-3.5" />
                {person.school}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
