import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon, CameraIcon, SearchIcon, TrashIcon } from "../components/Icons";
import MathText from "../components/MathText";
import PracticeQuestion from "../components/PracticeQuestion";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import {
  BACII_SUBJECTS,
  LookupError,
  prepareImage,
  readExercisePhoto,
  solveWithAI,
  type AISolution,
  type BaciiSubject,
  type ExerciseTranscript,
  type PreparedImage,
} from "../lib/bacii";
import { useQuestionBank } from "../hooks/useQuestionBank";
import { matchQuestions } from "../lib/questionMatch";
import { subjectLabel } from "../lib/subjects";
import { isLocalMode } from "../services/api";
import { useCalculatorFor } from "../context/CalculatorContext";

const copy = t.bacii.solve;

type Busy = { kind: "idle" } | { kind: "working" } | { kind: "error"; error: LookupError };

const asLookupError = (error: unknown) => (error instanceof LookupError ? error : new LookupError("UPSTREAM", String(error)));

function ErrorNote({ error }: { error: LookupError }) {
  return (
    <div role="alert" className="bg-danger-bg text-danger-fg mt-3 rounded-md px-4 py-3 text-sm font-medium">
      <p>{error.message}</p>
      {error.detail && <p className="mt-1 font-mono text-xs font-normal break-words opacity-80">{error.detail}</p>}
    </div>
  );
}

/** The AI's worked solution, clearly marked as unchecked. */
function AISolutionCard({ solution }: { solution: AISolution }) {
  return (
    <section className="card border-ribbon-fg/30 p-4 sm:p-5" aria-labelledby="ai-solution">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 id="ai-solution" className="font-display text-ink-900 text-base font-bold">
          {copy.aiTitle}
        </h3>
        <span className="bg-ribbon-50 text-ribbon-fg rounded-full px-2 py-0.5 text-[11px] font-bold">{copy.aiBadge(solution.provider)}</span>
        <span className="text-ink-500 text-xs">{copy.confidence[solution.confidence]}</span>
      </div>
      <ol className="text-ink-900 list-decimal space-y-2 pl-5 text-sm">
        {solution.steps.map((step, index) => (
          <li key={index}>
            <MathText text={step} />
          </li>
        ))}
      </ol>
      <div className="bg-surface-muted mt-3 rounded-md px-3 py-2 text-sm">
        <p className="text-ink-500 text-[11px] font-semibold tracking-wide uppercase">{copy.answer}</p>
        <MathText text={solution.answer} className="text-ink-900" />
      </div>
      {solution.caveats && <p className="text-ink-700 mt-2 text-xs">{solution.caveats}</p>}
      <p className="text-ink-500 mt-3 text-xs">{copy.aiWarning}</p>
    </section>
  );
}

/** BacII → Photo to solution: read a photo, let the student fix it, match the question bank first (roadmap 4.5). */
export default function BaciiSolve() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const textId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [text, setText] = useState(() => (params.get("text") ?? "").slice(0, 3000));
  const [subject, setSubject] = useState<BaciiSubject | "">("");
  // Photos to solve are mostly calculations: offered unless another subject is chosen.
  useCalculatorFor(subject || "mathematics");
  const [transcript, setTranscript] = useState<ExerciseTranscript | null>(null);
  const [reading, setReading] = useState<Busy>({ kind: "idle" });
  const [solving, setSolving] = useState<Busy>({ kind: "idle" });
  const [solution, setSolution] = useState<AISolution | null>(null);
  // The question bank and chapter names, for matching and labels.
  const { bank, chapterOf, subjectKeyOf } = useQuestionBank();
  const [settled, setSettled] = useState(text);

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
  }, []);

  // Match once the student pauses typing.
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(text), 400);
    return () => window.clearTimeout(timer);
  }, [text]);

  const chapterId = transcript?.chapter?.id ?? null;
  const matches = useMemo(() => (bank ? matchQuestions(settled, bank, chapterId) : []), [bank, settled, chapterId]);

  const addFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setImage(await prepareImage(file));
      setReading({ kind: "idle" });
    } catch (error) {
      setReading({ kind: "error", error: asLookupError(error) });
    }
  };

  const read = async () => {
    if (!image) return;
    setReading({ kind: "working" });
    setSolution(null);
    try {
      const result = await readExercisePhoto(image, subject);
      setTranscript(result);
      setText(result.text);
      setSettled(result.text);
      if (!subject && BACII_SUBJECTS.some((item) => item.id === result.subject)) setSubject(result.subject as BaciiSubject);
      setReading({ kind: "idle" });
    } catch (error) {
      setReading({ kind: "error", error: asLookupError(error) });
    }
  };

  const solve = async () => {
    setSolving({ kind: "working" });
    try {
      setSolution(await solveWithAI(text.trim(), subject, chapterId ?? undefined));
      setSolving({ kind: "idle" });
    } catch (error) {
      setSolving({ kind: "error", error: asLookupError(error) });
    }
  };

  const online = !isLocalMode;
  const enough = text.trim().length >= 8;
  const videoLink = `/bacii/videos?text=${encodeURIComponent(text.trim().slice(0, 1500))}${subject ? `&subject=${subject}` : ""}${chapterId ? `&chapter=${encodeURIComponent(chapterId)}` : ""}`;

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-5">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="text-ink-700 mt-2 text-sm leading-relaxed">{copy.intro}</p>
      </header>

      <section className="card space-y-4 p-4 sm:p-6" aria-label={copy.stepExercise}>
        {/* 1. Photo */}
        <div>
          <p className="field-label">{copy.photoLabel}</p>
          {image ? (
            <div className="border-line bg-surface-muted/60 rounded-md border p-2">
              <img src={image.previewUrl} alt={copy.photoAlt} className="mx-auto max-h-72 rounded object-contain" />
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {user && online && (
                  <button type="button" onClick={() => void read()} disabled={reading.kind === "working"} className="btn-primary h-9 px-4 text-sm">
                    {reading.kind === "working" ? copy.reading : copy.read}
                  </button>
                )}
                <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost h-9 px-3 text-sm">
                  <CameraIcon className="h-4 w-4" />
                  {copy.changePhoto}
                </button>
                <button type="button" onClick={() => setImage(null)} className="btn-ghost h-9 px-3 text-sm">
                  <TrashIcon className="h-4 w-4" />
                  {copy.removePhoto}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary">
              <CameraIcon className="h-4 w-4" />
              {copy.takePhoto}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label={copy.photoLabel}
            onChange={(event) => {
              void addFile(event.target.files?.[0]);
              event.target.value = "";
            }}
            className="sr-only"
            tabIndex={-1}
          />
          {!online ? (
            <p className="text-ink-500 mt-2 text-xs">{copy.offlineNote}</p>
          ) : !user ? (
            <p className="text-ink-500 mt-2 text-xs">
              <Link to="/login?next=%2Fbacii%2Fsolve" className="text-accent font-semibold hover:underline">
                {copy.signIn}
              </Link>{" "}
              {copy.signInNote}
            </p>
          ) : null}
          {reading.kind === "error" && <ErrorNote error={reading.error} />}
        </div>

        <label className="text-ink-700 block text-sm font-medium">
          {copy.subject}
          <select value={subject} onChange={(event) => setSubject(event.target.value as BaciiSubject | "")} className="input mt-1 h-10 sm:w-auto">
            <option value="">{copy.subjectAny}</option>
            {BACII_SUBJECTS.map((item) => (
              <option key={item.id} value={item.id}>{subjectLabel(item.id)}</option>
            ))}
          </select>
        </label>

        {/* 2. The text, to check and correct */}
        <div>
          <label htmlFor={textId} className="field-label">
            {copy.textLabel}
          </label>
          <p className="text-ink-500 mb-1.5 text-xs">{transcript ? copy.checkHint : copy.textHint}</p>
          {transcript && transcript.unclear.length > 0 && (
            <ul className="bg-ribbon-50 text-ribbon-fg mb-2 list-disc rounded-md py-2 pr-3 pl-7 text-xs">
              {transcript.unclear.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          )}
          <textarea
            id={textId}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setSolution(null);
            }}
            rows={5}
            maxLength={3000}
            placeholder={copy.textPlaceholder}
            className="input field-sizing-content h-auto min-h-28 resize-y py-3 text-sm leading-relaxed"
          />
          {enough && (
            <div className="border-line mt-2 rounded-md border border-dashed px-3 py-2">
              <p className="text-ink-500 mb-1 text-[11px] font-semibold tracking-wide uppercase">{copy.preview}</p>
              <MathText text={text} className="text-ink-900 text-sm" />
            </div>
          )}
        </div>
      </section>

      {/* 3. The question bank first */}
      {enough && (
        <section className="mt-5" aria-labelledby="bank-matches">
          <h2 id="bank-matches" className="font-display text-ink-900 mb-2 text-lg font-bold">
            {copy.bankTitle}
          </h2>
          {!bank ? (
            <p className="text-ink-500 text-sm">{copy.searchingBank}</p>
          ) : matches.length === 0 ? (
            <p className="card text-ink-700 p-4 text-sm">{copy.noMatch}</p>
          ) : (
            <ol className="space-y-3">
              {matches.map((match, index) => (
                <PracticeQuestion
                  key={match.question.id}
                  question={match.question}
                  number={index + 1}
                  chapter={chapterOf.get(match.question.chapterId)}
                  subjectKey={subjectKeyOf(match.question.subjectId)}
                  note={<p className="text-accent mt-2 text-xs font-semibold">{copy.matchNote(Math.round(match.score * 100))}</p>}
                />
              ))}
            </ol>
          )}
        </section>
      )}

      {/* 4. Other help */}
      {enough && (
        <section className="mt-5 space-y-3" aria-labelledby="more-help">
          <h2 id="more-help" className="font-display text-ink-900 text-lg font-bold">
            {matches.length ? copy.moreHelpTitle : copy.helpTitle}
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {user && online && (
              <button type="button" onClick={() => void solve()} disabled={solving.kind === "working"} className="btn-primary">
                {solving.kind === "working" ? copy.solving : copy.solve}
              </button>
            )}
            <Link to={videoLink} className="btn-secondary">
              <SearchIcon className="h-4 w-4" />
              {copy.findVideos}
            </Link>
            {transcript?.chapter && (
              <Link
                to={`/bacii/practice?subject=${encodeURIComponent(transcript.chapter.subjectId)}&chapter=${encodeURIComponent(transcript.chapter.id)}`}
                className="btn-ghost"
              >
                {copy.practiseChapter(transcript.chapter.number, transcript.chapter.nameEn)}
              </Link>
            )}
          </div>
          {user && online && <p className="text-ink-500 text-xs">{copy.solveNote}</p>}
          {solving.kind === "error" && <ErrorNote error={solving.error} />}
          {solution && <AISolutionCard solution={solution} />}
        </section>
      )}
    </div>
  );
}
