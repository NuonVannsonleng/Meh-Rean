import { BUNDLED_IMAGE, bundledImageUrl } from "./questions.ts";
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

interface PastPaperSeedQuestion {
  /** Missing when the copy does not print them. */
  points?: number;
  chapter: string;
  content: string;
  /** Figures cropped from the copy, in public/past-papers/, with a description. */
  images?: { file: string; alt: string }[];
  /** An AI-written answer key: always shown as AI-generated and unchecked. */
  ai?: { answer: string; steps: string[] };
}

/** Who wrote the AI answer keys, shown with every one. */
export const AI_ANSWER_SOURCE = "Answer key written by AI (Claude) for Meh Rean from the typed question; not checked by a teacher.";

/** Real BacII papers (src/data/past-papers/*.json), typed from the copies named in `copies`. */
export interface PastPaperSeed {
  subjectId: string;
  /** First block of every id: "bacc" + track digit + two-digit subject + "0". */
  idPrefix: string;
  nameEn: string;
  nameKm: string;
  trackEn: string;
  trackKm: string;
  /** The language the questions are written in; Khmer unless said. */
  language?: ContentLanguage;
  copies: Record<string, { label: string; url: string }>;
  papers: {
    year: number;
    /** 2014 had two sittings. */
    session?: 1 | 2;
    /** The sitting's date as printed on a copy (YYYY-MM-DD). */
    date?: string;
    minutes: number;
    points: number;
    copies: string[];
    /** Where the copies disagree, which reading is used and why. */
    note?: string;
    questions: PastPaperSeedQuestion[];
  }[];
}

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";
const khmerNumber = (value: number) => String(value).replace(/\d/g, (digit) => KHMER_DIGITS[Number(digit)]);
const ORDINAL_EN = ["", "first", "second"];

/**
 * Real past papers as app objects, for both backends (the browser-only store
 * and scripts/build-past-papers-seed.mjs). Every question is an open,
 * official past-paper question with no answer key, and everything stays
 * 'needs-review' until checked against the Ministry's original. Throws with
 * every problem found.
 */
export function buildPastPapers(seed: PastPaperSeed, chapters: { id: string; subjectId: string }[]): ExamPaperDetail[] {
  const problems: string[] = [];
  if (!/^bacc[0-9]{3}0$/.test(seed.idPrefix)) problems.push(`bad id prefix ${seed.idPrefix}`);
  const seen = new Set<string>();

  const papers = seed.papers.map((paper): ExamPaperDetail => {
    const label = `${seed.subjectId} ${paper.year}${paper.session ? `/${paper.session}` : ""}`;
    const id = `${seed.idPrefix}-${paper.year}-4${paper.session ?? 0}00-8000-000000000000`;
    if (seen.has(id)) problems.push(`${label}: duplicate paper`);
    seen.add(id);
    if (!(paper.minutes >= 5 && paper.minutes <= 600)) problems.push(`${label}: minutes`);
    if (paper.date && !(paper.date.startsWith(String(paper.year)) && !Number.isNaN(Date.parse(paper.date)))) problems.push(`${label}: date`);
    if (!paper.copies.length || paper.copies.some((key) => !seed.copies[key])) problems.push(`${label}: unknown copy`);
    if (paper.questions.length > 99) problems.push(`${label}: too many questions`);

    const allPoints = paper.questions.every((item) => typeof item.points === "number");
    const total = paper.questions.reduce((sum, item) => sum + (item.points ?? 0), 0);
    if (allPoints && total !== paper.points) problems.push(`${label}: points add up to ${total}, not ${paper.points}`);
    if (!allPoints && paper.questions.some((item) => typeof item.points === "number")) problems.push(`${label}: points on some questions only`);

    const sitting = paper.session ? `, ${ORDINAL_EN[paper.session]} sitting` : "";
    const sittingKm = paper.session ? ` លើកទី${khmerNumber(paper.session)}` : "";
    const copies = paper.copies.map((key) => seed.copies[key]?.label).join(" and ");
    const source = [
      `BacII ${paper.year}${sitting}${paper.date ? ` (${paper.date})` : ""}, ${seed.trackEn} ${seed.nameEn.toLowerCase()}, Ministry of Education, Youth and Sport.`,
      `Typed by Meh Rean from ${paper.copies.length > 1 ? "two copies" : "one copy"}: ${copies}. Not yet checked against the Ministry's original.`,
      paper.note ? `Note: ${paper.note}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (source.length > 500) problems.push(`${label}: source is ${source.length} characters (500 at most)`);

    const questions = paper.questions.map((item, index) => {
      const chapterId = `${seed.subjectId}-${item.chapter}`;
      if (!chapters.some((chapter) => chapter.id === chapterId && chapter.subjectId === seed.subjectId)) problems.push(`${label} Q${index + 1}: chapter ${item.chapter}`);
      if (!item.content.trim() || item.content.length > 20000) problems.push(`${label} Q${index + 1}: content`);
      if (item.points !== undefined && !(item.points > 0 && item.points <= 200)) problems.push(`${label} Q${index + 1}: points`);
      const images = (item.images ?? []).map(({ file, alt }) => ({ path: `past-papers/${file}`, alt: alt.trim(), url: bundledImageUrl(`past-papers/${file}`) }));
      if (images.length > 6 || images.some((image) => !BUNDLED_IMAGE.test(image.path) || !image.alt || image.alt.length > 300)) problems.push(`${label} Q${index + 1}: images`);
      if (item.ai && (!item.ai.answer.trim() || item.ai.answer.length > 5000 || item.ai.steps.length > 40 || item.ai.steps.some((step) => !step.trim() || step.length > 5000))) problems.push(`${label} Q${index + 1}: AI answer`);
      const questionId = `${id.slice(0, -2)}${String(index + 1).padStart(2, "0")}`;
      const question: Question = {
        id: questionId,
        subjectId: seed.subjectId,
        chapterId,
        topicId: null,
        year: paper.year,
        type: "open",
        content: item.content,
        choices: [],
        images,
        difficulty: null,
        language: seed.language ?? "km",
        origin: "official-past-paper",
        source,
        verification: "needs-review",
        verifiedAt: null,
        createdAt: SEEDED_AT,
        updatedAt: SEEDED_AT,
        solution: item.ai
          ? {
              questionId,
              answer: item.ai.answer.trim(),
              correctChoice: null,
              numericAnswer: null,
              numericTolerance: null,
              steps: item.ai.steps.map((content) => ({ content: content.trim() })),
              origin: "ai-generated",
              source: AI_ANSWER_SOURCE,
              verification: "needs-review",
              verifiedAt: null,
              updatedAt: SEEDED_AT,
            }
          : null,
      };
      return { position: index + 1, points: item.points ?? null, question };
    });

    return {
      id,
      subjectId: seed.subjectId,
      year: paper.year,
      titleEn: `BacII ${paper.year}${sitting}: ${seed.nameEn} (${seed.trackEn})`,
      titleKm: `វិញ្ញាសា${seed.nameKm} បាក់ឌុបឆ្នាំ${khmerNumber(paper.year)}${sittingKm} (${seed.trackKm})`,
      durationMinutes: paper.minutes,
      durationSource: `Printed on the paper: រយៈពេល ${khmerNumber(paper.minutes)} នាទី`,
      origin: "official",
      source,
      verification: "needs-review",
      questionCount: questions.length,
      totalPoints: allPoints ? total : null,
      questions,
    };
  });

  if (problems.length) throw new Error(`Past papers are invalid:\n- ${problems.join("\n- ")}`);
  return papers;
}

/** Newest first, then by title. */
export function sortPapers<T extends ExamPaper>(papers: T[]): T[] {
  return [...papers].sort((a, b) => b.year - a.year || a.titleEn.localeCompare(b.titleEn));
}
