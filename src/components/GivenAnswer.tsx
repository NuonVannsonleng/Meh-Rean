import { t } from "../i18n/en";
import type { Question } from "../types";
import MathText from "./MathText";

/** What a student answered, readable: a choice shows its letter and text. */
export default function GivenAnswer({ question, answer }: { question: Question; answer: string }) {
  if (!answer.trim()) return <span className="text-ink-500 italic">{t.bacii.exam.noAnswer}</span>;
  if (question.type === "multiple-choice") {
    const choice = question.choices.find((item) => item.id === answer);
    return (
      <span className="inline-flex items-start gap-1">
        <strong>{answer.toUpperCase()}.</strong>
        {choice && <MathText text={choice.content} as="span" />}
      </span>
    );
  }
  return <span className="whitespace-pre-line">{answer}</span>;
}
