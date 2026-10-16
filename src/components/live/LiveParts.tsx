import { useEffect, useState } from "react";
import { t } from "../../i18n/en";
import { rankPlayers, remainingMs } from "../../lib/liveQuiz";
import type { LivePlayer } from "../../types";
import MathText from "../MathText";

const copy = t.bacii.live;

/** Four answer colours and shapes, so colour is never the only cue. */
export const CHOICE_STYLES = [
  { letter: "A", shape: "▲", className: "bg-red-600 text-white" },
  { letter: "B", shape: "◆", className: "bg-blue-600 text-white" },
  { letter: "C", shape: "●", className: "bg-amber-500 text-black" },
  { letter: "D", shape: "■", className: "bg-green-600 text-white" },
] as const;

/** Re-renders a few times a second while a countdown runs. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/** The big countdown: a number and a shrinking bar. */
export function Countdown({ deadlineAt, seconds, clockOffsetMs, now }: { deadlineAt: string | null; seconds: number | null; clockOffsetMs: number; now: number }) {
  const left = remainingMs(deadlineAt, clockOffsetMs, now);
  const total = (seconds ?? 1) * 1000;
  const shown = Math.ceil(left / 1000);
  const low = shown <= 5;
  return (
    <div role="timer" aria-label={copy.secondsLeft(shown)} className="flex items-center gap-3">
      <span className={`font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-bold tabular-nums ${low ? "bg-danger-bg text-danger-fg" : "bg-brand-50 text-accent"}`}>
        {shown}
      </span>
      <span className="bg-surface-hover h-2 flex-1 overflow-hidden rounded-full" aria-hidden>
        <span className={`block h-full rounded-full transition-[width] duration-200 ${low ? "bg-danger-fg" : "bg-brand-600"}`} style={{ width: `${(left / total) * 100}%` }} />
      </span>
    </div>
  );
}

/** The question text, as large as a phone allows. */
export function QuestionText({ prompt }: { prompt: string | null }) {
  return <MathText text={prompt ?? ""} className="text-ink-900 text-xl leading-snug font-semibold sm:text-2xl" />;
}

/** Answers with counts after the reveal; the right one stands out. */
export function RevealedChoices({ choices, correct, counts, mine }: { choices: string[]; correct: number | null; counts: number[] | null; mine?: number | null }) {
  const most = Math.max(1, ...(counts ?? [0]));
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {choices.map((choice, index) => {
        const style = CHOICE_STYLES[index];
        const right = index === correct;
        return (
          <li key={index} className={`rounded-xl p-3 ${style.className} ${right ? "ring-4 ring-offset-2 ring-brand-500 ring-offset-surface" : "opacity-60"}`}>
            <div className="flex items-start gap-2">
              <span aria-hidden className="text-lg leading-none">{style.shape}</span>
              <MathText text={choice} as="span" className="min-w-0 flex-1 font-semibold" />
              {right && <span className="text-sm font-bold">✓</span>}
            </div>
            {counts && (
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/20">
                  <span className="block h-full rounded-full bg-white/90" style={{ width: `${((counts[index] ?? 0) / most) * 100}%` }} />
                </span>
                <span className="tabular-nums">{copy.countLabel(counts[index] ?? 0)}</span>
              </div>
            )}
            {mine === index && <p className="mt-1 text-xs font-semibold">← {t.bacii.exam.yourAnswer}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function Leaderboard({ players, highlight, limit = 10 }: { players: LivePlayer[]; highlight?: string; limit?: number }) {
  const ranked = rankPlayers(players).slice(0, limit);
  return (
    <section aria-labelledby="live-leaderboard" className="card p-4">
      <h2 id="live-leaderboard" className="font-display text-ink-900 mb-2 text-lg font-bold">
        {copy.leaderboard}
      </h2>
      <ol className="space-y-1.5">
        {ranked.map((player, index) => (
          <li
            key={player.playerId}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${player.playerId === highlight ? "bg-brand-50 text-ink-900 font-semibold" : "text-ink-700"}`}
          >
            <span className="text-ink-500 w-6 font-bold tabular-nums">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate">{player.nickname}</span>
            {player.lastPoints > 0 && <span className="text-accent text-xs font-semibold">{copy.points(player.lastPoints)}</span>}
            <span className="font-semibold tabular-nums">{player.score}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
