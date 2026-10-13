import type {
  ContentLanguage,
  CurriculumChapter,
  Question,
  QuestionInput,
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
  /** Stored by path only; the address is built when reading (see toQuestion). */
  images: Pick<QuestionImage, "path" | "alt">[];
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

export function toQuestion(
  row: QuestionRow & { solution?: QuestionSolutionRow | QuestionSolutionRow[] | null },
  /** Turns a stored image path into its address (the storage bucket's public URL). */
  imageUrl: (path: string) => string = (path) => path,
): Question {
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
    images: (row.images ?? []).map((image) => ({ path: image.path, alt: image.alt, url: imageUrl(image.path) })),
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

// ---- Checking a question before it is saved ----

/** Why a field is not acceptable; the form turns these into messages. */
export type QuestionProblem =
  | "required"
  | "too-long"
  | "unknown-chapter"
  | "topic-not-in-chapter"
  | "choices-count"
  | "choice-empty"
  | "choice-id"
  | "correct-choice"
  | "numeric-required"
  | "needs-source"
  | "demo-not-verified"
  | "past-paper-year"
  | "past-paper-source"
  | "image-url"
  | "image-alt"
  | "too-many-images"
  | "year-range"
  | "difficulty-range"
  | "step-empty"
  | "too-many-steps";

export type QuestionField =
  | "chapter"
  | "topic"
  | "content"
  | "choices"
  | "correctChoice"
  | "numericAnswer"
  | "answer"
  | "steps"
  | "images"
  | "year"
  | "difficulty"
  | "source"
  | "verification"
  | "solutionSource"
  | "solutionVerification";

export type QuestionProblems = Partial<Record<QuestionField, QuestionProblem>>;

const CHOICE_ID = /^[a-z0-9]{1,8}$/;
const MAX_IMAGES = 6;
const MAX_STEPS = 40;

/**
 * Where question images may live: an upload in the storage bucket's questions
 * folder (checked again by the database), or a file kept in this browser in
 * the demo.
 */
const IMAGE_PATH = /^([0-9a-f-]{36}\/questions\/[0-9a-f-]{36}\.(png|jpg|webp|gif)|qi-[\w-]+)$/;

/**
 * The same rules supabase/schema.sql enforces (guard_question,
 * guard_question_solution and the table checks), for friendly messages in
 * the form and for the browser-only store, which has no database.
 */
export function checkQuestionInput(input: QuestionInput, chapters: CurriculumChapter[]): QuestionProblems {
  const problems: QuestionProblems = {};
  const chapter = chapters.find((item) => item.id === input.chapterId);
  if (!input.chapterId) problems.chapter = "required";
  else if (!chapter) problems.chapter = "unknown-chapter";
  if (input.topicId && chapter && !chapter.topics.some((topic) => topic.id === input.topicId)) problems.topic = "topic-not-in-chapter";

  const content = input.content.trim();
  if (!content) problems.content = "required";
  else if (content.length > 20000) problems.content = "too-long";

  if (input.type === "multiple-choice") {
    const ids = new Set<string>();
    if (input.choices.length < 2 || input.choices.length > 8) problems.choices = "choices-count";
    for (const choice of input.choices) {
      if (!CHOICE_ID.test(choice.id) || ids.has(choice.id)) problems.choices = "choice-id";
      else if (!choice.content.trim()) problems.choices = "choice-empty";
      else if (choice.content.trim().length > 2000) problems.choices = "too-long";
      ids.add(choice.id);
    }
    if (!input.solution.correctChoice || !ids.has(input.solution.correctChoice)) problems.correctChoice = "correct-choice";
  }
  if (input.type === "numeric" && (input.solution.numericAnswer === null || !Number.isFinite(input.solution.numericAnswer))) {
    problems.numericAnswer = "numeric-required";
  }

  const answer = input.solution.answer.trim();
  if (!answer) problems.answer = "required";
  else if (answer.length > 5000) problems.answer = "too-long";

  if (input.solution.steps.length > MAX_STEPS) problems.steps = "too-many-steps";
  else if (input.solution.steps.some((step) => !step.content.trim())) problems.steps = "step-empty";
  else if (input.solution.steps.some((step) => step.content.trim().length > 5000)) problems.steps = "too-long";

  if (input.images.length > MAX_IMAGES) problems.images = "too-many-images";
  else if (input.images.some((image) => !IMAGE_PATH.test(image.path))) problems.images = "image-url";
  else if (input.images.some((image) => !image.alt.trim() || image.alt.length > 300)) problems.images = "image-alt";

  if (input.year !== null && (!Number.isInteger(input.year) || input.year < 1990 || input.year > 2100)) problems.year = "year-range";
  if (input.difficulty !== null && (!Number.isInteger(input.difficulty) || input.difficulty < 1 || input.difficulty > 5)) {
    problems.difficulty = "difficulty-range";
  }

  if (input.source.length > 500) problems.source = "too-long";
  else if (input.verification === "verified" && !input.source.trim()) problems.source = "needs-source";
  if (input.origin === "demo" && input.verification === "verified") problems.verification = "demo-not-verified";
  if (input.origin === "official-past-paper") {
    if (input.year === null) problems.year = "past-paper-year";
    if (!input.source.trim()) problems.source = "past-paper-source";
  }

  if (input.solution.source.length > 500) problems.solutionSource = "too-long";
  else if (input.solution.verification === "verified" && !input.solution.source.trim()) problems.solutionSource = "needs-source";
  if (input.solution.origin === "demo" && input.solution.verification === "verified") problems.solutionVerification = "demo-not-verified";

  return problems;
}

/** The input as the save_question database function takes it (snake_case). */
export function toSaveQuestionArgs(input: QuestionInput) {
  return {
    question: {
      chapter_id: input.chapterId,
      topic_id: input.topicId,
      year: input.year,
      type: input.type,
      content: input.content.trim(),
      choices: input.type === "multiple-choice" ? input.choices.map((choice) => ({ id: choice.id, content: choice.content.trim() })) : [],
      images: input.images.map((image) => ({ path: image.path, alt: image.alt.trim() })),
      difficulty: input.difficulty,
      language: input.language,
      origin: input.origin,
      source: input.source.trim(),
      verification: input.verification,
    },
    solution: {
      answer: input.solution.answer.trim(),
      correct_choice: input.type === "multiple-choice" ? input.solution.correctChoice : null,
      numeric_answer: input.type === "numeric" ? input.solution.numericAnswer : null,
      numeric_tolerance: input.type === "numeric" ? input.solution.numericTolerance : null,
      steps: input.solution.steps.map((step) => ({ content: step.content.trim() })),
      origin: input.solution.origin,
      source: input.solution.source.trim(),
      verification: input.solution.verification,
    },
  };
}

/** Question images: small raster files only (an SVG can carry script). */
export const QUESTION_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_QUESTION_IMAGE_BYTES = 5 * 1024 * 1024;

/** File extension for a question image of an allowed type. */
export function questionImageExtension(type: string): string | null {
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[type] ?? null;
}
