/**
 * Splits text with inline LaTeX into text and maths pieces:
 *   $…$ and \(…\)   inline maths
 *   $$…$$ and \[…\] maths on its own line
 *   \$              a literal dollar sign
 * An opening delimiter without its closing one stays plain text, so a stray
 * "$" never swallows the rest of a question.
 *
 * Plain TypeScript with no imports, so Node can test it directly.
 */

export type MathSegment = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean };

/** Longer than this is almost certainly a mistake, not a formula. */
const MAX_MATH = 4000;

const OPENERS: { open: string; close: string; display: boolean }[] = [
  { open: "$$", close: "$$", display: true },
  { open: "\\[", close: "\\]", display: true },
  { open: "\\(", close: "\\)", display: false },
  { open: "$", close: "$", display: false },
];

/** Index of `close` at or after `from`, skipping escaped dollars; -1 if none. */
function findClose(text: string, close: string, from: number): number {
  let index = text.indexOf(close, from);
  while (index !== -1 && close.startsWith("$") && text[index - 1] === "\\") {
    index = text.indexOf(close, index + 1);
  }
  return index;
}

export function splitMath(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let buffer = "";
  let i = 0;

  const pushText = () => {
    if (buffer) segments.push({ kind: "text", value: buffer });
    buffer = "";
  };

  while (i < text.length) {
    // An escaped dollar is just a dollar.
    if (text.startsWith("\\$", i)) {
      buffer += "$";
      i += 2;
      continue;
    }
    const opener = OPENERS.find(({ open }) => text.startsWith(open, i));
    if (opener) {
      const start = i + opener.open.length;
      const end = findClose(text, opener.close, start);
      const value = end === -1 ? "" : text.slice(start, end);
      if (end !== -1 && value.trim() && value.length <= MAX_MATH) {
        // Display maths is its own line already: drop one line break on each side.
        if (opener.display) buffer = buffer.replace(/\r?\n$/, "");
        pushText();
        segments.push({ kind: "math", value: value.trim(), display: opener.display });
        i = end + opener.close.length;
        if (opener.display && text.startsWith("\r\n", i)) i += 2;
        else if (opener.display && text.startsWith("\n", i)) i += 1;
        continue;
      }
    }
    buffer += text[i];
    i += 1;
  }
  pushText();
  return segments;
}

/** True when the text contains Khmer letters (for lang="km" and line height). */
export function hasKhmer(text: string): boolean {
  return /[ក-៿᧠-᧿]/.test(text);
}
