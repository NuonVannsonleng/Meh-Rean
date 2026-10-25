import { useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import { youtubeSearchUrl } from "../lib/bacii";
import type { QuestionSolution } from "../types";
import { ExternalLinkIcon, SearchIcon, VideoIcon } from "./Icons";
import MathText from "./MathText";
import VerificationBadge from "./VerificationBadge";

const copy = t.solution;

/**
 * A worked solution revealed one step at a time, so a student can try each
 * step before looking, then the final answer. Ends with ways to find a video
 * when the steps are not enough (roadmap 2.2).
 */
export default function SolutionSteps({
  solution,
  questionText,
  subjectKey,
  chapterKm,
  chapterId,
}: {
  solution: QuestionSolution;
  questionText: string;
  subjectKey: string;
  chapterKm: string | null;
  /** Passed to the video finder as a hint. */
  chapterId?: string;
}) {
  // How many steps are visible; steps.length + 1 means the answer is shown too.
  const [shown, setShown] = useState(0);
  const total = solution.steps.length;
  const done = shown > total;

  const next = () => setShown((count) => Math.min(count + 1, total + 1));

  if (shown === 0) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={next} className="btn-secondary h-9 px-3 text-sm">
          {total ? copy.firstStep : copy.showAnswer}
        </button>
        {total > 1 && (
          <button type="button" onClick={() => setShown(total + 1)} className="btn-ghost h-9 px-3 text-sm">
            {copy.showAll}
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="border-line mt-3 rounded-md border" aria-label={copy.heading}>
      <div className="border-line flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h3 className="text-ink-900 text-sm font-bold">{copy.heading}</h3>
        <VerificationBadge value={solution.verification} />
        <span className="text-ink-500 text-xs">{copy.origin(t.questions.solutionOrigins[solution.origin])}</span>
      </div>
      {solution.origin === "ai-generated" && solution.verification !== "verified" && (
        <p className="bg-danger-bg text-danger-fg px-3 py-2 text-xs font-medium">{copy.aiWarning}</p>
      )}

      <ol className="divide-line divide-y" aria-live="polite">
        {solution.steps.slice(0, shown).map((step, index) => (
          <li key={index} className="animate-pop px-3 py-2.5">
            <p className="text-ink-500 mb-1 text-[11px] font-semibold tracking-wide uppercase">{copy.stepOf(index + 1, total)}</p>
            <MathText text={step.content} className="text-ink-900 text-sm" />
          </li>
        ))}
        {done && (
          <li className="bg-brand-50 animate-pop px-3 py-2.5">
            <p className="text-accent mb-1 text-[11px] font-bold tracking-wide uppercase">{copy.answer}</p>
            <MathText text={solution.answer} className="text-ink-900 text-sm font-medium" />
          </li>
        )}
      </ol>

      <div className="border-line flex flex-wrap items-center gap-2 border-t px-3 py-2">
        {!done && (
          <>
            <button type="button" onClick={next} className="btn-primary h-9 px-3 text-sm">
              {shown < total ? copy.nextStep : copy.showAnswer}
            </button>
            <button type="button" onClick={() => setShown(total + 1)} className="btn-ghost h-9 px-3 text-sm">
              {copy.showAll}
            </button>
            <span className="text-ink-500 text-xs">{copy.tryFirst}</span>
          </>
        )}
        <button type="button" onClick={() => setShown(0)} className="btn-ghost ml-auto h-9 px-3 text-sm">
          {copy.hide}
        </button>
      </div>

      {done && (
        <div className="border-line border-t px-3 py-2.5">
          <p className="text-ink-700 mb-2 text-xs font-semibold">{copy.videoHeading}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/bacii/videos?text=${encodeURIComponent(questionText.slice(0, 1500))}&subject=${encodeURIComponent(subjectKey)}${chapterId ? `&chapter=${encodeURIComponent(chapterId)}` : ""}`}
              className="btn-secondary h-9 px-3 text-sm"
            >
              <VideoIcon className="h-4 w-4" />
              {copy.findVideo}
            </Link>
            {chapterKm && (
              <a href={youtubeSearchUrl(`${chapterKm} បាក់ឌុប`)} target="_blank" rel="noreferrer" className="btn-ghost h-9 px-3 text-sm">
                <SearchIcon className="h-4 w-4" />
                {copy.searchChapter}
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
