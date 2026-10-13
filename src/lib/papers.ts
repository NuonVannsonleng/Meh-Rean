import type { ContentLanguage, ExamPaper, ExamPaperDetail, Question, QuestionChoice, QuestionType } from "../types";

/**
 * Demo practice papers (src/data/demo/*.json) as app objects. The
 * browser-only store reads them directly and scripts/build-demo-seed.mjs
 * writes the same rows to SQL, so both backends show the same papers.
 *
 * Plain TypeScript with type-only imports, so Node can run it directly.
 */

interface SeedQuestion {
  id: string;
  points?: number;
  chapterId: string;
  topicId?: string;
  type: QuestionType;
  difficulty?: number;
  language?: ContentLanguage;
  content: string;
  choices?: QuestionChoice[];
  solution: {
    answer: string;
    correctChoice?: string;
    numericAnswer?: number;
    numericTolerance?: number;
    steps: string[];
  };
}

export interface DemoPaperSeed {
  source: string;
  papers: {
    id: string;
    subjectId: string;
    year: number;
    titleEn: string;
    titleKm: string;
    questions: SeedQuestion[];
  }[];
}

/** A fixed date, so the same content always produces the same rows. */
const SEEDED_AT = "2026-10-13T00:00:00.000Z";

/**
 * Builds papers and their questions, checking them against the curriculum:
 * every chapter must belong to the paper's subject and every topic to its
 * chapter. Throws with every problem found.
 */
export function buildDemoPapers(seed: DemoPaperSeed, chapters: { id: string; subjectId: string; topics: { id: string }[] }[]): ExamPaperDetail[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const claim = (id: string) => {
    if (!/^[0-9a-f-]{36}$/.test(id)) problems.push(`bad id ${id}`);
    if (ids.has(id)) problems.push(`duplicate id ${id}`);
    ids.add(id);
  };

  const papers = seed.papers.map((paper): ExamPaperDetail => {
    claim(paper.id);
    const questions = paper.questions.map((item, index) => {
      claim(item.id);
      const chapter = chapters.find((c) => c.id === item.chapterId);
      if (!chapter || chapter.subjectId !== paper.subjectId) problems.push(`${item.id}: chapter ${item.chapterId} is not in ${paper.subjectId}`);
      if (item.topicId && !chapter?.topics.some((t) => t.id === item.topicId)) problems.push(`${item.id}: topic ${item.topicId} is not in its chapter`);
      if (item.type === "multiple-choice" && !item.choices?.some((c) => c.id === item.solution.correctChoice)) {
        problems.push(`${item.id}: the correct choice is not one of the choices`);
      }
      if (item.type === "numeric" && typeof item.solution.numericAnswer !== "number") problems.push(`${item.id}: no numeric answer`);

      const question: Question = {
        id: item.id,
        subjectId: paper.subjectId,
        chapterId: item.chapterId,
        topicId: item.topicId ?? null,
        year: paper.year,
        type: item.type,
        content: item.content,
        choices: item.type === "multiple-choice" ? (item.choices ?? []) : [],
        images: [],
        difficulty: item.difficulty ?? null,
        language: item.language ?? "km",
        origin: "demo",
        source: seed.source,
        verification: "provisional",
        verifiedAt: null,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
        solution: {
          questionId: item.id,
          answer: item.solution.answer,
          correctChoice: item.type === "multiple-choice" ? (item.solution.correctChoice ?? null) : null,
          numericAnswer: item.type === "numeric" ? (item.solution.numericAnswer ?? null) : null,
          numericTolerance: item.type === "numeric" ? (item.solution.numericTolerance ?? 0) : null,
          steps: item.solution.steps.map((content) => ({ content })),
          origin: "demo",
          source: seed.source,
          verification: "provisional",
          verifiedAt: null,
          updatedAt: SEEDED_AT,
        },
      };
      return { position: index + 1, points: item.points ?? null, question };
    });

    const points = questions.map((item) => item.points);
    return {
      id: paper.id,
      subjectId: paper.subjectId,
      year: paper.year,
      titleEn: paper.titleEn,
      titleKm: paper.titleKm,
      durationMinutes: null,
      durationSource: "",
      origin: "demo",
      source: seed.source,
      verification: "provisional",
      questionCount: questions.length,
      totalPoints: points.every((value) => value !== null) ? points.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null,
      questions,
    };
  });

  if (problems.length) throw new Error(`Demo papers are invalid:\n- ${problems.join("\n- ")}`);
  return papers;
}

/** Newest first, then by title. */
export function sortPapers<T extends ExamPaper>(papers: T[]): T[] {
  return [...papers].sort((a, b) => b.year - a.year || a.titleEn.localeCompare(b.titleEn));
}
