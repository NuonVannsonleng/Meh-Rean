import { useState } from "react";
import { t } from "../i18n/en";
import type { VideoQuiz } from "../types";
import { CheckIcon } from "./Icons";
import MathText from "./MathText";

const copy = t.bacii.videos.quiz;

/** A short quiz after watching a video (roadmap 4.6), with where its questions came from. */
export default function VideoQuizPanel({ quiz }: { quiz: VideoQuiz }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [checked, setChecked] = useState(false);
  const score = quiz.questions.filter((question, index) => picked[index] === question.answer).length;
  const origin = !quiz.aiGenerated ? copy.byMehRean : quiz.reviewed ? copy.aiReviewed : copy.aiUnreviewed;

  return (
    <section className="border-line border-t p-3 sm:p-4" aria-labelledby="video-quiz">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 id="video-quiz" className="font-display text-ink-900 text-base font-bold">
          {copy.title}
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${quiz.aiGenerated && !quiz.reviewed ? "bg-ribbon-50 text-ribbon-fg" : "bg-brand-50 text-accent"}`}>
          {origin}
        </span>
      </div>
      <ol className="space-y-3">
        {quiz.questions.map((question, index) => (
          <li key={index}>
            <fieldset>
              <legend className="text-ink-900 mb-1 text-sm font-medium">
                <MathText text={`${index + 1}. ${question.prompt}`} as="span" />
              </legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {question.choices.map((choice, choiceIndex) => {
                  const chosen = picked[index] === choiceIndex;
                  const right = checked && choiceIndex === question.answer;
                  const wrong = checked && chosen && !right;
                  return (
                    <label
                      key={choiceIndex}
                      className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                        right ? "border-brand-600 bg-brand-50" : wrong ? "border-danger-fg bg-danger-bg" : chosen ? "border-brand-600" : "border-line hover:border-ink-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`quiz-${quiz.videoId}-${index}`}
                        checked={chosen}
                        disabled={checked}
                        onChange={() => setPicked((current) => current.map((value, i) => (i === index ? choiceIndex : value)))}
                        className="mt-1"
                      />
                      <MathText text={choice} as="span" className="text-ink-900 min-w-0" />
                    </label>
                  );
                })}
              </div>
              {checked && question.explanation && <MathText text={question.explanation} className="text-ink-700 mt-1 text-xs" />}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {checked ? (
          <>
            <p role="status" className="text-ink-900 inline-flex items-center gap-1.5 text-sm font-semibold">
              <CheckIcon className="text-accent h-4 w-4" />
              {copy.score(score, quiz.questions.length)}
            </p>
            <button
              type="button"
              onClick={() => {
                setPicked(quiz.questions.map(() => null));
                setChecked(false);
              }}
              className="btn-ghost h-9 px-3 text-sm"
            >
              {copy.again}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setChecked(true)} disabled={picked.some((value) => value === null)} className="btn-primary h-9 px-4 text-sm">
            {copy.check}
          </button>
        )}
      </div>
      <p className="text-ink-500 mt-2 text-xs">{copy.source(quiz.source)}</p>
    </section>
  );
}
