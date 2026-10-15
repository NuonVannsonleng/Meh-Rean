// Live quizzes: the same checks as valid_live_questions() in
// supabase/schema.sql, for the editor and the browser-only store.

import type { LiveQuestion } from "../types";

export const LIVE_SECONDS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;
export const LIVE_MAX_QUESTIONS = 50;
export const LIVE_CODE_PATTERN = /^\d{6}$/;

export const blankLiveQuestion = (): LiveQuestion => ({ prompt: "", choices: ["", "", "", ""], answer: 0, seconds: 20 });

/** What is wrong with one question: "prompt", "choices", "answer", "seconds". */
export function liveQuestionProblems(question: LiveQuestion): string[] {
  const problems: string[] = [];
  if (!question.prompt.trim() || question.prompt.length > 500) problems.push("prompt");
  if (question.choices.length < 2 || question.choices.length > 4 || question.choices.some((choice) => !choice.trim() || choice.length > 200)) problems.push("choices");
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.choices.length) problems.push("answer");
  if (!Number.isInteger(question.seconds) || question.seconds < 5 || question.seconds > 120) problems.push("seconds");
  return problems;
}

export function isValidLiveQuiz(title: string, questions: LiveQuestion[]): boolean {
  const name = title.trim();
  return name.length >= 1 && name.length <= 120 && questions.length >= 1 && questions.length <= LIVE_MAX_QUESTIONS && questions.every((q) => liveQuestionProblems(q).length === 0);
}

/** Milliseconds left on the server's clock, never below zero. */
export function remainingMs(deadlineAt: string | null, clockOffsetMs: number, now = Date.now()): number {
  if (!deadlineAt) return 0;
  return Math.max(0, Date.parse(deadlineAt) - (now + clockOffsetMs));
}

/** Players ranked by score, ties by who has more right answers, then name. */
export function rankPlayers<T extends { score: number; correctCount: number; nickname: string }>(players: T[]): T[] {
  return [...players].sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.nickname.localeCompare(b.nickname));
}
