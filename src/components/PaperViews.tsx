import { useEffect, useState } from "react";
import { t } from "../i18n/en";
import type { ExamPaperDetail } from "../types";
import MathText from "./MathText";
import QuestionImage from "./QuestionImage";
import SolutionSteps from "./SolutionSteps";

const copy = t.bacii.paperView;
type View = "scan" | "typed";
type AnswerView = "copy" | "ai";
export interface PaperScans {
  paper: string[];
  answers: string[];
  answersBy: string;
}

// The chosen views are a per-device convenience.
const VIEW_KEY = "meh-rean:paper-view";
const ANSWER_KEY = "meh-rean:paper-answer-view";
const remembered = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
};

let manifest: Promise<Record<string, PaperScans>> | null = null;
/** Page images of the real papers (public/past-papers/scans/), loaded only when a paper is shown. */
function loadScans(): Promise<Record<string, PaperScans>> {
  manifest ??= import("../data/bacii/past-paper-scans.json").then((module) => module.default as Record<string, PaperScans>);
  return manifest;
}
export function usePaperScans(paperId: string | undefined): PaperScans | null {
  const [scans, setScans] = useState<PaperScans | null>(null);
  useEffect(() => {
    let active = true;
    setScans(null);
    if (!paperId) return;
    loadScans()
      .then((all) => active && setScans(all[paperId] ?? null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [paperId]);
  return scans;
}
const scanUrl = (file: string) => `/past-papers/scans/${file}`;

function Segmented<T extends string>({ label, value, options, onChange, name }: { label: string; value: T; options: { value: T; en: string; km: string }[]; onChange: (value: T) => void; name: string }) {
  return (
    <fieldset className="bg-surface-hover inline-flex rounded-full p-1">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={`press cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium has-[:focus-visible]:outline-2 ${value === option.value ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"}`}
        >
          <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
          {option.en} <span className="text-ink-500 text-xs" lang="km">{`· ${option.km}`}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** The pages as printed, like the sheet handed out in the exam room; tap a page to see it full size. */
function ScanPages({ files, title, testId }: { files: string[]; title: string; testId: string }) {
  const [zoomed, setZoomed] = useState<string | null>(null);
  useEffect(() => {
    if (!zoomed) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setZoomed(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [zoomed]);
  return (
    <>
      <div className="space-y-3" data-testid={testId}>
        {files.map((file, index) => (
          <button key={file} type="button" onClick={() => setZoomed(file)} className="block w-full cursor-zoom-in rounded-sm bg-white p-2 shadow-md ring-1 ring-black/10 sm:p-4">
            <img src={scanUrl(file)} alt={copy.scanAlt(title, index + 1, files.length)} loading={index < 2 ? "eager" : "lazy"} className="mx-auto block h-auto w-full max-w-[900px]" />
          </button>
        ))}
      </div>
      {zoomed && (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 overflow-auto bg-black/85 p-2" onClick={() => setZoomed(null)}>
          <button type="button" onClick={() => setZoomed(null)} className="btn-secondary fixed top-3 right-3 z-10 h-9 px-3 text-sm">
            {copy.zoomOut}
          </button>
          <img src={scanUrl(zoomed)} alt={title} className="mx-auto block w-[900px] max-w-none bg-white" />
        </div>
      )}
    </>
  );
}

function TypedQuestions({ paper }: { paper: ExamPaperDetail }) {
  return (
    <ol id="timer-question-list" className="space-y-3">
      {paper.questions.map((entry) => (
        <li key={entry.question.id} className="card p-4">
          <h3 className="text-ink-900 mb-1 text-sm font-bold">
            {t.bacii.papers.question(entry.position)}
            {entry.points !== null && <span className="text-ink-500 font-normal">{` · ${t.bacii.papers.questionPoints(entry.points)}`}</span>}
          </h3>
          <MathText text={entry.question.content} className="text-ink-900 text-base" />
          {entry.question.images.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {entry.question.images.map((image) => (
                <QuestionImage key={image.path} image={image} className="max-h-72 w-full" />
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * A real past paper two ways: the printed pages, or one question at a time;
 * then, once allowed, its answers: the copy's own printed answers, or the
 * AI answer key (each labelled as unchecked).
 */
export default function PaperViews({
  paper,
  answersOpen,
  subjectKey,
  onToggleAnswers,
}: {
  paper: ExamPaperDetail;
  answersOpen: boolean;
  subjectKey: string;
  /** Outside a timed sitting the student opens and closes the answers themselves. */
  onToggleAnswers?: () => void;
}) {
  const scans = usePaperScans(paper.id);
  const [view, setView] = useState<View>(() => remembered(VIEW_KEY, ["scan", "typed"] as const, "scan"));
  const [answerView, setAnswerView] = useState<AnswerView>(() => remembered(ANSWER_KEY, ["copy", "ai"] as const, "copy"));
  const hasScans = Boolean(scans?.paper.length);
  const shown: View = hasScans ? view : "typed";
  const aiCount = paper.questions.filter((entry) => entry.question.solution?.origin === "ai-generated").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label={copy.viewLabel}
          name="paper-view"
          value={shown}
          onChange={(value) => {
            setView(value);
            remember(VIEW_KEY, value);
          }}
          options={(["scan", "typed"] as const).map((value) => ({ value, en: copy.views[value], km: copy.viewsKm[value] }))}
        />
      </div>
      {shown === "scan" && scans ? (
        <>
          <p className="text-ink-500 text-xs">{copy.scanNote}</p>
          <ScanPages files={scans.paper} title={paper.titleKm} testId="paper-scans" />
        </>
      ) : (
        <>
          {scans === null && view === "scan" && <p className="text-ink-500 text-xs">{copy.noScan}</p>}
          <TypedQuestions paper={paper} />
        </>
      )}

      <section aria-labelledby="paper-answers" className="border-line border-t pt-4">
        <h2 id="paper-answers" className="text-ink-900 mb-2 text-lg font-bold">
          {copy.answersTitle} <span className="text-ink-500 text-sm font-normal" lang="km">{`· ${copy.answersTitleKm}`}</span>
        </h2>
        {onToggleAnswers && (
          <button type="button" onClick={onToggleAnswers} className={answersOpen ? "btn-ghost mb-3 h-9 px-3 text-sm" : "btn-secondary h-9 px-3 text-sm"} aria-expanded={answersOpen}>
            {answersOpen ? copy.hideAnswers : copy.showAnswers}
          </button>
        )}
        {!answersOpen ? (
          !onToggleAnswers && <p className="text-ink-500 text-sm">{copy.answersLocked}</p>
        ) : (
          <div className="space-y-3">
            <Segmented
              label={copy.answerLabel}
              name="paper-answer-view"
              value={answerView}
              onChange={(value) => {
                setAnswerView(value);
                remember(ANSWER_KEY, value);
              }}
              options={(["copy", "ai"] as const).map((value) => ({ value, en: copy.answerViews[value], km: copy.answerViewsKm[value] }))}
            />
            {answerView === "copy" ? (
              scans?.answers.length ? (
                <>
                  <p role="note" className="bg-ribbon-50 text-ribbon-fg rounded-md px-3 py-2 text-xs">
                    {copy.copyNote(scans.answersBy)}
                  </p>
                  <ScanPages files={scans.answers} title={`${paper.titleKm} · ${copy.answersTitleKm}`} testId="answer-scans" />
                </>
              ) : (
                <p className="text-ink-500 text-sm">{copy.noCopy}</p>
              )
            ) : aiCount === 0 ? (
              <p className="text-ink-500 text-sm">{copy.noAi}</p>
            ) : (
              <>
                <p role="note" className="bg-danger-bg text-danger-fg rounded-md px-3 py-2 text-xs font-medium">
                  {copy.aiNote}
                </p>
                <ol className="space-y-3" data-testid="ai-answers">
                  {paper.questions.map((entry) => (
                    <li key={entry.question.id} className="card p-4">
                      <p className="text-ink-900 mb-1 text-sm font-bold">{copy.question(entry.position)}</p>
                      <details className="text-ink-700 mb-1 text-sm">
                        <summary className="text-ink-500 cursor-pointer text-xs">{t.bacii.timer.paper.questionsTitle}</summary>
                        <MathText text={entry.question.content} className="mt-1 text-sm" />
                      </details>
                      {entry.question.solution?.origin === "ai-generated" ? (
                        <SolutionSteps solution={entry.question.solution} questionText={entry.question.content} subjectKey={subjectKey} chapterKm={null} />
                      ) : (
                        <p className="text-ink-500 text-sm">{copy.aiMissing}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
