import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import MathText from "../components/MathText";
import QuestionImage from "../components/QuestionImage";
import SolutionSteps from "../components/SolutionSteps";
import { t } from "../i18n/en";
import { getCurriculumChapters, getCurriculumSubjects, getExamPaper } from "../services/api";
import type { CurriculumChapter, CurriculumSubject, ExamPaperDetail, ExamPaperQuestion } from "../types";
import { PaperOriginBadge } from "./BaciiPapers";

const copy = t.bacii.papers;

function PaperQuestion({
  entry,
  chapter,
  subjectKey,
}: {
  entry: ExamPaperQuestion;
  chapter: CurriculumChapter | undefined;
  subjectKey: string;
}) {
  const { question, position, points } = entry;
  const solution = question.solution;
  return (
    <li className="card p-4 sm:p-5" aria-labelledby={`q-${question.id}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <h2 id={`q-${question.id}`} className="font-display text-ink-900 text-base font-bold">
          {copy.question(position)}
        </h2>
        {points !== null && <span className="text-ink-500">· {copy.questionPoints(points)}</span>}
        {chapter && <span className="text-ink-500">· {chapter.nameKm}</span>}
      </div>
      <MathText text={question.content} className="text-ink-900 text-base" />
      {question.images.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {question.images.map((image) => (
            <QuestionImage key={image.path} image={image} className="max-h-64 w-full" />
          ))}
        </div>
      )}
      {question.type === "multiple-choice" && (
        <ol aria-label={copy.choicesLabel(position)} className="mt-3 grid gap-2 sm:grid-cols-2">
          {question.choices.map((choice) => (
            <li key={choice.id} className="border-line flex items-start gap-2 rounded-md border px-3 py-2">
              <span className="text-ink-500 text-sm font-bold">{choice.id.toUpperCase()}.</span>
              <MathText text={choice.content} as="span" className="text-ink-900 min-w-0 text-sm" />
            </li>
          ))}
        </ol>
      )}
      {solution && <SolutionSteps solution={solution} questionText={question.content} subjectKey={subjectKey} chapterKm={chapter?.nameKm ?? null} />}
    </li>
  );
}

/** BacII → Past papers → one paper. */
export default function BaciiPaper() {
  const { id = "" } = useParams();
  const [paper, setPaper] = useState<ExamPaperDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [subject, setSubject] = useState<CurriculumSubject | null>(null);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);

  useEffect(() => {
    let active = true;
    getExamPaper(id)
      .then((loaded) => {
        if (!active) return;
        setPaper(loaded);
        document.title = `${loaded.year} · ${loaded.titleEn} · ${t.common.appName}`;
        getCurriculumChapters(loaded.subjectId).then((list) => active && setChapters(list)).catch(() => {});
        getCurriculumSubjects()
          .then((list) => active && setSubject(list.find((item) => item.id === loaded.subjectId) ?? null))
          .catch(() => {});
      })
      .catch(() => active && setMissing(true));
    return () => {
      active = false;
    };
  }, [id]);

  const chapterOf = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);

  if (missing) {
    return (
      <div className="container-page max-w-3xl py-16 text-center">
        <p className="text-ink-700">{copy.notFound}</p>
        <Link to="/bacii/papers" className="link mt-3 inline-block">
          {copy.back}
        </Link>
      </div>
    );
  }
  if (!paper) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={3} variant="block" />
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii/papers" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {copy.back}
      </Link>
      <header className="mb-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-display text-ink-500 text-lg font-bold">{paper.year}</span>
          <PaperOriginBadge paper={paper} />
        </div>
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{paper.titleKm}</h1>
        <p className="text-ink-500 mt-1 text-sm">{paper.titleEn}</p>
        <p className="text-ink-700 mt-2 text-sm">
          {subject && `${subject.nameKm} — ${subject.nameEn} · ${subject.trackNameEn} · `}
          {copy.questions(paper.questionCount)}
          {paper.totalPoints !== null && ` · ${copy.points(paper.totalPoints)}`}
          {" · "}
          {paper.durationMinutes && paper.durationSource ? copy.time(paper.durationMinutes) : copy.timePractice}
        </p>
      </header>
      {paper.origin === "demo" && (
        <p role="note" className="bg-ribbon-50 text-ribbon-fg mb-5 rounded-md px-4 py-3 text-sm font-medium">
          {copy.demoBanner}
        </p>
      )}
      <ol className="space-y-3">
        {paper.questions.map((entry) => (
          <PaperQuestion
            key={entry.question.id}
            entry={entry}
            chapter={chapterOf.get(entry.question.chapterId)}
            subjectKey={subject?.subjectKey ?? ""}
          />
        ))}
      </ol>
      {paper.source && <p className="text-ink-500 mt-6 text-xs">{copy.source(paper.source)}</p>}
    </div>
  );
}
