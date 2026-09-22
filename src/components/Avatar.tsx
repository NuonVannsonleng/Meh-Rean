import { initials } from "../lib/format";
import type { PublicUser } from "../types";

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-24 w-24 text-3xl sm:h-28 sm:w-28",
} as const;

/** Stable, restrained hues so each student gets a recognisable colour. */
const palette = [
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-100",
  "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-100",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-100",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-100",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100",
];

function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

interface AvatarProps {
  user: Pick<PublicUser, "id" | "displayName" | "avatarUrl">;
  size?: keyof typeof sizes;
  className?: string;
}

export default function Avatar({ user, size = "md", className = "" }: AvatarProps) {
  const shared = `${sizes[size]} shrink-0 rounded-full ${className}`;

  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={`${shared} object-cover`} />;
  }

  return (
    <span aria-hidden="true" className={`${shared} ${colorFor(user.id)} inline-flex items-center justify-center font-semibold`}>
      {initials(user.displayName)}
    </span>
  );
}
