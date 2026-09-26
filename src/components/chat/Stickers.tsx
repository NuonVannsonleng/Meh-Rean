import { useId, type ReactNode } from "react";

/**
 * Meh Rean's own sticker pack, drawn in the logo's colours so chats feel like
 * part of the app rather than a generic emoji keyboard. Stickers are sent by
 * id; an id this build does not know renders as a neutral placeholder.
 */

const INK = "#2b2a26";
const COVER = "#5b7c42";
const COVER_DARK = "#3f5a2c";
const LEAF = "#9cc27a";
const PAGE = "#faf3e4";
const RIBBON = "#428a9b";
const SUN = "#f4c84a";
const ORANGE = "#e8964a";
const ROSE = "#e2687a";
const SKY = "#8cc7d2";

const line = { stroke: INK, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Widest a caption may be and still keep its white edge inside the sticker. */
const MAX_LABEL_WIDTH = 100;

function Label({ children, y = 106, size = 15, fill = INK }: { children: string; y?: number; size?: number; fill?: string }) {
  // Heavy display type runs about 0.68em a character; longer captions are squeezed to fit.
  const tooWide = children.length * size * 0.68 > MAX_LABEL_WIDTH;
  return (
    <text
      textLength={tooWide ? MAX_LABEL_WIDTH : undefined}
      lengthAdjust="spacingAndGlyphs"
      x="60"
      y={y}
      textAnchor="middle"
      fontFamily="var(--font-display)"
      fontWeight={900}
      fontSize={size}
      fill={fill}
      stroke="white"
      strokeWidth={5}
      paintOrder="stroke"
      letterSpacing="0.5"
    >
      {children}
    </text>
  );
}

/** Two dots and a smile, shared by the characters. */
function Face({ x, y, mood = "smile" }: { x: number; y: number; mood?: "smile" | "grin" | "sleep" | "worried" }) {
  return (
    <g>
      {mood === "sleep" ? (
        <>
          <path d={`M${x - 11} ${y} q4 3 8 0`} fill="none" {...line} strokeWidth={2.5} />
          <path d={`M${x + 3} ${y} q4 3 8 0`} fill="none" {...line} strokeWidth={2.5} />
        </>
      ) : (
        <>
          <circle cx={x - 7} cy={y} r={2.8} fill={INK} />
          <circle cx={x + 7} cy={y} r={2.8} fill={INK} />
        </>
      )}
      {mood === "grin" && <path d={`M${x - 8} ${y + 6} q8 9 16 0 z`} fill={INK} />}
      {mood === "smile" && <path d={`M${x - 6} ${y + 7} q6 5 12 0`} fill="none" {...line} strokeWidth={2.5} />}
      {mood === "worried" && <path d={`M${x - 5} ${y + 10} q5 -4 10 0`} fill="none" {...line} strokeWidth={2.5} />}
      {mood !== "sleep" && (
        <>
          <circle cx={x - 13} cy={y + 6} r={3} fill={ROSE} opacity={0.45} />
          <circle cx={x + 13} cy={y + 6} r={3} fill={ROSE} opacity={0.45} />
        </>
      )}
    </g>
  );
}

/** The logo's stacked book, reused as a mascot. */
function Book({ x, y, w = 56, color = COVER }: { x: number; y: number; w?: number; color?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={16} rx={7} fill={color} {...line} />
      <path d={`M${x + 8} ${y + 5} h${w - 14} M${x + 8} ${y + 10} h${w - 14}`} stroke={PAGE} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

const ART: Record<string, ReactNode> = {
  hi: (
    <>
      <Book x={24} y={62} w={70} color={COVER_DARK} />
      <Book x={30} y={46} w={62} />
      <rect x={26} y={20} width={66} height={28} rx={9} fill={PAGE} {...line} />
      <path d="M78 20 v22 l5 -4 5 4 v-22" fill={RIBBON} {...line} strokeWidth={2.5} />
      <Face x={52} y={31} mood="grin" />
      <path d="M98 30 q8 -10 4 -20 M104 38 q10 -4 12 -14" fill="none" {...line} stroke={ORANGE} />
      <Label>HI!</Label>
    </>
  ),
  "a-plus": (
    <>
      <rect x={24} y={12} width={64} height={80} rx={6} fill="white" {...line} transform="rotate(-6 56 52)" />
      <path d="M36 30 h32 M36 40 h40 M36 50 h26" stroke="#c9c2b2" strokeWidth={3} strokeLinecap="round" transform="rotate(-6 56 52)" />
      <circle cx={74} cy={62} r={24} fill="none" stroke={ROSE} strokeWidth={5} />
      <text x="74" y="72" textAnchor="middle" fontFamily="var(--font-display)" fontWeight={900} fontSize={26} fill={ROSE}>
        A+
      </text>
      <Label>NAILED IT</Label>
    </>
  ),
  coffee: (
    <>
      <path d="M44 16 q-6 8 0 16 M58 12 q-6 10 0 20 M72 16 q-6 8 0 16" fill="none" stroke="#b8ada0" strokeWidth={3} strokeLinecap="round" />
      <path d="M30 38 h60 l-6 44 a8 8 0 0 1 -8 7 h-32 a8 8 0 0 1 -8 -7 z" fill={ORANGE} {...line} />
      <path d="M90 48 h6 a10 10 0 0 1 0 20 h-8" fill="none" {...line} />
      <rect x={30} y={36} width={60} height={8} rx={4} fill="#7a4a24" {...line} />
      <Face x={60} y={60} />
      <Label>BRB COFFEE</Label>
    </>
  ),
  idea: (
    <>
      <path d="M60 8 v8 M30 20 l6 6 M90 20 l-6 6 M18 48 h8 M94 48 h8" stroke={SUN} strokeWidth={4} strokeLinecap="round" />
      <path d="M60 22 a26 26 0 0 0 -15 47 c3 2 5 6 5 10 h20 c0 -4 2 -8 5 -10 a26 26 0 0 0 -15 -47z" fill={SUN} {...line} />
      <rect x={49} y={80} width={22} height={10} rx={4} fill={RIBBON} {...line} />
      <Face x={60} y={50} mood="grin" />
      <Label>IDEA!</Label>
    </>
  ),
  thanks: (
    <>
      <path d="M60 88 s-34 -20 -40 -42 c-4 -16 6 -30 21 -30 c9 0 15 6 19 12 c4 -6 10 -12 19 -12 c15 0 25 14 21 30 c-6 22 -40 42 -40 42z" fill={ROSE} {...line} />
      <Face x={60} y={46} />
      <path d="M82 22 l4 -8 M90 30 l8 -4" stroke={SUN} strokeWidth={3.5} strokeLinecap="round" />
      <Label>THANK YOU</Label>
    </>
  ),
  "good-luck": (
    <>
      {[0, 90, 180, 270].map((angle) => (
        <path
          key={angle}
          d="M60 50 c-4 -14 -22 -16 -22 -2 c0 8 10 12 22 2z"
          fill={angle % 180 ? COVER : LEAF}
          {...line}
          transform={`rotate(${angle} 60 50)`}
        />
      ))}
      <path d="M62 62 q6 16 -2 28" fill="none" {...line} stroke={COVER_DARK} strokeWidth={4} />
      <Label>GOOD LUCK!</Label>
    </>
  ),
  "exam-mode": (
    <>
      <circle cx={60} cy={48} r={34} fill={SUN} {...line} />
      <circle cx={48} cy={44} r={10} fill="white" {...line} />
      <circle cx={72} cy={44} r={10} fill="white" {...line} />
      <path d="M58 44 h4" {...line} />
      <circle cx={48} cy={45} r={3} fill={INK} />
      <circle cx={72} cy={45} r={3} fill={INK} />
      <path d="M50 64 h20" {...line} />
      <path d="M90 24 q4 8 0 12 q-4 -4 0 -12z" fill={SKY} {...line} strokeWidth={2} />
      <Label>EXAM MODE</Label>
    </>
  ),
  sleepy: (
    <>
      <path d="M32 34 l6 -16 10 12 M88 34 l-6 -16 -10 12" fill={ORANGE} {...line} />
      <ellipse cx={60} cy={56} rx={30} ry={32} fill={ORANGE} {...line} />
      <ellipse cx={60} cy={64} rx={18} ry={18} fill={PAGE} {...line} strokeWidth={2} />
      <circle cx={48} cy={44} r={9} fill={PAGE} {...line} strokeWidth={2} />
      <circle cx={72} cy={44} r={9} fill={PAGE} {...line} strokeWidth={2} />
      <path d="M43 45 q5 3 10 0 M67 45 q5 3 10 0" fill="none" {...line} strokeWidth={2.5} />
      <path d="M57 52 l3 5 3 -5z" fill={SUN} {...line} strokeWidth={2} />
      <text x="96" y="30" fontFamily="var(--font-display)" fontWeight={900} fontSize={16} fill={RIBBON}>
        z
      </text>
      <text x="104" y="18" fontFamily="var(--font-display)" fontWeight={900} fontSize={12} fill={RIBBON}>
        z
      </text>
      <Label>ZZZ…</Label>
    </>
  ),
  passed: (
    <>
      <path d="M22 88 l22 -52 30 30z" fill={SUN} {...line} />
      <path d="M32 64 l14 14 M38 50 l22 22" stroke={ORANGE} strokeWidth={4} />
      {[
        [70, 18, ROSE],
        [92, 30, RIBBON],
        [84, 50, COVER],
        [100, 62, ORANGE],
        [60, 30, SUN],
      ].map(([x, y, fill], index) => (
        <rect key={index} x={x as number} y={y as number} width={8} height={8} rx={2} fill={fill as string} transform={`rotate(${index * 30} ${x} ${y})`} />
      ))}
      <path d="M76 38 q10 -4 12 -14 M86 70 q10 2 18 -6" fill="none" stroke={RIBBON} strokeWidth={3} strokeLinecap="round" />
      <Label>I PASSED!</Label>
    </>
  ),
  help: (
    <>
      <circle cx={60} cy={50} r={36} fill="white" {...line} />
      <circle cx={60} cy={50} r={17} fill={PAGE} {...line} />
      {[0, 90, 180, 270].map((angle) => (
        <path key={angle} d="M60 14 a36 36 0 0 1 25 10 l-12 13 a17 17 0 0 0 -13 -4z" fill={ROSE} {...line} strokeWidth={2.5} transform={`rotate(${angle} 60 50)`} />
      ))}
      <Label>SOS, HELP!</Label>
    </>
  ),
  deadline: (
    <>
      <path d="M30 22 l10 -8 M90 22 l-10 -8" {...line} strokeWidth={5} />
      <circle cx={60} cy={52} r={32} fill={ROSE} {...line} />
      <circle cx={60} cy={52} r={24} fill="white" {...line} strokeWidth={2} />
      <path d="M60 36 v16 l10 6" fill="none" {...line} />
      <path d="M38 84 l-6 6 M82 84 l6 6" {...line} />
      <path d="M96 38 l8 -2 M98 50 h9 M96 62 l8 3" stroke={ORANGE} strokeWidth={3} strokeLinecap="round" />
      <Label>DEADLINE!!</Label>
    </>
  ),
  "on-it": (
    <>
      <rect x={20} y={46} width={64} height={46} rx={6} fill="white" {...line} />
      <path d="M30 60 h36 M30 70 h28 M30 80 h20" stroke={RIBBON} strokeWidth={3} strokeLinecap="round" />
      <g transform="rotate(40 80 44)">
        <rect x={72} y={6} width={16} height={60} rx={3} fill={SUN} {...line} />
        <path d="M72 66 l8 14 8 -14z" fill={PAGE} {...line} />
        <rect x={72} y={2} width={16} height={10} rx={3} fill={ROSE} {...line} />
      </g>
      <Label>ON IT!</Label>
    </>
  ),
  gg: (
    <>
      <path d="M36 16 h48 v20 a24 24 0 0 1 -48 0z" fill={SUN} {...line} />
      <path d="M36 22 h-10 a10 10 0 0 0 12 16 M84 22 h10 a10 10 0 0 1 -12 16" fill="none" {...line} />
      <path d="M54 58 h12 v10 h-12z" fill={SUN} {...line} />
      <rect x={42} y={68} width={36} height={12} rx={3} fill={COVER} {...line} />
      <path d="M60 24 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1z" fill="white" />
      <Label y={104}>GG!</Label>
    </>
  ),
  lol: (
    <>
      <circle cx={60} cy={50} r={36} fill={SUN} {...line} />
      <path d="M40 40 l10 4 -10 4 M80 40 l-10 4 10 4" fill="none" {...line} />
      <path d="M40 58 h40 a20 20 0 0 1 -40 0z" fill={INK} />
      <path d="M48 70 a12 8 0 0 0 24 0" fill={ROSE} />
      <path d="M24 44 q-6 10 2 16 M96 44 q6 10 -2 16" fill={SKY} {...line} strokeWidth={2} />
      <Label>LOL</Label>
    </>
  ),
  "thumbs-up": (
    <>
      <path d="M30 50 h14 v38 h-14z" fill={COVER_DARK} {...line} />
      <path d="M44 88 v-38 l14 -26 c4 -8 16 -4 14 6 l-3 14 h18 c7 0 12 6 10 13 l-6 22 c-1 5 -5 9 -11 9z" fill={LEAF} {...line} />
      <path d="M90 16 l4 -8 M100 26 l8 -4" stroke={SUN} strokeWidth={3.5} strokeLinecap="round" />
      <Label>YOU GOT THIS</Label>
    </>
  ),
  "big-brain": (
    <>
      <path d="M60 20 c-10 -10 -30 -4 -30 10 c-12 4 -12 22 -2 26 c-4 14 10 24 22 18 c4 6 16 6 20 0 c12 6 26 -4 22 -18 c10 -4 10 -22 -2 -26 c0 -14 -20 -20 -30 -10z" fill="#f2a6b4" {...line} />
      <path d="M60 20 v54 M44 34 q8 6 0 14 M76 34 q-8 6 0 14" fill="none" {...line} strokeWidth={2.5} />
      <path d="M22 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z M100 58 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill={SUN} />
      <Label>BIG BRAIN</Label>
    </>
  ),
};

export const STICKERS: { id: string; label: string }[] = [
  { id: "hi", label: "Hi!" },
  { id: "thanks", label: "Thank you" },
  { id: "thumbs-up", label: "You got this" },
  { id: "lol", label: "LOL" },
  { id: "idea", label: "Idea!" },
  { id: "big-brain", label: "Big brain" },
  { id: "a-plus", label: "Nailed it (A+)" },
  { id: "passed", label: "I passed!" },
  { id: "good-luck", label: "Good luck!" },
  { id: "exam-mode", label: "Exam mode" },
  { id: "on-it", label: "On it!" },
  { id: "coffee", label: "BRB coffee" },
  { id: "deadline", label: "Deadline!!" },
  { id: "help", label: "SOS, help!" },
  { id: "sleepy", label: "Zzz…" },
  { id: "gg", label: "GG!" },
];

export function stickerLabel(id: string): string {
  return STICKERS.find((sticker) => sticker.id === id)?.label ?? "Sticker";
}

export function Sticker({ id, className = "h-28 w-28" }: { id: string; className?: string }) {
  const filterId = useId().replace(/:/g, "");
  const art = ART[id];
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={stickerLabel(id)}>
      <defs>
        {/* The white die-cut edge and soft shadow every sticker shares. */}
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="3.5" result="grown" />
          <feFlood floodColor="white" />
          <feComposite in2="grown" operator="in" result="edge" />
          <feDropShadow in="edge" dx="0" dy="2" stdDeviation="2" floodColor="black" floodOpacity="0.18" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        {art ?? (
          <>
            <rect x={20} y={20} width={80} height={80} rx={18} fill={PAGE} {...line} />
            <Label y={68} size={14}>
              STICKER
            </Label>
          </>
        )}
      </g>
    </svg>
  );
}
