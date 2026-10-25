import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";
import LoadingState from "../components/LoadingState";
import MathText from "../components/MathText";
import QuestionImage from "../components/QuestionImage";
import { t } from "../i18n/en";
import { getExamAttempt, getExamPaper, getMyExamAttempts, saveExamAnswer, startExam, submitExam } from "../services/api";
import { ApiError, type ExamAttempt, type ExamPaperDetail, type ExamPaperQuestion } from "../types";

const copy = t.bacii.exam;
const PRACTICE_MINUTES = [30, 45, 60, 90, 120, 150];
const SAVE_DELAY_MS = 700;

/** "1:05:09" or "4:09". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

function AnswerInput({ entry, value, onChange }: { entry: ExamPaperQuestion; value: string; onChange: (value: string) => void }) {
  const { question, position } = entry;
  if (question.type === "multiple-choice") {
    return (
      <fieldset className="mt-4">
        <legend className="field-label">{copy.yourAnswer}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {question.choices.map((choice) => {
            const picked = value === choice.id;
            return (
              <label
                key={choice.id}
                className={`press flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${
                  picked ? "border-brand-600 bg-brand-50" : "border-line hover:border-ink-400"
                }`}
              >
                <input type="radio" name={`answer-${position}`} checked={picked} onChange={() => onChange(choice.id)} className="sr-only" />
                <span className="text-ink-500 text-sm font-bold">{choice.id.toUpperCase()}.</span>
                <MathText text={choice.content} as="span" className="text-ink-900 min-w-0 text-sm" />
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }
  if (question.type === "open") {
    return (
      <label className="mt-4 block">
        <span className="field-label">{copy.yourAnswer}</span>
        <textarea
          value={value}
          maxLength={5000}
          onChange={(event) => onChange(event.target.value)}
          placeholder={copy.openPlaceholder}
          rows={6}
          className="input field-sizing-content h-auto min-h-36 resize-y py-3 text-sm"
        />
      </label>
    );
  }
  return (
    <label className="mt-4 block max-w-sm">
      <span className="field-label">{copy.yourAnswer}</span>
      <input
        value={value}
        maxLength={question.type === "numeric" ? 40 : 1000}
        inputMode={question.type === "numeric" ? "decimal" : undefined}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.type === "numeric" ? copy.numberPlaceholder : copy.shortPlaceholder}
        className="input"
      />
    </label>
  );
}

type SaveState = "idle" | "saving" | "saved" | "failed";

/** BacII → Past papers → a paper → Mock exam (roadmap 2.4). */
export default function BaciiExam() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<ExamPaperDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [running, setRunning] = useState<ExamAttempt | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [handingIn, setHandingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState("");
  const pending = useRef(new Map<string, string>());
  const timer = useRef<number | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([getExamPaper(id), getMyExamAttempts(id)])
      .then(([loaded, attempts]) => {
        if (!active) return;
        setPaper(loaded);
        setRunning(attempts.find((attempt) => attempt.status === "in-progress") ?? null);
        document.title = `${copy.introTitle} · ${loaded.titleEn} · ${t.common.appName}`;
      })
      .catch(() => active && setMissing(true));
    return () => {
      active = false;
    };
  }, [id]);

  const official = Boolean(paper?.durationMinutes && paper.durationSource.trim());
  const remaining = deadline - (now + offset);
  const entries = paper?.questions ?? [];
  const answered = useMemo(() => entries.filter((entry) => (answers[entry.question.id] ?? "").trim()).length, [entries, answers]);

  /** Sends every unsaved answer; true when all of them were saved. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (!attemptId) return true;
    if (timer.current) window.clearTimeout(timer.current);
    const batch = [...pending.current.entries()];
    if (!batch.length) return true;
    setSaveState("saving");
    try {
      for (const [questionId, answer] of batch) {
        await saveExamAnswer(attemptId, questionId, answer);
        if (pending.current.get(questionId) === answer) pending.current.delete(questionId);
      }
      setSaveState("saved");
      return true;
    } catch (cause) {
      if (cause instanceof ApiError && /time is up|already finished/.test(cause.message)) {
        finished.current = true;
        navigate(`/bacii/attempts/${attemptId}`, { replace: true, state: { timeUp: true } });
        return false;
      }
      setSaveState("failed");
      timer.current = window.setTimeout(() => void flush(), 3000);
      return false;
    }
  }, [attemptId, navigate]);

  const handIn = useCallback(
    async (automatic: boolean) => {
      if (!attemptId || finished.current) return;
      if (!automatic && !window.confirm(copy.confirmHandIn(entries.length - answered))) return;
      finished.current = true;
      setHandingIn(true);
      // Anything still unsaved goes first, while there is time.
      if (!automatic) await flush();
      try {
        await submitExam(attemptId);
      } catch {
        // The server closes it anyway once the deadline passes.
      }
      navigate(`/bacii/attempts/${attemptId}`, { replace: true, state: { timeUp: automatic } });
    },
    [attemptId, entries.length, answered, flush, navigate],
  );

  // The clock; hand in automatically at zero.
  useEffect(() => {
    if (!attemptId) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [attemptId]);
  useEffect(() => {
    if (!attemptId) return;
    if (remaining <= 0) void handIn(true);
    else if (remaining <= 60_000) setWarning(copy.oneMinute);
    else if (remaining <= 5 * 60_000) setWarning(copy.fiveMinutes);
  }, [attemptId, remaining, handIn]);

  // Warn before leaving with an answer not yet saved.
  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (pending.current.size) event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const begin = async () => {
    if (!paper) return;
    setError(null);
    try {
      const started = await startExam(paper.id, minutes);
      const detail = await getExamAttempt(started.attemptId);
      if (detail.attempt.status !== "in-progress") {
        navigate(`/bacii/attempts/${started.attemptId}`, { replace: true });
        return;
      }
      setAnswers(Object.fromEntries(detail.answers.map((answer) => [answer.questionId, answer.answer])));
      setOffset(started.clockOffsetMs);
      setDeadline(Date.parse(started.deadlineAt));
      setNow(Date.now());
      setAttemptId(started.attemptId);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 400 ? cause.message : t.apiErrors.UNKNOWN);
    }
  };

  const answer = (questionId: string, value: string) => {
    setAnswers((all) => ({ ...all, [questionId]: value }));
    pending.current.set(questionId, value);
    setSaveState("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  if (missing) {
    return (
      <div className="container-page max-w-3xl py-16 text-center">
        <p className="text-ink-700">{copy.noPaper}</p>
      </div>
    );
  }
  if (!paper) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={2} variant="block" />
      </div>
    );
  }

  // ---- Before starting ----
  if (!attemptId) {
    const left = running ? Date.parse(running.deadlineAt) - Date.now() : 0;
    return (
      <div className="container-page max-w-2xl py-6 sm:py-8">
        <Link to={`/bacii/papers/${paper.id}`} className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
          <ArrowLeftIcon className="h-4 w-4" />
          {copy.backToPaper}
        </Link>
        <div className="card space-y-4 p-5 sm:p-6">
          <div>
            <p className="text-accent text-xs font-semibold tracking-wide uppercase">{copy.introTitle}</p>
            <h1 className="text-ink-900 mt-1 text-2xl">{paper.titleEn}</h1>
            <p className="text-ink-500 text-sm">
              {paper.titleEn} · {t.bacii.papers.questions(paper.questionCount)}
              {paper.totalPoints !== null && ` · ${t.bacii.papers.points(paper.totalPoints)}`}
            </p>
          </div>
          {official ? (
            <p className="text-ink-900 text-sm font-medium">{copy.timeOfficial(paper.durationMinutes!)}</p>
          ) : (
            !running && (
              <label className="block">
                <span className="field-label">{copy.practiceTime}</span>
                <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="input cursor-pointer sm:w-56">
                  {PRACTICE_MINUTES.map((value) => (
                    <option key={value} value={value}>
                      {copy.minutes(value)}
                    </option>
                  ))}
                </select>
                <span className="text-ink-500 mt-1 block text-xs">{copy.practiceTimeHint}</span>
              </label>
            )
          )}
          <ul className="text-ink-700 list-disc space-y-1 pl-5 text-sm">
            {copy.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="bg-danger-bg text-danger-fg rounded-md px-4 py-3 text-sm font-medium">
              {error}
            </p>
          )}
          <button type="button" onClick={begin} className="btn-primary w-full sm:w-auto sm:min-w-40">
            {running && left > 0 ? copy.resume(formatClock(left)) : copy.start}
          </button>
        </div>
      </div>
    );
  }

  // ---- Running ----
  const entry = entries[current];
  const low = remaining <= 5 * 60_000;
  return (
    <div className="container-page max-w-3xl pb-8">
      <div className="bg-surface-muted/95 border-line sticky top-14 z-30 -mx-4 mb-4 flex items-center gap-3 border-b px-4 py-2 backdrop-blur sm:top-16 sm:-mx-6 sm:px-6">
        <div role="timer" aria-label={copy.timeLeftAria(formatClock(remaining))} className={`font-display text-xl font-bold tabular-nums ${low ? "text-danger-fg" : "text-ink-900"}`}>
          {formatClock(remaining)}
        </div>
        <span role="status" className="text-ink-500 text-xs">
          {saveState === "saving" ? copy.saving : saveState === "saved" ? copy.saved : saveState === "failed" ? copy.notSaved : ""}
        </span>
        <button type="button" onClick={() => void handIn(false)} disabled={handingIn} className="btn-primary ml-auto h-9 px-4 text-sm">
          {handingIn ? copy.handingIn : copy.handIn}
        </button>
      </div>
      <p className="sr-only" aria-live="assertive">
        {warning}
      </p>

      <nav aria-label={copy.navigator} className="mb-4">
        <ol className="flex flex-wrap gap-2">
          {entries.map((item, index) => {
            const done = Boolean((answers[item.question.id] ?? "").trim());
            return (
              <li key={item.question.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(index)}
                  aria-current={index === current ? "step" : undefined}
                  aria-label={copy.goTo(index + 1, done)}
                  className={`press h-10 w-10 rounded-lg border text-sm font-bold ${
                    index === current
                      ? "border-brand-600 ring-brand-200 ring-2"
                      : "border-line"
                  } ${done ? "bg-brand-600 border-brand-600 text-white" : "bg-surface text-ink-700"}`}
                >
                  {index + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {entry && (
        <section className="card p-4 sm:p-5" aria-labelledby="exam-question">
          <h2 id="exam-question" className="font-display text-ink-900 mb-2 text-base font-bold">
            {t.bacii.papers.question(entry.position)}
            {entry.points !== null && <span className="text-ink-500 ml-2 text-xs font-normal">{t.bacii.papers.questionPoints(entry.points)}</span>}
          </h2>
          <MathText text={entry.question.content} className="text-ink-900 text-base" />
          {entry.question.images.map((image) => (
            <QuestionImage key={image.path} image={image} className="mt-3 max-h-64 w-full" />
          ))}
          <AnswerInput entry={entry} value={answers[entry.question.id] ?? ""} onChange={(value) => answer(entry.question.id, value)} />
          <div className="mt-5 flex justify-between gap-2">
            <button type="button" onClick={() => setCurrent((index) => index - 1)} disabled={current === 0} className="btn-secondary disabled:opacity-40">
              {copy.previous}
            </button>
            {current < entries.length - 1 ? (
              <button type="button" onClick={() => setCurrent((index) => index + 1)} className="btn-secondary">
                {copy.next}
              </button>
            ) : (
              <button type="button" onClick={() => void handIn(false)} disabled={handingIn} className="btn-primary">
                {copy.handIn}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
