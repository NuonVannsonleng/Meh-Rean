import type { ReactionType } from "../types";

/** Solid white glyphs drawn on a coloured badge — no emoji, consistent everywhere. */
const glyphs: Record<ReactionType, string> = {
  like: "M2.5 10.2h3.2v10H2.5zM7.4 20.2V10.1l4.3-6.4a1.9 1.9 0 0 1 3.4 1.5l-.9 4.2h5.3a2 2 0 0 1 2 2.4l-1.3 6.8a2 2 0 0 1-2 1.6z",
  love: "M12 20.6s-7.6-4.6-9.3-9.4C1.6 7.9 3.5 4.4 7.1 4.4c2 0 3.3 1.1 4.9 3 1.6-1.9 2.9-3 4.9-3 3.6 0 5.5 3.5 4.4 6.8-1.7 4.8-9.3 9.4-9.3 9.4z",
  insightful:
    "M12 2.3a7 7 0 0 0-4.3 12.6c.8.6 1.3 1.5 1.3 2.5h6c0-1 .5-1.9 1.3-2.5A7 7 0 0 0 12 2.3zM9 18.8h6v1.3a1.9 1.9 0 0 1-1.9 1.9h-2.2A1.9 1.9 0 0 1 9 20.1z",
  thanks: "M12 3.2 1.3 8.6 12 14l8.7-4.4v6.2h1.8V8.6zM5.6 12.3v3.8c1.6 1.7 3.9 2.7 6.4 2.7s4.8-1 6.4-2.7v-3.8L12 15.6z",
  wow: "M10.5 2.5l1.9 5.4 5.4 1.9-5.4 1.9-1.9 5.4-1.9-5.4-5.4-1.9 5.4-1.9zM18.2 13.6l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z",
};

export const reactionColor: Record<ReactionType, string> = {
  like: "var(--color-react-like)",
  love: "var(--color-react-love)",
  insightful: "var(--color-react-insightful)",
  thanks: "var(--color-react-thanks)",
  wow: "var(--color-react-wow)",
};

interface ReactionIconProps {
  type: ReactionType;
  className?: string;
  glyphClassName?: string;
}

export default function ReactionIcon({ type, className = "h-5 w-5", glyphClassName = "h-[62%] w-[62%]" }: ReactionIconProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)] ${className}`}
      style={{ backgroundColor: reactionColor[type] }}
    >
      <svg viewBox="0 0 24 24" className={glyphClassName} fill="white">
        <path d={glyphs[type]} />
      </svg>
    </span>
  );
}
