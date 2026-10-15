import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, CloseIcon, PlusIcon, TrashIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import MathText from "../../components/MathText";
import { CHOICE_STYLES } from "../../components/live/LiveParts";
import { t } from "../../i18n/en";
import { blankLiveQuestion, LIVE_MAX_QUESTIONS, LIVE_SECONDS, liveQuestionProblems } from "../../lib/liveQuiz";
import { getLiveQuiz, saveLiveQuiz } from "../../services/api";
import type { LiveQuestion } from "../../types";

const copy = t.bacii.live.editor;

/** Write or change a live quiz: questions, 2–4 answers each, and a timer per question. */
export default function LiveQuizEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<LiveQuestion[] | null>(id ? null : [blankLiveQuestion()]);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = `${id ? copy.editTitle : copy.newTitle} · ${t.common.appName}`;
    if (!id) return;
    getLiveQuiz(id)
      .then((quiz) => {
        setTitle(quiz.title);
        setQuestions(quiz.questions);
      })
      .catch(() => navigate("/live", { replace: true }));
  }, [id, navigate]);

  if (!questions) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={2} variant="block" />
      </div>
    );
  }

  const change = (index: number, next: Partial<LiveQuestion>) => {
    setQuestions(questions.map((question, i) => (i === index ? { ...question, ...next } : question)));
    setProblem(null);
  };
  const move = (index: number, by: number) => {
    const next = [...questions];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setQuestions(next);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setProblem(copy.needTitle);
    const bad = questions.findIndex((question) => liveQuestionProblems(question).length);
    if (bad >= 0) return setProblem(copy.fixQuestion(bad + 1));
    setSaving(true);
    try {
      await saveLiveQuiz({ title, questions }, id ?? null);
      navigate("/live");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : copy.saveFailed);
      setSaving(false);
    }
  };

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/live" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {copy.back}
      </Link>
      <h1 className="text-ink-900 mb-4 text-2xl sm:text-3xl">{id ? copy.editTitle : copy.newTitle}</h1>

      <form onSubmit={save} className="space-y-4">
        <label className="text-ink-700 block text-sm font-medium">
          {copy.quizTitle}
          <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} className="input mt-1 h-11" />
        </label>

        <ol className="space-y-3">
          {questions.map((question, index) => {
            const n = index + 1;
            return (
              <li key={index} className="card space-y-3 p-4">
                <div className="flex items-center gap-1">
                  <h2 className="text-ink-900 flex-1 text-sm font-bold">{copy.question(n)}</h2>
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={copy.moveUp(n)} className="text-ink-500 h-8 w-8 rounded disabled:opacity-30">
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === questions.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={copy.moveDown(n)}
                    className="text-ink-500 h-8 w-8 rounded disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={questions.length === 1}
                    onClick={() => setQuestions(questions.filter((_, i) => i !== index))}
                    aria-label={copy.removeQuestion(n)}
                    className="text-ink-500 hover:text-danger-fg flex h-8 w-8 items-center justify-center disabled:opacity-30"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <label htmlFor={`prompt-${index}`} className="text-ink-700 block text-xs font-medium">
                    {copy.prompt}
                  </label>
                  <textarea
                    id={`prompt-${index}`}
                    value={question.prompt}
                    maxLength={500}
                    rows={2}
                    onChange={(event) => change(index, { prompt: event.target.value })}
                    aria-describedby={`prompt-hint-${index}`}
                    className="input mt-1 h-auto py-2 text-sm"
                  />
                  <p id={`prompt-hint-${index}`} className="text-ink-500 mt-1 text-xs">
                    {copy.promptHint}
                  </p>
                </div>
                {question.prompt.includes("$") && <MathText text={question.prompt} className="text-ink-900 bg-surface-muted rounded-md px-3 py-2 text-sm" />}
                <fieldset>
                  <legend className="text-ink-700 text-xs font-medium">{copy.choices}</legend>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {question.choices.map((choice, c) => (
                      <div key={c} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`right-${index}`}
                          checked={question.answer === c}
                          onChange={() => change(index, { answer: c })}
                          aria-label={copy.rightChoice(n, c + 1)}
                        />
                        <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-sm ${CHOICE_STYLES[c].className}`}>
                          {CHOICE_STYLES[c].shape}
                        </span>
                        <input
                          value={choice}
                          maxLength={200}
                          onChange={(event) => change(index, { choices: question.choices.map((item, i) => (i === c ? event.target.value : item)) })}
                          aria-label={copy.choiceText(n, c + 1)}
                          className="input h-9 min-w-0 flex-1 text-sm"
                        />
                        {question.choices.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              change(index, {
                                choices: question.choices.filter((_, i) => i !== c),
                                answer: question.answer === c ? 0 : question.answer > c ? question.answer - 1 : question.answer,
                              })
                            }
                            aria-label={copy.removeChoice(n, c + 1)}
                            className="text-ink-500 hover:text-danger-fg flex h-8 w-6 items-center justify-center"
                          >
                            <CloseIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {question.choices.length < 4 && (
                    <button type="button" onClick={() => change(index, { choices: [...question.choices, ""] })} className="btn-ghost mt-1 h-8 px-2 text-xs">
                      <PlusIcon className="h-3.5 w-3.5" />
                      {copy.addChoice}
                    </button>
                  )}
                </fieldset>
                <label className="text-ink-700 flex items-center gap-2 text-xs font-medium">
                  {copy.seconds}
                  <select value={question.seconds} onChange={(event) => change(index, { seconds: Number(event.target.value) })} className="input h-9 w-auto text-sm">
                    {LIVE_SECONDS.map((s) => (
                      <option key={s} value={s}>
                        {copy.secondsOption(s)}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            );
          })}
        </ol>

        {questions.length < LIVE_MAX_QUESTIONS && (
          <button type="button" onClick={() => setQuestions([...questions, { ...blankLiveQuestion(), seconds: questions.at(-1)?.seconds ?? 20 }])} className="btn-secondary">
            <PlusIcon className="h-4 w-4" />
            {copy.addQuestion}
          </button>
        )}
        {problem && (
          <p role="alert" className="text-danger-fg text-sm font-medium">
            {problem}
          </p>
        )}
        <div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? copy.saving : copy.save}
          </button>
        </div>
      </form>
    </div>
  );
}
