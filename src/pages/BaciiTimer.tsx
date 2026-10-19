import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";
import MathText from "../components/MathText";
import examTimings from "../data/bacii/exam-timings.json";
import { t } from "../i18n/en";
import { crossedWarnings, elapsedMs, formatClock, isFinished, pauseTimer, readTimer, remainingMs, resumeTimer, startTimer, warningsFor, type TimerState } from "../lib/examTimer";
import { getExamPaper } from "../services/api";
import type { ExamPaperDetail } from "../types";

const copy = t.bacii.timer;
// The running timer and the last few papers, on this device only.
const TIMER_KEY = "meh-rean:exam-timer";
const HISTORY_KEY = "meh-rean:exam-timer-history";

type Subject = { id: string; nameEn: string; nameKm: string; minutes: number; points: number; elective?: boolean };
type Track = { id: string; nameEn: string; nameKm: string; subjects: Subject[] };
type HistoryItem = { subjectKey: string; usedMs: number; at: number; score?: number; points?: number; label?: string };
const tracks = examTimings.tracks as Track[];

const store = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage blocked: the timer still runs while the page is open.
    }
  },
};
const readHistory = (): HistoryItem[] => {
  try {
    const list = JSON.parse(store.get(HISTORY_KEY) ?? "[]") as HistoryItem[];
    return Array.isArray(list) ? list.slice(0, 10) : [];
  } catch {
    return [];
  }
};

function subjectOf(key: string): { subject: Subject | null; track: Track | null } {
  const [trackId, subjectId] = key.split(":");
  const track = tracks.find((item) => item.id === trackId) ?? null;
  return { track, subject: track?.subjects.find((item) => item.id === subjectId) ?? null };
}
const subjectName = (key: string) => {
  const { subject } = subjectOf(key);
  return subject ? `${subject.nameKm} · ${subject.nameEn}` : copy.custom;
};

// A real paper is timed as "paper:<id>"; its length and points come from the paper.
const PAPER_PREFIX = "paper:";
const paperIdOf = (key: string | undefined) => (key?.startsWith(PAPER_PREFIX) ? key.slice(PAPER_PREFIX.length) : null);
/** The paper's points, or the usual points for its track and subject when the copy gives none. */
function paperPoints(paper: ExamPaperDetail): number | undefined {
  if (paper.totalPoints !== null) return paper.totalPoints;
  const [, trackId, subjectKey] = /^kh-grade12-(science|social)-(.+)$/.exec(paper.subjectId) ?? [];
  // English and French papers share the foreign-language paper's length and points.
  const timingId = subjectKey === "english" || subjectKey === "french" ? "foreign-language" : subjectKey;
  return subjectOf(`${trackId}:${timingId}`).subject?.points;
}

/** A short beep, made in the browser (no sound files to download). */
function beep(context: AudioContext | null, times = 1) {
  if (!context) return;
  for (let i = 0; i < times; i++) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, context.currentTime + i * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + i * 0.6 + 0.45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + i * 0.6);
    oscillator.stop(context.currentTime + i * 0.6 + 0.5);
  }
}

/** BacII → Paper exam timer: the real paper length per subject, for a paper done on paper. */
export default function BaciiTimer() {
  const [params, setParams] = useSearchParams();
  const [trackId, setTrackId] = useState(tracks[0].id);
  const [subjectId, setSubjectId] = useState(tracks[0].subjects[0].id);
  const [customMinutes, setCustomMinutes] = useState(60);
  const [mode, setMode] = useState<TimerState["mode"]>("exam");
  const [timer, setTimer] = useState<TimerState | null>(() => readTimer(store.get(TIMER_KEY)));
  const [now, setNow] = useState(() => Date.now());
  const [alert, setAlert] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(readHistory);
  const [scoreText, setScoreText] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const lastRemaining = useRef<number | null>(null);
  const recorded = useRef(false);
  const [paper, setPaper] = useState<ExamPaperDetail | null>(null);
  const [paperFailed, setPaperFailed] = useState(false);
  const [showQuestions, setShowQuestions] = useState(true);
  // The running paper wins over the link, so a reload keeps the same paper.
  const paperId = paperIdOf(timer?.subjectKey) ?? (timer ? null : params.get("paper"));

  useEffect(() => {
    if (!paperId) {
      setPaper(null);
      return;
    }
    let active = true;
    setPaperFailed(false);
    getExamPaper(paperId)
      .then((loaded) => active && setPaper(loaded))
      .catch(() => active && setPaperFailed(true));
    return () => {
      active = false;
    };
  }, [paperId]);
  const timedPaper = paper && paper.id === paperId ? paper : null;

  const track = tracks.find((item) => item.id === trackId)!;
  const chosen = subjectId === "custom" ? null : track.subjects.find((item) => item.id === subjectId) ?? null;
  const running = timer && !isFinished(timer, now);

  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
  }, []);
  useEffect(() => store.set(TIMER_KEY, timer ? JSON.stringify(timer) : null), [timer]);

  // Tick from the wall clock; the tab title shows the time too.
  useEffect(() => {
    if (!timer) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [timer]);

  const left = timer ? remainingMs(timer, now) : 0;
  useEffect(() => {
    if (!timer) return;
    document.title = isFinished(timer, now) ? `${copy.timeUp} · ${t.common.appName}` : `${formatClock(left)} · ${timedPaper ? timedPaper.titleKm : subjectName(timer.subjectKey)}`;
    const warnings = warningsFor(timer.minutes, examTimings.warningsMinutes);
    if (lastRemaining.current !== null && timer.pausedAt === null) {
      const crossed = crossedWarnings(lastRemaining.current, left, warnings);
      if (left === 0 && lastRemaining.current > 0) {
        setAlert(copy.timeUp);
        beep(audio.current, 3);
        navigator.vibrate?.([400, 200, 400, 200, 400]);
      } else if (crossed.length) {
        setAlert(`${copy.warning(crossed.at(-1)!)} · ${copy.warningKm(crossed.at(-1)!)}`);
        beep(audio.current);
        navigator.vibrate?.(300);
      }
    }
    lastRemaining.current = left;
  }, [timer, now, left, timedPaper]);

  // Keep the screen on while a timer runs, where the browser allows it.
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => (lock = sentinel))
        .catch(() => {});
    request();
    const again = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => {});
    };
  }, [running]);

  // A finished sitting goes into this device's list once.
  useEffect(() => {
    if (!timer || !isFinished(timer, now) || recorded.current) return;
    recorded.current = true;
    const item: HistoryItem = { subjectKey: timer.subjectKey, usedMs: elapsedMs(timer, now), at: Date.now(), ...(timedPaper && { label: timedPaper.titleKm }) };
    const list = [item, ...readHistory()].slice(0, 10);
    store.set(HISTORY_KEY, JSON.stringify(list));
    setHistory(list);
  }, [timer, now, timedPaper]);

  const start = (event: FormEvent) => {
    event.preventDefault();
    const forPaper = paperId && timedPaper?.durationMinutes ? timedPaper : null;
    const minutes = forPaper ? forPaper.durationMinutes! : chosen ? chosen.minutes : Math.round(customMinutes);
    if (!(minutes >= examTimings.customMinutes.min && minutes <= examTimings.customMinutes.max)) return;
    // Sound needs a tap to be allowed: the Start tap unlocks it.
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    } catch {
      audio.current = null;
    }
    recorded.current = false;
    lastRemaining.current = null;
    setAlert(null);
    setSaved(null);
    setScoreText("");
    setTimer(startTimer(forPaper ? `${PAPER_PREFIX}${forPaper.id}` : chosen ? `${trackId}:${chosen.id}` : "custom", minutes, mode, Date.now()));
  };
  const finishEarly = () => {
    if (!timer || !window.confirm(copy.finishConfirm)) return;
    // Ends the sitting now: the time used is what was spent.
    const used = elapsedMs(timer, Date.now());
    setTimer({ ...timer, minutes: used / 60_000, pausedAt: null, pausedMs: 0, startedAt: Date.now() - used });
  };
  const reset = useCallback(() => {
    setTimer(null);
    setAlert(null);
    setSaved(null);
    // "Another paper": back to choosing, not the same paper again.
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("paper");
        return next;
      },
      { replace: true },
    );
    document.title = `${copy.title} · ${t.common.appName}`;
  }, [setParams]);
  const saveScore = (event: FormEvent) => {
    event.preventDefault();
    const points = timedPoints;
    const score = Number(scoreText.replace(",", "."));
    if (!points || !Number.isFinite(score) || score < 0 || score > points) return;
    const list = readHistory();
    if (list[0]) list[0] = { ...list[0], score, points };
    store.set(HISTORY_KEY, JSON.stringify(list));
    setHistory(list);
    setSaved(copy.scoreSaved(score, points, Math.round((score / points) * 100)));
  };

  const progress = timer ? Math.min(100, (elapsedMs(timer, now) / (timer.minutes * 60_000)) * 100) : 0;
  const endsAt = useMemo(() => (timer && timer.pausedAt === null ? new Date(now + left).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : null), [timer, now, left]);
  const timedSubject = timer ? subjectOf(timer.subjectKey).subject : null;
  const timedPoints = timedPaper ? paperPoints(timedPaper) : timedSubject?.points;
  const timedName = timer ? (timedPaper ? timedPaper.titleKm : paperIdOf(timer.subjectKey) ? copy.paper.loading : subjectName(timer.subjectKey)) : "";
  const leavePaper = () =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("paper");
        return next;
      },
      { replace: true },
    );

  const modeFieldset = (
    <fieldset>
      <legend className="text-ink-900 mb-2 text-sm font-bold">{copy.mode}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["exam", "practice"] as const).map((value) => (
          <label key={value} className={`press cursor-pointer rounded-lg border p-3 has-[:focus-visible]:outline-2 ${mode === value ? "border-brand-600 bg-brand-50" : "border-line hover:border-ink-400"}`}>
            <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
            <span className="text-ink-900 block text-sm font-semibold">{copy.modes[value].name}</span>
            <span className="text-ink-500 block text-xs">{copy.modes[value].hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
  const historySection = history.length > 0 && (
    <section className="mt-6" aria-labelledby="timer-history">
      <h2 id="timer-history" className="text-ink-900 mb-2 text-sm font-bold">
        {copy.historyTitle}
      </h2>
      <ul className="card divide-line divide-y text-sm">
        {history.map((item) => (
          <li key={item.at} className="text-ink-700 px-4 py-2">
            {copy.historyLine(item.label ?? subjectName(item.subjectKey), formatClock(item.usedMs), item.score !== undefined && item.points ? `${item.score} / ${item.points}` : "")}
          </li>
        ))}
      </ul>
    </section>
  );
  // A link to a paper with no printed length falls back to choosing a subject.
  const paperSetup = Boolean(paperId && !paperFailed && (!timedPaper || timedPaper.durationMinutes));

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">
        {copy.title} <span className="text-ink-500 text-base font-normal" lang="km">{`· ${copy.titleKm}`}</span>
      </h1>

      {!timer && paperSetup ? (
        !timedPaper ? (
          <p className="text-ink-500 mt-4 text-sm">{copy.paper.loading}</p>
        ) : (
          <>
            <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.paper.intro}</p>
            <section className="card mb-5 p-4" aria-labelledby="timer-paper">
              <p className="text-ink-500 text-xs font-semibold tracking-wide uppercase">{copy.paper.label}</p>
              <h2 id="timer-paper" className="text-ink-900 mt-1 text-lg font-bold" lang="km">
                {timedPaper.titleKm}
              </h2>
              <p className="text-ink-500 text-sm">{timedPaper.titleEn}</p>
              <p className="text-ink-900 mt-2 text-sm font-semibold">
                {copy.paper.length(timedPaper.durationMinutes!)}
                {paperPoints(timedPaper) !== undefined && ` · ${copy.points(paperPoints(timedPaper)!)}`}
                {` · ${t.bacii.papers.questions(timedPaper.questionCount)}`}
              </p>
            </section>
            <form onSubmit={start} className="space-y-5">
              {modeFieldset}
              <div>
                <button type="submit" className="btn-primary">
                  {`${copy.start} · ${copy.minutes(timedPaper.durationMinutes!)}`}
                </button>
                <p className="text-ink-500 mt-1.5 text-xs">{copy.paper.startHint}</p>
              </div>
            </form>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link to={`/bacii/papers/${timedPaper.id}`} className="link">
                {copy.paper.back}
              </Link>
              <button type="button" onClick={leavePaper} className="link">
                {copy.paper.other}
              </button>
            </p>
            {historySection}
          </>
        )
      ) : !timer ? (
        <>
          {paperFailed && (
            <p role="alert" className="bg-ribbon-50 text-ribbon-fg mt-3 rounded-md px-4 py-3 text-sm">
              {copy.paper.missing}
            </p>
          )}
          <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.intro}</p>
          <form onSubmit={start} className="space-y-5">
            <fieldset>
              <legend className="text-ink-900 mb-2 text-sm font-bold">{copy.track}</legend>
              <div className="flex flex-wrap gap-2">
                {tracks.map((item) => (
                  <label key={item.id} className={`press cursor-pointer rounded-full border px-4 py-2 text-sm font-medium has-[:focus-visible]:outline-2 ${trackId === item.id ? "border-brand-600 bg-brand-600 text-white" : "border-line text-ink-700 hover:border-ink-400"}`}>
                    <input
                      type="radio"
                      name="track"
                      value={item.id}
                      checked={trackId === item.id}
                      onChange={() => {
                        setTrackId(item.id);
                        if (subjectId !== "custom") setSubjectId(item.subjects[0].id);
                      }}
                      className="sr-only"
                    />
                    <span lang="km">{item.nameKm}</span> · {item.nameEn}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-ink-900 mb-2 text-sm font-bold">{copy.subject}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {track.subjects.map((item) => (
                  <label key={item.id} className={`press flex cursor-pointer items-center gap-3 rounded-lg border p-3 has-[:focus-visible]:outline-2 ${subjectId === item.id ? "border-brand-600 bg-brand-50" : "border-line hover:border-ink-400"}`}>
                    <input type="radio" name="subject" value={item.id} checked={subjectId === item.id} onChange={() => setSubjectId(item.id)} className="sr-only" />
                    <span className="min-w-0 flex-1">
                      <span className="text-ink-900 block text-sm font-medium" lang="km">
                        {item.nameKm}
                      </span>
                      <span className="text-ink-500 block text-xs">{item.nameEn}</span>
                    </span>
                    <span className="text-right">
                      <span className="font-display text-ink-900 block text-sm font-bold tabular-nums">{copy.minutes(item.minutes)}</span>
                      <span className="text-ink-500 block text-[11px]">{copy.points(item.points)}</span>
                    </span>
                  </label>
                ))}
                <label className={`press flex cursor-pointer flex-wrap items-center gap-3 rounded-lg border p-3 has-[:focus-visible]:outline-2 ${subjectId === "custom" ? "border-brand-600 bg-brand-50" : "border-line hover:border-ink-400"}`}>
                  <input type="radio" name="subject" value="custom" checked={subjectId === "custom"} onChange={() => setSubjectId("custom")} className="sr-only" />
                  <span className="text-ink-900 min-w-0 flex-1 text-sm font-medium">{copy.custom}</span>
                  {subjectId === "custom" && (
                    <span className="flex items-center gap-1.5 text-sm">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={examTimings.customMinutes.min}
                        max={examTimings.customMinutes.max}
                        value={customMinutes}
                        onChange={(event) => setCustomMinutes(Number(event.target.value))}
                        aria-label={copy.customMinutes}
                        className="input h-9 w-20 text-sm"
                      />
                      {copy.customMinutes}
                    </span>
                  )}
                </label>
              </div>
            </fieldset>

            {modeFieldset}

            <div>
              <button type="submit" className="btn-primary">
                {copy.start}
                {chosen ? ` · ${copy.minutes(chosen.minutes)}` : ""}
              </button>
              <p className="text-ink-500 mt-1.5 text-xs">{copy.startHint}</p>
            </div>
          </form>

          <details className="card mt-6 p-4 text-sm">
            <summary className="text-ink-900 cursor-pointer font-semibold">{copy.timingsTitle}</summary>
            <p className="text-ink-700 mt-2">{copy.timingsNote}</p>
            <ul className="text-ink-500 mt-2 list-disc space-y-1 pl-5 text-xs">
              {examTimings.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {source.title}
                  </a>{" "}
                  ({source.year})
                </li>
              ))}
            </ul>
          </details>

          {historySection}
        </>
      ) : (
        <section className="card mt-4 p-5 text-center sm:p-8" aria-labelledby="timer-subject">
          <h2 id="timer-subject" className="text-ink-900 text-lg font-bold" lang="km">
            {timedName}
          </h2>
          <p className="text-ink-500 text-xs">{copy.modes[timer.mode].name}</p>
          <p role="timer" aria-live="off" className={`font-display mt-4 text-6xl font-bold tabular-nums sm:text-8xl ${left === 0 ? "text-danger-fg" : left <= 5 * 60_000 ? "text-ribbon-fg" : "text-ink-900"}`} data-testid="timer-clock">
            {formatClock(left)}
          </p>
          <p className="text-ink-500 text-sm">{left > 0 ? (timer.pausedAt !== null ? copy.paused : endsAt ? copy.endsAt(endsAt) : copy.left) : copy.used(formatClock(elapsedMs(timer, now)))}</p>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label={copy.left} className="bg-surface-hover mx-auto mt-4 h-2 max-w-md overflow-hidden rounded-full">
            <div className="bg-brand-600 h-full" style={{ width: `${progress}%` }} />
          </div>

          {alert && (
            <p role="alert" className={`mt-4 rounded-md px-3 py-2 text-base font-bold ${left === 0 ? "bg-danger-bg text-danger-fg" : "bg-ribbon-50 text-ribbon-fg"}`}>
              {alert}
              {left === 0 && (
                <span className="block text-sm font-normal" lang="km">
                  {copy.timeUpKm}
                </span>
              )}
            </p>
          )}

          {left > 0 ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {timer.mode === "practice" &&
                (timer.pausedAt === null ? (
                  <button type="button" onClick={() => setTimer(pauseTimer(timer, Date.now()))} className="btn-secondary">
                    {copy.pause}
                  </button>
                ) : (
                  <button type="button" onClick={() => setTimer(resumeTimer(timer, Date.now()))} className="btn-primary">
                    {copy.resume}
                  </button>
                ))}
              <button type="button" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})} className="btn-secondary">
                {copy.fullScreen}
              </button>
              <button type="button" onClick={finishEarly} className="btn-ghost">
                {copy.finishEarly}
              </button>
            </div>
          ) : (
            <div className="mx-auto mt-5 max-w-sm text-left">
              {timedPoints !== undefined && (
                <form onSubmit={saveScore} className="space-y-2">
                  <h3 className="text-ink-900 text-sm font-bold">{copy.scoreTitle}</h3>
                  <label className="text-ink-700 block text-sm">
                    {copy.scoreLabel(timedPoints)}
                    <span className="mt-1 flex gap-2">
                      <input value={scoreText} onChange={(event) => setScoreText(event.target.value)} inputMode="decimal" className="input h-9 w-24" />
                      <button type="submit" className="btn-secondary h-9 px-3 text-sm">
                        {copy.saveScore}
                      </button>
                    </span>
                  </label>
                  {saved && (
                    <p role="status" className="text-accent text-sm font-medium">
                      {saved}
                    </p>
                  )}
                </form>
              )}
              {timedPaper && (
                <Link to={`/bacii/papers/${timedPaper.id}`} className="btn-secondary mt-4 w-full">
                  {copy.paper.back}
                </Link>
              )}
              <button type="button" onClick={reset} className="btn-primary mt-4 w-full">
                {copy.another}
              </button>
            </div>
          )}
          {left > 0 && <p className="text-ink-500 mt-4 text-xs">{timer.mode === "exam" ? copy.noPause : ""} {copy.keepAwake}</p>}
        </section>
      )}

      {timer && timedPaper && (
        <section className="mt-5" aria-labelledby="timer-questions">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="timer-questions" className="text-ink-900 text-sm font-bold">
              {copy.paper.questionsTitle}
            </h2>
            <button type="button" onClick={() => setShowQuestions((shown) => !shown)} className="btn-ghost h-8 px-2 text-sm" aria-expanded={showQuestions} aria-controls="timer-question-list">
              {showQuestions ? copy.paper.hide : copy.paper.show}
            </button>
          </div>
          {showQuestions && (
            <ol id="timer-question-list" className="space-y-3">
              {timedPaper.questions.map((entry) => (
                <li key={entry.question.id} className="card p-4">
                  <p className="text-ink-900 mb-1 text-sm font-bold">
                    {t.bacii.papers.question(entry.position)}
                    {entry.points !== null && <span className="text-ink-500 font-normal">{` · ${t.bacii.papers.questionPoints(entry.points)}`}</span>}
                  </p>
                  <MathText text={entry.question.content} className="text-ink-900 text-base" />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
