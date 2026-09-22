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
  "bg-[#e3ecd9] text-[#3f5a2c] dark:bg-[#34452a] dark:text-[#d7e6c7]",
  "bg-[#d9eaee] text-[#2c5f6b] dark:bg-[#23414a] dark:text-[#cde6ec]",
  "bg-[#f6e3c9] text-[#7a4f1d] dark:bg-[#4a3620] dark:text-[#f3dcbc]",
  "bg-[#f3dccf] text-[#8a3f22] dark:bg-[#4d2c20] dark:text-[#f2d2c2]",
  "bg-[#ece5cf] text-[#5c5226] dark:bg-[#403a22] dark:text-[#e9e0c2]",
  "bg-[#f1d9d9] text-[#8a3a3a] dark:bg-[#4a2626] dark:text-[#f0d0d0]",
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
