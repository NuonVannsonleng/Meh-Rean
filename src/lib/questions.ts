import type {
  ContentLanguage,
  Question,
  QuestionChoice,
  QuestionImage,
  QuestionOrigin,
  QuestionSolution,
  QuestionType,
  SolutionOrigin,
  SolutionStep,
  Verification,
} from "../types";

/**
 * Rows of public.questions and public.question_solutions (supabase/schema.sql)
 * and their mapping to the app's Question type. Kept apart from supabaseApi
 * so the browser-only store and the test scripts use the same shape.
 *
 * Plain TypeScript with type-only imports, so Node can run it directly.
 */

export interface QuestionRow {
  id: string;
  subject_id: string;
  chapter_id: string;
  topic_id: string | null;
  year: number | null;
  type: QuestionType;
  content: string;
  choices: QuestionChoice[];
  images: QuestionImage[];
  difficulty: number | null;
  language: ContentLanguage;
  origin: QuestionOrigin;
  source: string;
  verification: Verification;
  verified_by: string | null;
  verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionSolutionRow {
  question_id: string;
  answer: string;
  correct_choice: string | null;
  /** Postgres numeric arrives as a number or, for very large values, a string. */
  numeric_answer: number | string | null;
  numeric_tolerance: number | string | null;
  steps: SolutionStep[];
  origin: SolutionOrigin;
  source: string;
  verification: Verification;
  verified_by: string | null;
  verified_at: string | null;
  updated_at: string;
}

/** The columns to select for a question with its solution, in one request. */
export const QUESTION_SELECT = "*, solution:question_solutions(*)";

const toNumber = (value: number | string | null): number | null => (value === null ? null : Number(value));

export function toQuestionSolution(row: QuestionSolutionRow): QuestionSolution {
  return {
    questionId: row.question_id,
    answer: row.answer,
    correctChoice: row.correct_choice,
    numericAnswer: toNumber(row.numeric_answer),
    numericTolerance: toNumber(row.numeric_tolerance),
    steps: row.steps ?? [],
    origin: row.origin,
    source: row.source,
    verification: row.verification,
    verifiedAt: row.verified_at,
    updatedAt: row.updated_at,
  };
}

export function toQuestion(row: QuestionRow & { solution?: QuestionSolutionRow | QuestionSolutionRow[] | null }): Question {
  // An embedded one-to-one row can come back as an object or a one-item array.
  const solution = Array.isArray(row.solution) ? row.solution[0] : row.solution;
  return {
    id: row.id,
    subjectId: row.subject_id,
    chapterId: row.chapter_id,
    topicId: row.topic_id,
    year: row.year,
    type: row.type,
    content: row.content,
    choices: row.choices ?? [],
    images: row.images ?? [],
    difficulty: row.difficulty,
    language: row.language,
    origin: row.origin,
    source: row.source,
    verification: row.verification,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    solution: solution ? toQuestionSolution(solution) : null,
  };
}

/**
 * Whether an answer is right, for the types that can be marked automatically;
 * null for those that need a person. Mock exams (roadmap 2.4) score on the
 * server with the same rule.
 */
export function isCorrect(question: Pick<Question, "type">, solution: QuestionSolution, given: string): boolean | null {
  if (question.type === "multiple-choice") return given === solution.correctChoice;
  if (question.type === "numeric") {
    if (solution.numericAnswer === null) return null;
    const value = Number(given.trim().replace(",", "."));
    if (!Number.isFinite(value) || given.trim() === "") return false;
    return Math.abs(value - solution.numericAnswer) <= (solution.numericTolerance ?? 0);
  }
  return null;
}
