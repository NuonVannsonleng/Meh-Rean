import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import { useAuth } from "../../context/AuthContext";
import { t } from "../../i18n/en";
import { LIVE_CODE_PATTERN } from "../../lib/liveQuiz";
import { deleteLiveQuiz, getLiveQuizzes, isLocalMode, joinLiveGame, startLiveGame } from "../../services/api";
import type { LiveQuiz } from "../../types";

const copy = t.bacii.live;

/** Live quiz: join a game with its code, or write and host your own quiz. */
export default function LiveHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => (params.get("code") ?? "").replace(/\D/g, "").slice(0, 6));
  const [nickname, setNickname] = useState(() => (user?.displayName ?? "").slice(0, 24));
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<LiveQuiz[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);

  const load = () => {
    setFailed(false);
    getLiveQuizzes()
      .then(setQuizzes)
      .catch(() => setFailed(true));
  };
  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    load();
  }, []);

  const join = async (event: FormEvent) => {
    event.preventDefault();
    if (!LIVE_CODE_PATTERN.test(code)) return setJoinError(copy.badCode);
    setJoining(true);
    setJoinError(null);
    try {
      const gameId = await joinLiveGame(code, nickname || user?.displayName || "Player");
      navigate(`/live/play/${gameId}`);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : copy.badCode);
      setJoining(false);
    }
  };

  const host = async (quiz: LiveQuiz) => {
    setStarting(quiz.id);
    setHostError(null);
    try {
      const { gameId } = await startLiveGame(quiz.id);
      navigate(`/live/host/${gameId}`);
    } catch (error) {
      setHostError(error instanceof Error ? error.message : String(error));
      setStarting(null);
    }
  };

  const remove = async (quiz: LiveQuiz) => {
    if (!window.confirm(copy.removeConfirm(quiz.title))) return;
    await deleteLiveQuiz(quiz.id).catch(() => {});
    load();
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <header className="mb-5">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="text-ink-500 mt-1 text-sm" lang="km">
          {copy.titleKm}
        </p>
      </header>

      {isLocalMode && <p className="bg-ribbon-50 text-ribbon-fg mb-4 rounded-md px-4 py-3 text-sm">{copy.onlineOnly}</p>}

      <form onSubmit={join} className="card mb-6 space-y-3 p-4 sm:p-5" aria-labelledby="join-title">
        <h2 id="join-title" className="font-display text-ink-900 text-lg font-bold">
          {copy.joinTitle}
        </h2>
        <p className="text-ink-500 text-sm">{copy.joinHint}</p>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
          <label className="text-ink-700 block text-sm font-medium">
            {copy.code}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="123456"
              className="input mt-1 h-12 text-center font-mono text-2xl tracking-[0.3em]"
            />
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.nickname}
            <input value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} className="input mt-1 h-12" />
          </label>
          <button type="submit" disabled={joining} className="btn-primary h-12 px-6">
            {joining ? copy.joining : copy.join}
          </button>
        </div>
        {joinError && (
          <p role="alert" className="text-danger-fg text-sm font-medium">
            {joinError}
          </p>
        )}
      </form>

      <section aria-labelledby="host-title">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="host-title" className="font-display text-ink-900 text-lg font-bold">
            {copy.hostTitle}
          </h2>
          <Link to="/live/quizzes/new" className="btn-secondary h-9 px-3 text-sm">
            <PlusIcon className="h-4 w-4" />
            {copy.newQuiz}
          </Link>
        </div>
        <p className="text-ink-500 mb-3 text-sm">{copy.hostHint}</p>
        {hostError && (
          <p role="alert" className="text-danger-fg mb-3 text-sm font-medium">
            {hostError}
          </p>
        )}
        {failed ? (
          <ErrorState onRetry={load} />
        ) : !quizzes ? (
          <LoadingState count={2} variant="block" />
        ) : quizzes.length === 0 ? (
          <p className="card text-ink-700 p-4 text-sm">{copy.noQuizzes}</p>
        ) : (
          <ul className="card divide-line divide-y">
            {quizzes.map((quiz) => (
              <li key={quiz.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-ink-900 truncate text-sm font-semibold">{quiz.title}</p>
                  <p className="text-ink-500 text-xs">{copy.questionCount(quiz.questions.length)}</p>
                </div>
                <button type="button" onClick={() => void host(quiz)} disabled={Boolean(starting) || isLocalMode} className="btn-primary h-9 px-4 text-sm">
                  {starting === quiz.id ? copy.starting : copy.host}
                </button>
                <Link to={`/live/quizzes/${quiz.id}`} className="btn-ghost h-9 px-3 text-sm">
                  {copy.edit}
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(quiz)}
                  aria-label={copy.remove(quiz.title)}
                  className="text-ink-500 hover:text-danger-fg flex h-9 w-9 items-center justify-center"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
