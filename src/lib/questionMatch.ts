// Finds questions in Meh Rean's bank that look like an exercise a student
// photographed or typed (roadmap 4.5), so a checked solution is offered
// before any AI one. Character trigrams work for Khmer, English and maths
// alike; LaTeX is reduced to its symbols so "$\frac{1}{2}$" and "1/2" agree.

import type { Question } from "../types";

/** Lower-case, LaTeX commands and markup removed, spaces collapsed. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/\\(?:left|right|displaystyle|mathrm|text|operatorname|,|;|!|quad)\b/g, " ")
    .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\([a-z]+)/g, "$1")
    .replace(/[$\\{}[\]()]/g, " ")
    .replace(/[​‌‍]/g, "")
    .replace(/[.,;:!?"'“”‘’។៕]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(text: string): Set<string> {
  const padded = ` ${text} `;
  const grams = new Set<string>();
  for (let index = 0; index + 3 <= padded.length; index += 1) grams.add(padded.slice(index, index + 3));
  return grams;
}

/** 0–1: how alike two texts are (Dice coefficient on character trigrams). */
export function similarity(a: string, b: string): number {
  const left = trigrams(normalizeForMatch(a));
  const right = trigrams(normalizeForMatch(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

export interface QuestionMatch {
  question: Question;
  score: number;
}

/** A match this close is worth showing as "this looks like your exercise". */
export const MATCH_THRESHOLD = 0.5;

/** The closest questions, best first; same-chapter questions get a small lift. */
export function matchQuestions(text: string, questions: Question[], chapterId: string | null = null, limit = 3): QuestionMatch[] {
  if (normalizeForMatch(text).length < 8) return [];
  return questions
    .map((question) => {
      const choices = question.choices.map((choice) => choice.content).join(" ");
      const score = Math.max(similarity(text, question.content), choices ? similarity(text, `${question.content} ${choices}`) : 0);
      return { question, score: Math.min(1, score + (chapterId && question.chapterId === chapterId ? 0.05 : 0)) };
    })
    .filter((match) => match.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
