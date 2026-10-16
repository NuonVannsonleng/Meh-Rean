import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CHOICE_STYLES, Countdown, Leaderboard, QuestionText, RevealedChoices, useNow } from "../../components/live/LiveParts";
import LoadingState from "../../components/LoadingState";
import MathText from "../../components/MathText";
import { t } from "../../i18n/en";
import { rankPlayers, remainingMs } from "../../lib/liveQuiz";
import { answerLive } from "../../services/api";
import type { LiveAnswerResult } from "../../types";
import { useLiveGame } from "./useLiveGame";

const copy = t.bacii.live;

/** A player's phone: wait in the lobby, answer against the clock, see how it went. */
export default function LivePlay() {
  const { id = "" } = useParams();
  const { game, missing, refresh } = useLiveGame(id);
  // This phone's answer to the current question, before the server echoes it back.
  const [picked, setPicked] = useState<{ index: number; choice: number; result: LiveAnswerResult | "sending" } | null>(null);
  const now = useNow(game?.state.status === "question");

  useEffect(() => {
    if (game) document.title = `${game.state.title} · ${copy.title} · ${t.common.appName}`;
  }, [game]);

  if (missing) {
    return (
      <div className="container-page max-w-3xl py-16 text-center">
        <p className="text-ink-700">{copy.notFound}</p>
        <Link to="/live" className="btn-secondary mt-4">
          {copy.playAgain}
        </Link>
      </div>
    );
  }
  if (!game) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={2} variant="block" />
      </div>
    );
  }
  if (game.isHost) {
    return <Navigate to={`/live/host/${id}`} replace />;
  }

  const { state } = game;
  const me = game.players.find((player) => player.playerId === game.myPlayerId);
  const ranked = rankPlayers(game.players);
  const rank = ranked.findIndex((player) => player.playerId === game.myPlayerId) + 1;
  const mine = picked?.index === state.questionIndex ? picked : null;
  const myChoice = game.myChoice ?? (mine && mine.result !== "late" ? mine.choice : null);
  const timeLeft = remainingMs(state.deadlineAt, game.clockOffsetMs, now);

  const answer = async (choice: number) => {
    if (myChoice !== null || mine) return;
    setPicked({ index: state.questionIndex, choice, result: "sending" });
    try {
      const result = await answerLive(id, choice);
      setPicked({ index: state.questionIndex, choice, result });
    } catch {
      setPicked(null);
    }
    refresh();
  };

  return (
    <div className="container-page max-w-3xl py-5 sm:py-8">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-ink-900 min-w-0 flex-1 truncate text-lg sm:text-xl">{state.title}</h1>
        {me && (
          <span className="bg-surface-hover text-ink-700 shrink-0 rounded-full px-3 py-1 text-xs font-semibold tabular-nums">
            {me.nickname} · {me.score}
          </span>
        )}
      </div>

      {state.status === "lobby" && (
        <section className="card p-6 text-center" aria-live="polite">
          <p className="font-display text-ink-900 text-2xl font-bold">{copy.lobby.youAreIn}</p>
          {me && <p className="text-ink-700 mt-1 text-sm">{copy.lobby.playingAs(me.nickname)}</p>}
          <p className="text-ink-500 mt-4 text-sm">{copy.lobby.waitHost}</p>
          <p className="text-ink-500 mt-1 text-xs">{copy.lobby.waiting(game.players.length)}</p>
        </section>
      )}

      {state.status === "question" && (
        <section className="space-y-4" aria-labelledby="play-question">
          <p id="play-question" className="text-ink-500 text-sm font-semibold">
            {copy.questionOf(state.questionIndex + 1, state.questionCount)}
          </p>
          <Countdown deadlineAt={state.deadlineAt} seconds={state.seconds} clockOffsetMs={game.clockOffsetMs} now={now} />
          <QuestionText prompt={state.prompt} />
          {myChoice !== null || mine ? (
            <p role="status" className="bg-brand-50 text-accent rounded-xl px-4 py-6 text-center text-base font-semibold">
              {mine?.result === "late" ? copy.tooLate : copy.locked}
            </p>
          ) : timeLeft === 0 ? (
            <p role="status" className="bg-surface-hover text-ink-700 rounded-xl px-4 py-6 text-center text-base font-semibold">
              {copy.timeUp}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(state.choices ?? []).map((choice, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => void answer(index)}
                  aria-label={copy.choiceLabel(CHOICE_STYLES[index].letter, choice)}
                  className={`press flex min-h-20 items-center gap-3 rounded-xl p-4 text-left text-lg font-semibold ${CHOICE_STYLES[index].className}`}
                >
                  <span aria-hidden className="text-2xl">
                    {CHOICE_STYLES[index].shape}
                  </span>
                  <MathText text={choice} as="span" className="min-w-0" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {state.status === "reveal" && (
        <section className="space-y-4" aria-labelledby="play-reveal">
          <div
            id="play-reveal"
            role="status"
            className={`rounded-xl px-4 py-5 text-center ${
              myChoice === null ? "bg-surface-hover text-ink-700" : myChoice === state.correctChoice ? "bg-green-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            <p className="font-display text-2xl font-bold">{myChoice === null ? copy.noAnswer : myChoice === state.correctChoice ? copy.correct : copy.wrong}</p>
            {me && myChoice === state.correctChoice && <p className="mt-1 text-lg font-semibold">{copy.points(me.lastPoints)}</p>}
            {rank > 0 && <p className="mt-1 text-sm opacity-90">{copy.rank(rank, ranked.length)}</p>}
          </div>
          <QuestionText prompt={state.prompt} />
          <RevealedChoices choices={state.choices ?? []} correct={state.correctChoice} counts={state.choiceCounts} mine={myChoice} />
        </section>
      )}

      {state.status === "finished" && (
        <section className="space-y-4" aria-labelledby="play-final">
          <div className="card p-6 text-center">
            <h2 id="play-final" className="font-display text-ink-900 text-2xl font-bold">
              {copy.finalTitle}
            </h2>
            {rank > 0 && <p className="text-accent mt-2 text-xl font-bold">{copy.youFinished(rank)}</p>}
            {me && <p className="text-ink-700 mt-1 text-sm">{copy.score(me.score)}</p>}
          </div>
          <Leaderboard players={game.players} highlight={game.myPlayerId ?? undefined} />
          <Link to="/live" className="btn-secondary">
            {copy.playAgain}
          </Link>
        </section>
      )}
    </div>
  );
}
