import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Countdown, Leaderboard, QuestionText, RevealedChoices, useNow, CHOICE_STYLES } from "../../components/live/LiveParts";
import LoadingState from "../../components/LoadingState";
import MathText from "../../components/MathText";
import { t } from "../../i18n/en";
import { rankPlayers, remainingMs } from "../../lib/liveQuiz";
import { liveFinish, liveNext, liveReveal } from "../../services/api";
import { useLiveGame } from "./useLiveGame";

const copy = t.bacii.live;

/** The host's screen (for a projector or a shared phone): code, questions, timer, answers, scores. */
export default function LiveHost() {
  const { id = "" } = useParams();
  const { game, missing, refresh } = useLiveGame(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revealing = useRef(-1);
  const now = useNow(game?.state.status === "question");

  useEffect(() => {
    if (game) document.title = `${game.state.title} · ${copy.title} · ${t.common.appName}`;
  }, [game]);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  };

  // Reveal on its own when time is up or everyone has answered.
  const state = game?.state;
  const timeUp = state?.status === "question" && remainingMs(state.deadlineAt, game!.clockOffsetMs, now) === 0;
  const allIn = state?.status === "question" && game!.players.length > 0 && state.answered >= game!.players.length;
  useEffect(() => {
    if (!state || state.status !== "question" || !(timeUp || allIn) || revealing.current === state.questionIndex) return;
    revealing.current = state.questionIndex;
    void act(() => liveReveal(id));
  }, [timeUp, allIn, state?.status, state?.questionIndex]);

  if (missing) {
    return (
      <div className="container-page max-w-3xl py-16 text-center">
        <p className="text-ink-700">{copy.notFound}</p>
      </div>
    );
  }
  if (!game || !state) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={2} variant="block" />
      </div>
    );
  }
  if (!game.isHost) {
    return <Navigate to={`/live/play/${id}`} replace />;
  }

  const joinUrl = `${window.location.origin}/live?code=${state.code}`;
  const ended = state.status === "finished";
  const last = state.questionIndex + 1 >= state.questionCount;

  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-ink-900 min-w-0 flex-1 truncate text-xl sm:text-2xl">{state.title}</h1>
        {!ended && (
          <button
            type="button"
            onClick={() => window.confirm(copy.endConfirm) && void act(() => liveFinish(id))}
            disabled={busy}
            className="btn-ghost h-9 px-3 text-sm"
          >
            {copy.endGame}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-danger-fg mb-3 text-sm font-medium">
          {error}
        </p>
      )}

      {state.status === "lobby" && (
        <section className="card p-5 text-center sm:p-8" aria-labelledby="lobby-title">
          <p className="text-ink-500 text-sm">
            {copy.lobby.joinAt} <span className="text-ink-900 font-semibold break-all">{joinUrl.replace(/^https?:\/\//, "").replace(/\?code=.*$/, "")}</span>
          </p>
          <p id="lobby-title" className="text-ink-500 mt-4 text-xs font-semibold tracking-wide uppercase">
            {copy.lobby.code}
          </p>
          <p className="font-display text-ink-900 mt-1 text-5xl font-bold tracking-[0.2em] tabular-nums sm:text-7xl" data-testid="live-code">
            {state.code}
          </p>
          <p className="text-ink-700 mt-5 text-sm font-medium" aria-live="polite">
            {copy.lobby.waiting(game.players.length)}
          </p>
          {game.players.length > 0 && (
            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {game.players.map((player) => (
                <li key={player.playerId} className="bg-brand-50 text-accent rounded-full px-3 py-1 text-sm font-semibold">
                  {player.nickname}
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => void act(() => liveNext(id))} disabled={busy} className="btn-primary mt-6 h-12 px-8 text-base">
            {copy.lobby.start}
          </button>
          <p className="text-ink-500 mt-3 text-xs">{copy.scoringNote}</p>
        </section>
      )}

      {(state.status === "question" || state.status === "reveal") && (
        <section className="space-y-4" aria-labelledby="host-question">
          <p id="host-question" className="text-ink-500 text-sm font-semibold">
            {copy.questionOf(state.questionIndex + 1, state.questionCount)}
          </p>
          <QuestionText prompt={state.prompt} />
          {state.status === "question" ? (
            <>
              <Countdown deadlineAt={state.deadlineAt} seconds={state.seconds} clockOffsetMs={game.clockOffsetMs} now={now} />
              <ul className="grid gap-2 sm:grid-cols-2">
                {(state.choices ?? []).map((choice, index) => (
                  <li key={index} className={`flex items-start gap-2 rounded-xl p-4 text-lg font-semibold ${CHOICE_STYLES[index].className}`}>
                    <span aria-hidden>{CHOICE_STYLES[index].shape}</span>
                    <MathText text={choice} as="span" className="min-w-0" />
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-ink-700 text-sm font-medium" aria-live="polite">
                  {copy.answeredCount(state.answered, game.players.length)}
                </p>
                <button type="button" onClick={() => void act(() => liveReveal(id))} disabled={busy} className="btn-secondary">
                  {copy.showAnswer}
                </button>
              </div>
            </>
          ) : (
            <>
              <RevealedChoices choices={state.choices ?? []} correct={state.correctChoice} counts={state.choiceCounts} />
              <div className="flex justify-end">
                <button type="button" onClick={() => void act(() => liveNext(id))} disabled={busy} className="btn-primary h-11 px-6">
                  {last ? copy.results : copy.next}
                </button>
              </div>
              <Leaderboard players={game.players} limit={5} />
            </>
          )}
        </section>
      )}

      {ended && (
        <section className="space-y-4" aria-labelledby="final-title">
          <h2 id="final-title" className="font-display text-ink-900 text-2xl font-bold">
            {copy.finalTitle}
          </h2>
          {rankPlayers(game.players).length > 0 && (
            <ol className="grid gap-2 sm:grid-cols-3">
              {rankPlayers(game.players)
                .slice(0, 3)
                .map((player, index) => (
                  <li key={player.playerId} className={`card p-4 text-center ${index === 0 ? "border-brand-500" : ""}`}>
                    <p className="text-3xl" aria-hidden>
                      {["🥇", "🥈", "🥉"][index]}
                    </p>
                    <p className="text-ink-900 mt-1 truncate font-semibold">{player.nickname}</p>
                    <p className="text-ink-500 text-sm tabular-nums">{copy.score(player.score)}</p>
                  </li>
                ))}
            </ol>
          )}
          <Leaderboard players={game.players} limit={50} />
          <Link to="/live" className="btn-secondary">
            {copy.backToQuizzes}
          </Link>
        </section>
      )}
    </div>
  );
}
