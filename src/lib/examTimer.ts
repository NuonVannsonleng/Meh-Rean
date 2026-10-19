// The paper exam timer (BacII): a countdown for a paper done on paper, with
// the length of the real BacII paper (src/data/bacii/exam-timings.json).
// Worked out from the wall clock, so a reload, a sleeping phone or a closed
// tab never loses time. Exam mode cannot pause, like the real exam.

export interface TimerState {
  /** "track:subject", or "custom". */
  subjectKey: string;
  minutes: number;
  mode: "exam" | "practice";
  startedAt: number;
  /** Set while paused (practice only). */
  pausedAt: number | null;
  /** Time spent paused before the current pause. */
  pausedMs: number;
}

const MINUTE = 60_000;

export function startTimer(subjectKey: string, minutes: number, mode: TimerState["mode"], now: number): TimerState {
  return { subjectKey, minutes, mode, startedAt: now, pausedAt: null, pausedMs: 0 };
}

/** Time spent on the paper so far, without pauses, and never more than its length. */
export function elapsedMs(state: TimerState, now: number): number {
  return Math.min(state.minutes * MINUTE, Math.max(0, (state.pausedAt ?? now) - state.startedAt - state.pausedMs));
}

export function remainingMs(state: TimerState, now: number): number {
  return Math.max(0, state.minutes * MINUTE - elapsedMs(state, now));
}

export const isFinished = (state: TimerState, now: number) => remainingMs(state, now) === 0;

/** Only practice timers pause; pausing a finished or paused timer changes nothing. */
export function pauseTimer(state: TimerState, now: number): TimerState {
  if (state.mode !== "practice" || state.pausedAt !== null || isFinished(state, now)) return state;
  return { ...state, pausedAt: now };
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.pausedAt === null) return state;
  return { ...state, pausedMs: state.pausedMs + (now - state.pausedAt), pausedAt: null };
}

/** The warnings (minutes left) that apply to a paper of this length: only those shorter than it. */
export const warningsFor = (minutes: number, warnings: number[]) => warnings.filter((left) => left < minutes).sort((a, b) => b - a);

/** Warnings passed between two readings of the time left — each fires once, even after a long sleep. */
export function crossedWarnings(previousMs: number, currentMs: number, warnings: number[]): number[] {
  return warnings.filter((left) => previousMs > left * MINUTE && currentMs <= left * MINUTE);
}

/** 2:30:00 for 150 minutes; 59:59 under an hour. */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

/** A saved timer, read back safely (anything odd is dropped). */
export function readTimer(raw: string | null): TimerState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TimerState>;
    const ok =
      typeof value.subjectKey === "string" &&
      typeof value.minutes === "number" && value.minutes > 0 && value.minutes <= 600 &&
      (value.mode === "exam" || value.mode === "practice") &&
      typeof value.startedAt === "number" &&
      (value.pausedAt === null || typeof value.pausedAt === "number") &&
      typeof value.pausedMs === "number" && value.pausedMs >= 0;
    return ok ? (value as TimerState) : null;
  } catch {
    return null;
  }
}
