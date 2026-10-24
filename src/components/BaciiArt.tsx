import { useId, type ReactNode } from "react";

// Small drawings for the BacII page, in the app's own colours: greys from the
// theme and the signature green as the one highlight, so they follow light and
// dark mode. Drawn in SVG, so they weigh almost nothing on a slow phone.

type ArtProps = { className?: string };

/** Shared frame: a soft floor shadow and the gradients every drawing uses. */
function Art({ className, viewBox = "0 0 120 96", children }: ArtProps & { viewBox?: string; children: (ids: Ids) => ReactNode }) {
  const id = useId().replace(/:/g, "");
  const ids = { green: `g-${id}`, light: `l-${id}`, sheet: `s-${id}`, shadow: `d-${id}` };
  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={ids.green} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-brand-400)" />
          <stop offset="1" stopColor="var(--color-brand-700)" />
        </linearGradient>
        <linearGradient id={ids.light} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-surface)" />
          <stop offset="1" stopColor="var(--color-surface-hover)" />
        </linearGradient>
        <linearGradient id={ids.sheet} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-surface)" />
          <stop offset="1" stopColor="var(--color-line)" />
        </linearGradient>
        <radialGradient id={ids.shadow}>
          <stop offset="0" stopColor="var(--color-ink-900)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--color-ink-900)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {children(ids)}
    </svg>
  );
}
type Ids = { green: string; light: string; sheet: string; shadow: string };
const url = (id: string) => `url(#${id})`;
const LINE = "var(--color-line)";
const INK = "var(--color-ink-900)";

/** Banner: a stack of books with a mortar board and a few sparkles. */
export function BooksArt({ className }: ArtProps) {
  return (
    <Art className={className} viewBox="0 0 220 170">
      {(ids) => (
        <>
          <ellipse cx="112" cy="156" rx="92" ry="10" fill={url(ids.shadow)} />
          {/* Bottom book */}
          <rect x="30" y="118" width="160" height="34" rx="6" fill={url(ids.sheet)} stroke={LINE} strokeWidth="2" />
          <rect x="30" y="118" width="14" height="34" rx="4" fill="var(--color-ink-700)" />
          <path d="M50 128 H180 M50 136 H180 M50 144 H180" stroke={LINE} strokeWidth="2" />
          {/* Green book */}
          <rect x="42" y="84" width="152" height="34" rx="6" fill={url(ids.green)} />
          <rect x="42" y="84" width="14" height="34" rx="4" fill="var(--color-brand-800)" />
          <path d="M64 95 H184" stroke="white" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
          <path d="M64 104 H150" stroke="white" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
          {/* Top book */}
          <rect x="36" y="52" width="148" height="32" rx="6" fill={url(ids.light)} stroke={LINE} strokeWidth="2" />
          <rect x="36" y="52" width="14" height="32" rx="4" fill="var(--color-ink-500)" />
          <path d="M58 63 H174 M58 72 H160" stroke={LINE} strokeWidth="2" />
          {/* Mortar board */}
          <path d="M66 38 L118 16 L170 38 L118 60 Z" fill={INK} />
          <path d="M86 46 V58 C86 66 150 66 150 58 V46 L118 60 Z" fill="var(--color-ink-700)" />
          <path d="M170 38 V62" stroke="var(--color-brand-500)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="170" cy="66" r="5" fill="var(--color-brand-500)" />
          {/* Sparkles */}
          <path d="M200 30 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" fill="var(--color-brand-400)" />
          <path d="M28 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="var(--color-ink-400)" opacity="0.6" />
          <circle cx="196" cy="74" r="3" fill="var(--color-ink-400)" opacity="0.5" />
        </>
      )}
    </Art>
  );
}

/** Past papers: two exam sheets and a pencil. */
export function PapersArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      {(ids) => (
        <>
          <ellipse cx="62" cy="88" rx="46" ry="6" fill={url(ids.shadow)} />
          <rect x="34" y="12" width="52" height="68" rx="5" fill={url(ids.sheet)} stroke={LINE} strokeWidth="2" transform="rotate(-8 60 46)" />
          <rect x="42" y="16" width="52" height="68" rx="5" fill={url(ids.light)} stroke={LINE} strokeWidth="2" />
          <rect x="49" y="23" width="26" height="6" rx="3" fill={url(ids.green)} />
          <path d="M49 37 H87 M49 45 H87 M49 53 H80 M49 61 H84 M49 69 H72" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
          <g transform="rotate(38 96 56)">
            <rect x="90" y="22" width="10" height="56" rx="2" fill={url(ids.green)} />
            <rect x="90" y="22" width="10" height="8" rx="2" fill="var(--color-ink-500)" />
            <path d="M90 78 L95 90 L100 78 Z" fill="var(--color-ink-400)" />
            <path d="M93.5 86.5 L95 90 L96.5 86.5 Z" fill={INK} />
          </g>
        </>
      )}
    </Art>
  );
}

/** Practice by chapter: an open book with a green bookmark. */
export function OpenBookArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      {(ids) => (
        <>
          <ellipse cx="60" cy="86" rx="48" ry="6" fill={url(ids.shadow)} />
          <path d="M12 26 Q36 18 60 28 V80 Q36 70 12 78 Z" fill={url(ids.light)} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
          <path d="M108 26 Q84 18 60 28 V80 Q84 70 108 78 Z" fill={url(ids.sheet)} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
          <path d="M20 38 Q36 33 52 39 M20 48 Q36 43 52 49 M20 58 Q36 53 52 59" stroke={LINE} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M68 39 Q84 33 100 38 M68 49 Q84 43 100 48 M68 59 Q80 55 92 57" stroke={LINE} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M84 22 H94 V46 L89 41 L84 46 Z" fill={url(ids.green)} />
          <path d="M100 8 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 z" fill="var(--color-brand-400)" />
        </>
      )}
    </Art>
  );
}

/** Paper exam timer: an alarm clock. */
export function ClockArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      {(ids) => (
        <>
          <ellipse cx="60" cy="88" rx="36" ry="6" fill={url(ids.shadow)} />
          <path d="M32 80 L26 88 M88 80 L94 88" stroke="var(--color-ink-500)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="34" cy="20" r="11" fill={url(ids.green)} />
          <circle cx="86" cy="20" r="11" fill={url(ids.green)} />
          <circle cx="60" cy="50" r="34" fill={url(ids.green)} />
          <circle cx="60" cy="50" r="27" fill={url(ids.light)} />
          <path d="M60 27 V32 M60 68 V73 M37 50 H42 M78 50 H83" stroke="var(--color-ink-400)" strokeWidth="3" strokeLinecap="round" />
          <path d="M60 50 V35 M60 50 L71 57" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="60" cy="50" r="3.5" fill="var(--color-brand-600)" />
          <rect x="56" y="10" width="8" height="8" rx="2" fill="var(--color-ink-500)" />
        </>
      )}
    </Art>
  );
}

/** Live quiz: a trophy with a star. */
export function TrophyArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      {(ids) => (
        <>
          <ellipse cx="60" cy="88" rx="34" ry="6" fill={url(ids.shadow)} />
          <path d="M38 22 H22 Q20 44 42 46 M82 22 H98 Q100 44 78 46" stroke="var(--color-brand-600)" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M36 14 H84 V34 Q84 58 60 60 Q36 58 36 34 Z" fill={url(ids.green)} />
          <path d="M44 20 V34 Q44 46 54 52" stroke="white" strokeOpacity="0.35" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="54" y="58" width="12" height="12" fill="var(--color-brand-700)" />
          <rect x="40" y="70" width="40" height="12" rx="3" fill="var(--color-ink-700)" />
          <path d="M60 25 l3.5 7 7.5 1 -5.5 5.3 1.3 7.5 -6.8 -3.6 -6.8 3.6 1.3 -7.5 -5.5 -5.3 7.5 -1 z" fill="white" fillOpacity="0.9" />
          <path d="M100 6 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 z" fill="var(--color-brand-400)" />
          <circle cx="16" cy="12" r="3" fill="var(--color-ink-400)" opacity="0.6" />
        </>
      )}
    </Art>
  );
}

/** Photo to solution: a phone framing an exercise, with a tick. */
export function CameraArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      {(ids) => (
        <>
          <ellipse cx="60" cy="88" rx="32" ry="6" fill={url(ids.shadow)} />
          <rect x="36" y="6" width="48" height="80" rx="9" fill="var(--color-ink-900)" />
          <rect x="40" y="14" width="40" height="64" rx="4" fill={url(ids.light)} />
          <path d="M46 22 h6 M46 22 v6 M74 22 h-6 M74 22 v6 M46 70 h6 M46 70 v-6 M74 70 h-6 M74 70 v-6" stroke="var(--color-brand-500)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M50 38 H70 M50 46 H66 M50 54 H70" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="86" cy="64" r="13" fill={url(ids.green)} />
          <path d="M80 64 l4 4 8 -8" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </Art>
  );
}

/** Mistake notebook: a spiral notebook, one item crossed and one ticked. */
export function NotebookArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      {(ids) => (
        <>
          <ellipse cx="60" cy="88" rx="38" ry="6" fill={url(ids.shadow)} />
          <rect x="30" y="8" width="60" height="76" rx="6" fill={url(ids.light)} stroke={LINE} strokeWidth="2" />
          <rect x="30" y="8" width="12" height="76" rx="5" fill={url(ids.green)} />
          <path d="M36 18 v4 M36 32 v4 M36 46 v4 M36 60 v4 M36 74 v2" stroke="white" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
          <path d="M52 28 l6 6 M58 28 l-6 6" stroke="var(--color-ink-400)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M64 31 H82" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M51 52 l3 3 6 -6" stroke="var(--color-brand-600)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M64 52 H82 M52 70 H80" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </Art>
  );
}

/** Study plan: a calendar page with a few days marked. */
export function CalendarArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      {(ids) => (
        <>
          <ellipse cx="60" cy="88" rx="42" ry="6" fill={url(ids.shadow)} />
          <rect x="22" y="14" width="76" height="70" rx="8" fill={url(ids.light)} stroke={LINE} strokeWidth="2" />
          <path d="M22 22 Q22 14 30 14 H90 Q98 14 98 22 V32 H22 Z" fill={url(ids.green)} />
          <path d="M40 8 V20 M80 8 V20" stroke="var(--color-ink-500)" strokeWidth="4" strokeLinecap="round" />
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3, 4].map((col) => {
              const marked = (row === 1 && col === 1) || (row === 2 && col === 3) || (row === 0 && col === 4);
              return <rect key={`${row}-${col}`} x={30 + col * 13} y={40 + row * 10} width="9" height="6" rx="2" fill={marked ? "var(--color-brand-500)" : LINE} />;
            }),
          )}
        </>
      )}
    </Art>
  );
}

/** Find a video: a screen with a play button. */
export function VideoArt({ className }: ArtProps) {
  return (
    <Art className={className}>
      {(ids) => (
        <>
          <ellipse cx="60" cy="88" rx="44" ry="6" fill={url(ids.shadow)} />
          <rect x="14" y="14" width="92" height="60" rx="8" fill="var(--color-ink-900)" />
          <rect x="19" y="19" width="82" height="50" rx="5" fill="var(--color-ink-700)" />
          <circle cx="60" cy="44" r="15" fill={url(ids.green)} />
          <path d="M55 36 L68 44 L55 52 Z" fill="white" />
          <rect x="24" y="62" width="72" height="3" rx="1.5" fill="var(--color-ink-500)" />
          <rect x="24" y="62" width="30" height="3" rx="1.5" fill="var(--color-brand-400)" />
          <path d="M46 82 H74" stroke="var(--color-ink-500)" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </Art>
  );
}
