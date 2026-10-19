import { useEffect, useMemo, useState, type ElementType } from "react";
import { hasKhmer, splitMath, type MathSegment } from "../lib/mathText";

type Katex = typeof import("katex").default;

let pending: Promise<Katex> | null = null;

/** KaTeX and its stylesheet, downloaded only when a page shows maths. */
function loadKatex(): Promise<Katex> {
  pending ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")])
    .then(([module]) => module.default)
    .catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}

/**
 * KaTeX settings for text written by others: no \href, \url, \includegraphics
 * or HTML commands (trust: false), mistakes shown in place instead of thrown,
 * and limits so a hostile macro cannot hang the page.
 */
const OPTIONS = {
  throwOnError: false,
  trust: false,
  strict: "ignore",
  maxExpand: 500,
  maxSize: 20,
  output: "htmlAndMathml",
  // The theme's error colour, readable in light and dark (KaTeX's default red is not).
  errorColor: "var(--color-danger-fg)",
} as const;

function MathPiece({ katex, segment }: { katex: Katex | null; segment: Extract<MathSegment, { kind: "math" }> }) {
  // Only KaTeX's own output is set as HTML; the stored text never is.
  const html = useMemo(
    () => (katex ? katex.renderToString(segment.value, { ...OPTIONS, displayMode: segment.display }) : null),
    [katex, segment],
  );

  if (!html) {
    // Until KaTeX arrives (or if it cannot load), show the formula as written.
    const raw = <code className="font-mono text-[0.92em]">{segment.value}</code>;
    return segment.display ? <span className="my-2 block">{raw}</span> : raw;
  }
  return segment.display ? (
    // Wide formulas scroll inside their own box, never the page.
    <span className="math-display block overflow-x-auto overflow-y-hidden" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    // A long inline formula (a whole integral or limit) can be wider than a
    // phone; it scrolls in its own box instead of pushing the page sideways.
    <span className={segment.value.length > 40 ? "math-inline math-wide" : "math-inline"} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/**
 * Khmer or English text with inline LaTeX ($…$, $$…$$, \(…\), \[…\]), as
 * stored in questions and solutions. Line breaks in the text are kept.
 */
export default function MathText({
  text,
  as: Tag = "div",
  className = "",
}: {
  text: string;
  as?: ElementType;
  className?: string;
}) {
  const segments = useMemo(() => splitMath(text), [text]);
  const needsMath = segments.some((segment) => segment.kind === "math");
  const khmer = hasKhmer(text);
  const [katex, setKatex] = useState<Katex | null>(null);

  useEffect(() => {
    if (!needsMath || katex) return;
    let active = true;
    loadKatex()
      .then((loaded) => active && setKatex(() => loaded))
      .catch(() => {
        // Offline: the formulas stay readable as written.
      });
    return () => {
      active = false;
    };
  }, [needsMath, katex]);

  return (
    <Tag
      lang={khmer ? "km" : undefined}
      className={`math-text whitespace-pre-line [overflow-wrap:anywhere] ${khmer ? "leading-[1.9]" : "leading-relaxed"} ${className}`}
    >
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <MathPiece key={index} katex={katex} segment={segment} />
        ),
      )}
    </Tag>
  );
}
