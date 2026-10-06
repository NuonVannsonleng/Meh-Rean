import { useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { describedBy, FieldShell } from "../components/FormField";
import { ArrowLeftIcon, CameraIcon, CloseIcon, ExternalLinkIcon, SearchIcon, TrashIcon, VideoIcon } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import {
  BACII_SUBJECTS,
  findExerciseVideos,
  LookupError,
  prepareImage,
  youtubeEmbedUrl,
  youtubeSearchUrl,
  type BaciiSubject,
  type ExerciseVideo,
  type PreparedImage,
  type VideoLookup,
} from "../lib/bacii";
import { subjectColor, subjectLabel } from "../lib/subjects";

const copy = t.bacii.videos;

type State =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "done"; result: VideoLookup }
  | { kind: "error"; error: LookupError };

const MATCH_STYLE: Record<ExerciseVideo["match"], string> = {
  exact: "bg-brand-600 text-white",
  "same-topic": "bg-brand-50 text-accent",
  related: "bg-surface-hover text-ink-700",
};

/** Rotating status lines while the server works, so a 10-second wait feels alive. */
function SearchingStatus() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => Math.min(current + 1, copy.searching.length - 1)), 2500);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="card p-5" aria-busy="true">
      <p role="status" className="text-ink-900 flex items-center gap-3 text-sm font-medium">
        <span className="border-brand-600 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" aria-hidden="true" />
        {copy.searching[step]}
      </p>
      <ul className="mt-4 space-y-3" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <li key={item} className="flex gap-3">
            <span className="bg-surface-hover animate-shimmer aspect-video w-36 shrink-0 rounded-lg" />
            <span className="flex-1 space-y-2 py-1">
              <span className="bg-surface-hover animate-shimmer block h-3.5 w-4/5 rounded" />
              <span className="bg-surface-hover animate-shimmer block h-3 w-2/5 rounded" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Player({ video, onClose }: { video: ExerciseVideo; onClose: () => void }) {
  return (
    <section aria-label={copy.playing} className="card animate-pop overflow-hidden">
      <div className="aspect-video bg-black">
        <iframe
          src={youtubeEmbedUrl(video.id)}
          title={video.title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      </div>
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 text-sm font-semibold">{video.title}</p>
          <p className="text-ink-500 text-xs">{video.channel}</p>
        </div>
        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="btn-ghost h-9 px-3 text-xs">
          <ExternalLinkIcon className="h-3.5 w-3.5" />
          {copy.openOnYouTube}
        </a>
        <button type="button" onClick={onClose} aria-label={copy.close} className="icon-btn">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function Results({ result, onAnother }: { result: VideoLookup; onAnother: () => void }) {
  const [playing, setPlaying] = useState<ExerciseVideo | null>(null);
  const { exercise, videos } = result;
  const playerRef = useRef<HTMLDivElement>(null);

  const play = (video: ExerciseVideo) => {
    setPlaying(video);
    requestAnimationFrame(() => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="animate-fade space-y-4">
      <section className="card p-4 sm:p-5" aria-labelledby="exercise-heading">
        <h2 id="exercise-heading" className="text-ink-500 text-xs font-semibold tracking-wide uppercase">
          {copy.understood}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="border-line text-ink-700 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subjectColor(exercise.subject) }} />
            {subjectLabel(exercise.subject)}
          </span>
          {exercise.paper && (
            <span className="bg-ribbon-50 text-ribbon-fg rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {copy.paper(exercise.paper.year, exercise.paper.exercise)}
            </span>
          )}
        </div>
        <p className="font-display text-ink-900 mt-2 text-lg font-bold">
          {exercise.topic}
          {exercise.topicKm && <span className="text-ink-500 font-normal"> · {exercise.topicKm}</span>}
        </p>
        <p className="text-ink-700 mt-1 text-sm leading-relaxed">{exercise.summary}</p>
      </section>

      <div ref={playerRef} className="scroll-mt-20">
        {playing && <Player video={playing} onClose={() => setPlaying(null)} />}
      </div>

      <section aria-labelledby="videos-heading">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="videos-heading" className="text-ink-900 text-base font-bold">
            {copy.resultsHeading}
          </h2>
          <span className="text-ink-500 text-xs">{copy.resultsCount(videos.length)}</span>
        </div>
        {videos.length === 0 ? (
          <p className="card text-ink-700 p-4 text-sm">{copy.noVideos}</p>
        ) : (
          <ul className="card divide-line divide-y overflow-hidden">
            {videos.map((video) => (
              <li key={video.id}>
                <button
                  type="button"
                  onClick={() => play(video)}
                  aria-label={copy.play(video.title)}
                  aria-current={playing?.id === video.id ? "true" : undefined}
                  className={`press flex w-full gap-3 p-3 text-left sm:p-4 ${
                    playing?.id === video.id ? "bg-brand-50" : "hover:bg-surface-hover"
                  }`}
                >
                  <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-black sm:w-44">
                    <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                        <VideoIcon className="h-4 w-4" />
                      </span>
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${MATCH_STYLE[video.match]}`}>
                      {copy.match[video.match]}
                    </span>
                    <span className="text-ink-900 line-clamp-2 block text-sm font-semibold">{video.title}</span>
                    <span className="text-ink-500 block truncate text-xs">{video.channel}</span>
                    {video.reason && <span className="text-ink-700 mt-1 line-clamp-2 block text-xs">{video.reason}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <a href={result.searchUrl} target="_blank" rel="noreferrer" className="btn-secondary">
          <SearchIcon className="h-4 w-4" />
          {copy.searchYouTube}
        </a>
        <button type="button" onClick={onAnother} className="btn-ghost">
          {copy.another}
        </button>
      </div>
      <p className="text-ink-500 text-xs">{copy.disclaimer}</p>
    </div>
  );
}

/** Plain YouTube searches, for when the server cannot read the exercise. */
function Fallback({ text, subject }: { text: string; subject: BaciiSubject | "" }) {
  const words = text.replace(/\s+/g, " ").trim().slice(0, 80);
  const km = BACII_SUBJECTS.find((item) => item.id === subject)?.km ?? "";
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="text-ink-900 text-base font-bold">{copy.fallbackTitle}</h2>
      {words ? (
        <>
          <p className="text-ink-700 mt-1 text-sm">{copy.fallbackBody}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <a href={youtubeSearchUrl(`${words} ${km} បាក់ឌុប`.trim())} target="_blank" rel="noreferrer" className="btn-secondary">
              <SearchIcon className="h-4 w-4" />
              {copy.fallbackKhmer}
            </a>
            <a
              href={youtubeSearchUrl(`${words} ${subject ? subjectLabel(subject) : ""} lesson`.trim())}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <SearchIcon className="h-4 w-4" />
              {copy.fallbackEnglish}
            </a>
          </div>
        </>
      ) : (
        <p className="text-ink-700 mt-1 text-sm">{copy.fallbackNeedsText}</p>
      )}
    </section>
  );
}

/** BacII → "Find a video for an exercise". */
export default function BaciiVideos() {
  const { user } = useAuth();
  const textId = useId();
  const photoId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState<BaciiSubject | "">("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [inputError, setInputError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    document.title = `${copy.title} · ${t.bacii.title} · ${t.common.appName}`;
  }, []);

  const addFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      setImage(await prepareImage(file));
      setInputError(null);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : copy.needInput);
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
    if (file) {
      event.preventDefault();
      void addFile(file);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void addFile(event.dataTransfer.files[0]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!image && !text.trim()) {
      setInputError(copy.needInput);
      return;
    }
    setInputError(null);
    setState({ kind: "searching" });
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const result = await findExerciseVideos({ text: text.trim(), subject, image });
      setState({ kind: "done", result });
    } catch (error) {
      setState({ kind: "error", error: error instanceof LookupError ? error : new LookupError("UPSTREAM", String(error)) });
    }
  };

  const reset = () => {
    setImage(null);
    setText("");
    setSubject("");
    setState({ kind: "idle" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const searching = state.kind === "searching";

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8" onPaste={onPaste}>
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {copy.back}
      </Link>
      <header className="mb-6">
        <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
        <p className="text-ink-500 mt-1 text-sm">{t.bacii.videos.optionTitleKm}</p>
        <p className="text-ink-700 mt-2 text-sm leading-relaxed">{copy.subtitle}</p>
      </header>

      <form onSubmit={submit} noValidate className="card space-y-5 p-4 sm:p-6">
        {/* Photo */}
        <div>
          <p id={`${photoId}-label`} className="field-label">
            {copy.photoLabel}
          </p>
          {image ? (
            <div className="border-line bg-surface-muted/60 rounded-md border p-2">
              <img src={image.previewUrl} alt={copy.photoAlt} className="mx-auto max-h-80 rounded object-contain" />
              <div className="mt-2 flex justify-center gap-2">
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
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-7 text-center transition-colors ${
                dragging ? "border-brand-500 bg-brand-50" : "border-line bg-surface-muted/60"
              }`}
            >
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary">
                <CameraIcon className="h-4 w-4" />
                {copy.takePhoto}
              </button>
              <p id={`${photoId}-hint`} className="text-ink-500 max-w-sm text-xs leading-relaxed">
                {copy.photoHint}
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            id={photoId}
            type="file"
            accept="image/*"
            aria-labelledby={`${photoId}-label`}
            onChange={(event) => {
              void addFile(event.target.files?.[0]);
              event.target.value = "";
            }}
            className="sr-only"
            tabIndex={-1}
          />
        </div>

        <FieldShell id={textId} label={copy.textLabel} hint={copy.textHint} optional>
          <textarea
            id={textId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={copy.textPlaceholder}
            rows={3}
            maxLength={4000}
            aria-describedby={describedBy(textId, undefined, copy.textHint)}
            className="input field-sizing-content h-auto min-h-24 resize-y py-3 leading-relaxed"
          />
        </FieldShell>

        <fieldset>
          <legend className="field-label">
            {copy.subjectLabel}
            <span className="text-ink-400 ml-1 font-normal">({t.common.optional})</span>
          </legend>
          {/* Two columns on phones, so each subject keeps its Khmer name on one line. */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {[{ id: "" as const, km: "" }, ...BACII_SUBJECTS].map((item) => {
              const active = subject === item.id;
              return (
                <label
                  key={item.id || "any"}
                  className={`press inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium sm:rounded-full sm:px-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
                    active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 hover:border-ink-400"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${photoId}-subject`}
                    checked={active}
                    onChange={() => setSubject(item.id)}
                    className="sr-only"
                  />
                  {item.id && <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70" style={{ backgroundColor: subjectColor(item.id) }} />}
                  <span className="min-w-0 leading-tight">
                    <span className="block">{item.id ? subjectLabel(item.id) : copy.subjectAny}</span>
                    {item.km && <span className={`block text-xs font-normal ${active ? "text-white/80" : "text-ink-500"}`}>{item.km}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {inputError && (
          <p role="alert" className="field-error">
            {inputError}
          </p>
        )}

        {user ? (
          <button type="submit" disabled={searching} className="btn-primary w-full sm:w-auto sm:min-w-44">
            <SearchIcon className="h-4 w-4" />
            {searching ? copy.searching[0] : copy.submit}
          </button>
        ) : (
          <div className="bg-brand-50 flex flex-col gap-3 rounded-md p-4 sm:flex-row sm:items-center">
            <p className="text-ink-900 flex-1 text-sm font-medium">{copy.signInPrompt}</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/login?next=%2Fbacii%2Fvideos" className="btn-primary flex-1 sm:flex-none">
                {copy.signIn}
              </Link>
              <Link to="/signup?next=%2Fbacii%2Fvideos" className="btn-secondary flex-1 sm:flex-none">
                {copy.signUp}
              </Link>
            </div>
          </div>
        )}
      </form>

      <div ref={resultsRef} className="mt-6 scroll-mt-20" aria-live="polite">
        {state.kind === "searching" && <SearchingStatus />}
        {state.kind === "done" && <Results result={state.result} onAnother={reset} />}
        {state.kind === "error" &&
          (state.error.code === "NOT_CONFIGURED" ? (
            <Fallback text={text} subject={subject} />
          ) : (
            <div className="space-y-4">
              <p role="alert" className="bg-danger-bg text-danger-fg rounded-md px-4 py-3 text-sm font-medium">
                {state.error.message}
              </p>
              {state.error.code !== "UNAUTHORIZED" && <Fallback text={text} subject={subject} />}
            </div>
          ))}
      </div>
    </div>
  );
}
