import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ErrorState";
import { ArrowLeftIcon, PlusIcon, TrashIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import { t } from "../../i18n/en";
import { draftVideoQuiz, LookupError } from "../../lib/bacii";
import { isValidVideoQuiz, questionProblems, videoIdFrom } from "../../lib/videoQuiz";
import { deleteVideoQuiz, getVideoQuizzes, isLocalMode, saveVideoQuiz } from "../../services/api";
import type { VideoQuiz, VideoQuizQuestion } from "../../types";

const copy = t.admin.quizzes;
const blankQuestion = (): VideoQuizQuestion => ({ prompt: "", choices: ["", "", "", ""], answer: 0, explanation: "" });

interface Draft {
  link: string;
  title: string;
  language: "km" | "en";
  source: string;
  transcript: string;
  questions: VideoQuizQuestion[];
  aiGenerated: boolean;
  reviewed: boolean;
}

const EMPTY: Draft = { link: "", title: "", language: "km", source: "", transcript: "", questions: [], aiGenerated: false, reviewed: false };

function QuestionEditor({ index, question, onChange, onRemove }: { index: number; question: VideoQuizQuestion; onChange: (q: VideoQuizQuestion) => void; onRemove: () => void }) {
  return (
    <li className="border-line rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-ink-900 text-sm font-semibold">{copy.question(index + 1)}</p>
        <button type="button" onClick={onRemove} aria-label={copy.removeQuestion(index + 1)} className="text-ink-500 hover:text-danger-fg flex h-8 w-8 items-center justify-center">
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
      <label className="text-ink-700 block text-xs font-medium">
        {copy.prompt}
        <textarea value={question.prompt} onChange={(event) => onChange({ ...question, prompt: event.target.value })} rows={2} maxLength={600} className="input mt-1 h-auto py-2 text-sm" />
      </label>
      <fieldset className="mt-2">
        <legend className="text-ink-700 text-xs font-medium">{copy.choices}</legend>
        <div className="mt-1 space-y-1.5">
          {question.choices.map((choice, choiceIndex) => (
            <div key={choiceIndex} className="flex items-center gap-2">
              <input
                type="radio"
                name={`answer-${index}`}
                checked={question.answer === choiceIndex}
                onChange={() => onChange({ ...question, answer: choiceIndex })}
                aria-label={copy.rightChoice(index + 1, choiceIndex + 1)}
              />
              <input
                value={choice}
                maxLength={300}
                onChange={(event) => onChange({ ...question, choices: question.choices.map((item, i) => (i === choiceIndex ? event.target.value : item)) })}
                aria-label={copy.choiceText(index + 1, choiceIndex + 1)}
                className="input h-9 min-w-0 flex-1 text-sm"
              />
            </div>
          ))}
        </div>
      </fieldset>
      <label className="text-ink-700 mt-2 block text-xs font-medium">
        {copy.explanation}
        <input value={question.explanation} maxLength={800} onChange={(event) => onChange({ ...question, explanation: event.target.value })} className="input mt-1 h-9 text-sm" />
      </label>
    </li>
  );
}

/** BacII → Admin → Video quizzes (roadmap 4.6). */
export default function AdminQuizzes() {
  const [quizzes, setQuizzes] = useState<VideoQuiz[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [drafting, setDrafting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = () => {
    setFailed(false);
    getVideoQuizzes()
      .then(setQuizzes)
      .catch(() => setFailed(true));
  };
  useEffect(() => {
    document.title = `${copy.title} · ${t.common.appName}`;
    load();
  }, []);

  const update = (changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setProblem(null);
    setSaved(false);
  };

  const askAI = async () => {
    setDrafting(true);
    setProblem(null);
    try {
      const questions = await draftVideoQuiz(draft.transcript, draft.language, draft.title);
      update({ questions, aiGenerated: true, reviewed: false });
    } catch (error) {
      setProblem(error instanceof LookupError || error instanceof Error ? error.message : copy.draftFailed);
    } finally {
      setDrafting(false);
    }
  };

  const edit = (quiz: VideoQuiz) => {
    setDraft({ link: quiz.videoId, title: quiz.title, language: quiz.language, source: quiz.source, transcript: "", questions: quiz.questions, aiGenerated: quiz.aiGenerated, reviewed: quiz.reviewed });
    setProblem(null);
    setSaved(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const videoId = videoIdFrom(draft.link);
    if (!videoId) return setProblem(copy.badVideo);
    if (draft.source.trim().length < 3) return setProblem(copy.needSource);
    const index = draft.questions.findIndex((question) => questionProblems(question).length);
    if (!draft.questions.length) return setProblem(copy.needQuestions);
    if (index >= 0) return setProblem(copy.fixQuestion(index + 1));
    const input = { videoId, title: draft.title.trim(), language: draft.language, questions: draft.questions, source: draft.source.trim(), aiGenerated: draft.aiGenerated, reviewed: draft.reviewed };
    if (!isValidVideoQuiz(input)) return setProblem(copy.needTitle);
    try {
      await saveVideoQuiz(input);
      setDraft(EMPTY);
      setSaved(true);
      load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : copy.saveFailed);
    }
  };

  const remove = async (quiz: VideoQuiz) => {
    if (!window.confirm(copy.removeConfirm(quiz.title))) return;
    await deleteVideoQuiz(quiz.videoId).catch(() => {});
    load();
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {t.bacii.title}
      </Link>
      <h1 className="text-ink-900 text-2xl sm:text-3xl">{copy.title}</h1>
      <p className="text-ink-700 mt-1 mb-4 text-sm">{copy.subtitle}</p>

      <form onSubmit={save} className="card mb-5 space-y-3 p-4 sm:p-5" aria-labelledby="quiz-form">
        <h2 id="quiz-form" className="font-display text-ink-900 text-lg font-bold">
          {copy.formTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-ink-700 block text-sm font-medium">
            {copy.video}
            <input value={draft.link} onChange={(event) => update({ link: event.target.value })} placeholder="https://youtu.be/…" className="input mt-1 h-10" />
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.videoTitle}
            <input value={draft.title} maxLength={200} onChange={(event) => update({ title: event.target.value })} className="input mt-1 h-10" />
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.language}
            <select value={draft.language} onChange={(event) => update({ language: event.target.value as "km" | "en" })} className="input mt-1 h-10">
              <option value="km">{t.questions.languages.km}</option>
              <option value="en">{t.questions.languages.en}</option>
            </select>
          </label>
          <label className="text-ink-700 block text-sm font-medium">
            {copy.source}
            <input value={draft.source} maxLength={300} onChange={(event) => update({ source: event.target.value })} className="input mt-1 h-10" />
            <span className="text-ink-500 mt-1 block text-xs font-normal">{copy.sourceHint}</span>
          </label>
        </div>

        <label className="text-ink-700 block text-sm font-medium">
          {copy.transcript}
          <textarea
            value={draft.transcript}
            onChange={(event) => update({ transcript: event.target.value })}
            rows={4}
            maxLength={30000}
            className="input mt-1 h-auto py-2 text-sm"
          />
          <span className="text-ink-500 mt-1 block text-xs font-normal">{copy.transcriptHint}</span>
        </label>
        {!isLocalMode && (
          <button type="button" onClick={() => void askAI()} disabled={drafting || draft.transcript.trim().length < 200} className="btn-secondary">
            {drafting ? copy.drafting : copy.draft}
          </button>
        )}

        {draft.questions.length > 0 && draft.aiGenerated && <p className="bg-ribbon-50 text-ribbon-fg rounded-md px-3 py-2 text-xs font-medium">{copy.aiNote}</p>}
        <ol className="space-y-2">
          {draft.questions.map((question, index) => (
            <QuestionEditor
              key={index}
              index={index}
              question={question}
              onChange={(next) => update({ questions: draft.questions.map((item, i) => (i === index ? next : item)) })}
              onRemove={() => update({ questions: draft.questions.filter((_, i) => i !== index) })}
            />
          ))}
        </ol>
        {draft.questions.length < 10 && (
          <button type="button" onClick={() => update({ questions: [...draft.questions, blankQuestion()] })} className="btn-ghost h-9 px-3 text-sm">
            <PlusIcon className="h-4 w-4" />
            {copy.addQuestion}
          </button>
        )}

        <label className="text-ink-900 flex items-start gap-2 text-sm font-medium">
          <input type="checkbox" checked={draft.reviewed} onChange={(event) => update({ reviewed: event.target.checked })} className="mt-1" />
          {copy.reviewed}
        </label>
        {problem && (
          <p role="alert" className="text-danger-fg text-sm font-medium">
            {problem}
          </p>
        )}
        {saved && (
          <p role="status" className="text-accent text-sm font-medium">
            {copy.saved}
          </p>
        )}
        <button type="submit" className="btn-primary">
          {copy.save}
        </button>
      </form>

      {failed ? (
        <ErrorState onRetry={load} />
      ) : !quizzes ? (
        <LoadingState count={2} variant="block" />
      ) : quizzes.length === 0 ? (
        <p className="card text-ink-700 p-4 text-sm">{copy.none}</p>
      ) : (
        <ul className="card divide-line divide-y">
          {quizzes.map((quiz) => (
            <li key={quiz.videoId} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => edit(quiz)} className="text-ink-900 text-left text-sm font-semibold hover:underline">
                  {quiz.title}
                </button>
                <p className="text-ink-500 text-xs">
                  {`${copy.count(quiz.questions.length)} · ${quiz.reviewed ? copy.isReviewed : copy.notReviewed} · ${quiz.source}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(quiz)}
                aria-label={copy.remove(quiz.title)}
                className="text-ink-500 hover:text-danger-fg flex h-8 w-8 shrink-0 items-center justify-center"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
