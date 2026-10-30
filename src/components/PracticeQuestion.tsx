import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { isCorrect } from "../lib/questions";
import { recordPracticeAnswer } from "../services/api";
import type { CurriculumChapter, Question } from "../types";
import { CheckIcon } from "./Icons";
import MathText from "./MathText";
import QuestionImage from "./QuestionImage";
import SolutionSteps from "./SolutionSteps";
import VerificationBadge from "./VerificationBadge";
import { useCalculatorFor } from "../context/CalculatorContext";

const copy = t.bacii.practice;

/**
 * One question to practise: answer it, get instant feedback (multiple choice
 * and numbers), and open the worked solution. Feedback shows at once from
 * the answer key; for a signed-in student the answer is also marked on the
 * server, which keeps their mistake notebook (roadmap 3.1).
 */
export default function PracticeQuestion({
  question,
  number,
  chapter,
  subjectKey,
  note,
  onChecked,
}: {
  question: Question;
  number: number;
  chapter: CurriculumChapter | undefined;
  subjectKey: string;
  /** Shown under the question, before the answer (the mistake notebook uses it). */
  note?: ReactNode;
  /** After the server has marked a signed-in student's answer. */
  onChecked?: (correct: boolean, answer: string) => void;
}) {
  useCalculatorFor(subjectKey);
  const formId = useId();
  const { user } = useAuth();
  const [given, setGiven] = useState("");
  const [result, setResult] = useState<"correct" | "incorrect" | "empty" | null>(null);
  const [recorded, setRecorded] = useState<"added" | "fixed" | "failed" | null>(null);
  const checkable = question.solution && (question.type === "multiple-choice" || question.type === "numeric");

  const check = (event: FormEvent) => {
    event.preventDefault();
    if (!question.solution) return;
    if (!given.trim()) {
      setResult("empty");
      return;
    }
    setResult(isCorrect(question, question.solution, given) ? "correct" : "incorrect");
    setRecorded(null);
    if (!user) return;
    recordPracticeAnswer(question.id, given, crypto.randomUUID())
      .then((correct) => {
        if (correct === null) return;
        setResult(correct ? "correct" : "incorrect");
        setRecorded(correct ? "fixed" : "added");
        onChecked?.(correct, given);
      })
      .catch(() => setRecorded("failed"));
  };

  return (
    <li className="card p-4 sm:p-5" aria-labelledby={`${formId}-title`} data-question-id={question.id}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <h2 id={`${formId}-title`} className="font-display text-ink-900 text-base font-bold">
          {t.bacii.papers.question(number)}
        </h2>
        {chapter && <span className="text-ink-500">· {chapter.nameEn}</span>}
        {question.origin === "demo" && (
          <span className="bg-ribbon-50 text-ribbon-fg rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">{copy.demo}</span>
        )}
        <VerificationBadge value={question.verification} />
      </div>
      <MathText text={question.content} className="text-ink-900 text-base" />
      {question.images.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {question.images.map((image) => (
            <QuestionImage key={image.path} image={image} className="max-h-64 w-full" />
          ))}
        </div>
      )}

      {note}

      {checkable && (
        <form onSubmit={check} className="mt-3">
          {question.type === "multiple-choice" ? (
            <fieldset>
              <legend className="sr-only">{copy.chooseAnswer(number)}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {question.choices.map((choice) => {
                  const picked = given === choice.id;
                  return (
                    <label
                      key={choice.id}
                      className={`press flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${
                        picked ? "border-brand-600 bg-brand-50" : "border-line hover:border-ink-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${formId}-choice`}
                        value={choice.id}
                        checked={picked}
                        onChange={() => {
                          setGiven(choice.id);
                          setResult(null);
                        }}
                        className="sr-only"
                      />
                      <span className="text-ink-500 text-sm font-bold">{choice.id.toUpperCase()}.</span>
                      <MathText text={choice.content} as="span" className="text-ink-900 min-w-0 text-sm" />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : (
            <label className="text-ink-700 block max-w-xs text-sm font-medium">
              {copy.numberLabel}
              <input
                inputMode="decimal"
                value={given}
                onChange={(event) => {
                  setGiven(event.target.value);
                  setResult(null);
                }}
                className="input mt-1"
              />
            </label>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary h-9 px-4 text-sm">
              {copy.check}
            </button>
            <p role="status" className="text-sm font-medium">
              {result === "correct" && (
                <span className="text-accent inline-flex items-center gap-1">
                  <CheckIcon className="h-4 w-4" />
                  {copy.correct}
                </span>
              )}
              {result === "incorrect" && <span className="text-danger-fg">{copy.incorrect}</span>}
              {result === "empty" && <span className="text-ink-500">{question.type === "numeric" ? copy.typeFirst : copy.pickFirst}</span>}
            </p>
            {recorded && (
              <p className="text-ink-500 w-full text-xs" aria-live="polite">
                {recorded === "added" ? copy.addedToNotebook : recorded === "fixed" ? copy.fixedInNotebook : copy.notRecorded}
              </p>
            )}
          </div>
        </form>
      )}

      {question.solution && (
        <SolutionSteps solution={question.solution} questionText={question.content} subjectKey={subjectKey} chapterKm={chapter?.nameKm ?? null} chapterId={chapter?.id} />
      )}
    </li>
  );
}
