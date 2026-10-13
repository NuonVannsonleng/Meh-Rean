// Video quizzes (roadmap 4.6): the same checks as valid_video_quiz() in
// supabase/schema.sql, for the admin form and the browser-only store.

import type { VideoQuizInput, VideoQuizQuestion } from "../types";

export const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character id from a YouTube link or a bare id; null when there is none. */
export function videoIdFrom(text: string): string | null {
  const value = text.trim();
  if (VIDEO_ID_PATTERN.test(value)) return value;
  const match = value.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
  return match ? match[1] : null;
}

export function questionProblems(question: VideoQuizQuestion): string[] {
  const problems: string[] = [];
  if (!question.prompt.trim() || question.prompt.length > 600) problems.push("prompt");
  if (question.choices.length < 2 || question.choices.length > 5 || question.choices.some((choice) => !choice.trim() || choice.length > 300)) problems.push("choices");
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.choices.length) problems.push("answer");
  if (question.explanation.length > 800) problems.push("explanation");
  return problems;
}

export function isValidVideoQuiz(quiz: VideoQuizInput): boolean {
  return (
    VIDEO_ID_PATTERN.test(quiz.videoId) &&
    quiz.title.trim().length > 0 &&
    quiz.title.length <= 200 &&
    quiz.source.trim().length >= 3 &&
    quiz.source.length <= 300 &&
    quiz.questions.length >= 1 &&
    quiz.questions.length <= 10 &&
    quiz.questions.every((question) => questionProblems(question).length === 0)
  );
}
