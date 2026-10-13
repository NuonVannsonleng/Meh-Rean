import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FieldShell } from "../../components/FormField";
import { ArrowLeftIcon, CloseIcon, ImageIcon, PlusIcon, TrashIcon } from "../../components/Icons";
import LoadingState from "../../components/LoadingState";
import MathText from "../../components/MathText";
import QuestionImage from "../../components/QuestionImage";
import { useToast } from "../../context/ToastContext";
import { t } from "../../i18n/en";
import { errorMessage } from "../../lib/errors";
import { checkQuestionInput, type QuestionProblems } from "../../lib/questions";
import { deleteQuestion, getCurriculumChapters, getCurriculumSubjects, getQuestion, saveQuestion, uploadQuestionImage } from "../../services/api";
import {
  ApiError,
  QUESTION_ORIGINS,
  QUESTION_TYPES,
  SOLUTION_ORIGINS,
  VERIFICATIONS,
  type ContentLanguage,
  type CurriculumChapter,
  type CurriculumSubject,
  type QuestionChoice,
  type QuestionImage as QuestionImageData,
  type QuestionInput,
  type QuestionOrigin,
  type QuestionType,
  type SolutionOrigin,
  type Verification,
} from "../../types";

const copy = t.admin.editor;
const LETTERS = "abcdefgh";
const LANGUAGES: ContentLanguage[] = ["km", "en", "fr"];

const blankChoices = (): QuestionChoice[] => ["a", "b", "c", "d"].map((id) => ({ id, content: "" }));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-4 p-4 sm:p-5">
      <h2 className="font-display text-ink-900 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** A live preview of text with maths, under the field it belongs to. */
function Preview({ text }: { text: string }) {
  return (
    <div className="border-line bg-surface-muted/60 mt-2 rounded-md border px-3 py-2">
      <p className="text-ink-500 mb-1 text-[11px] font-semibold tracking-wide uppercase">{copy.preview}</p>
      {text.trim() ? <MathText text={text} className="text-ink-900 text-sm" /> : <p className="text-ink-400 text-sm">{copy.previewEmpty}</p>}
    </div>
  );
}

function Select<T extends string>({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)} className="input cursor-pointer">
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const parseNumber = (text: string): number | null => {
  const trimmed = text.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
};

/** BacII → Manage questions → New / Edit: one question with its solution. */
export default function QuestionEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { notify } = useToast();
  const ids = { subject: useId(), chapter: useId(), topic: useId(), year: useId(), difficulty: useId(), language: useId() };
  const fid = { type: useId(), content: useId(), numeric: useId(), tolerance: useId(), answer: useId(), origin: useId() };
  const sid = { source: useId(), verification: useId(), sOrigin: useId(), sSource: useId(), sVerification: useId() };
  const fileRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [loading, setLoading] = useState(editing);
  const [missing, setMissing] = useState(false);

  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [yearText, setYearText] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [language, setLanguage] = useState<ContentLanguage>("km");
  const [type, setType] = useState<QuestionType>("multiple-choice");
  const [content, setContent] = useState("");
  const [choices, setChoices] = useState<QuestionChoice[]>(blankChoices);
  const [correctChoice, setCorrectChoice] = useState<string | null>(null);
  const [numericText, setNumericText] = useState("");
  const [toleranceText, setToleranceText] = useState("0");
  const [images, setImages] = useState<QuestionImageData[]>([]);
  const [answer, setAnswer] = useState("");
  const [steps, setSteps] = useState<string[]>([""]);
  const [origin, setOrigin] = useState<QuestionOrigin>("teacher");
  const [source, setSource] = useState("");
  const [verification, setVerification] = useState<Verification>("provisional");
  const [solutionOrigin, setSolutionOrigin] = useState<SolutionOrigin>("teacher");
  const [solutionSource, setSolutionSource] = useState("");
  const [solutionVerification, setSolutionVerification] = useState<Verification>("provisional");

  // After the first save attempt, problems are re-checked as the admin types.
  const [attempted, setAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    document.title = `${editing ? copy.editTitle : copy.newTitle} · ${t.common.appName}`;
    getCurriculumSubjects()
      .then((list) => {
        setSubjects(list);
        setSubjectId((current) => current || list[0]?.id || "");
      })
      .catch(() => setSubjects([]));
  }, [editing]);

  useEffect(() => {
    if (!subjectId) return;
    getCurriculumChapters(subjectId).then(setChapters).catch(() => setChapters([]));
  }, [subjectId]);

  // Editing: fill the form from the saved question.
  useEffect(() => {
    if (!id) return;
    let active = true;
    getQuestion(id)
      .then((question) => {
        if (!active) return;
        setSubjectId(question.subjectId);
        setChapterId(question.chapterId);
        setTopicId(question.topicId ?? "");
        setYearText(question.year ? String(question.year) : "");
        setDifficulty(question.difficulty ? String(question.difficulty) : "");
        setLanguage(question.language);
        setType(question.type);
        setContent(question.content);
        setChoices(question.type === "multiple-choice" ? question.choices : blankChoices());
        setImages(question.images);
        setOrigin(question.origin);
        setSource(question.source);
        setVerification(question.verification);
        const solution = question.solution;
        if (solution) {
          setCorrectChoice(solution.correctChoice);
          setNumericText(solution.numericAnswer === null ? "" : String(solution.numericAnswer));
          setToleranceText(solution.numericTolerance === null ? "0" : String(solution.numericTolerance));
          setAnswer(solution.answer);
          setSteps(solution.steps.length ? solution.steps.map((step) => step.content) : [""]);
          setSolutionOrigin(solution.origin);
          setSolutionSource(solution.source);
          setSolutionVerification(solution.verification);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setMissing(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const chapter = useMemo(() => chapters.find((item) => item.id === chapterId), [chapters, chapterId]);

  const buildInput = (): QuestionInput => ({
    chapterId,
    topicId: topicId || null,
    year: parseNumber(yearText),
    type,
    content,
    // Empty trailing choices are dropped; letters stay as they are.
    choices: choices.filter((choice) => choice.content.trim() || choice.id === correctChoice),
    images,
    difficulty: difficulty ? Number(difficulty) : null,
    language,
    origin,
    source,
    verification,
    solution: {
      answer,
      correctChoice,
      numericAnswer: parseNumber(numericText),
      numericTolerance: parseNumber(toleranceText) ?? 0,
      // Empty steps at the end are ignored, not errors.
      steps: steps.map((step) => ({ content: step })).filter((step, index, all) => step.content.trim() || all.slice(index + 1).some((next) => next.content.trim())),
      origin: solutionOrigin,
      source: solutionSource,
      verification: solutionVerification,
    },
  });

  const problems: QuestionProblems = attempted ? checkQuestionInput(buildInput(), chapters) : {};

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = buildInput();
    const found = checkQuestionInput(input, chapters);
    setAttempted(true);
    setSubmitError(null);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setSaving(true);
    try {
      const saved = await saveQuestion(input, id ?? null);
      notify(input.verification === "verified" && saved.verification === "needs-review" ? copy.savedNeedsReview : copy.saved);
      navigate(`/bacii/admin/questions?subject=${encodeURIComponent(saved.subjectId)}`);
    } catch (error) {
      // A rule the database enforces gives its own reason.
      setSubmitError(error instanceof ApiError && error.status === 400 ? error.message : errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm(copy.confirmDelete)) return;
    try {
      await deleteQuestion(id);
      notify(copy.deleted);
      navigate("/bacii/admin/questions");
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setSubmitError(null);
    try {
      for (const file of Array.from(files).slice(0, 6 - images.length)) {
        const uploaded = await uploadQuestionImage(file);
        setImages((current) => [...current, { ...uploaded, alt: "" }]);
      }
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const problem = (field: keyof QuestionProblems) => (problems[field] ? copy.problems[problems[field]!] : undefined);

  if (loading) {
    return (
      <div className="container-page max-w-3xl py-8">
        <LoadingState count={2} variant="block" />
      </div>
    );
  }
  if (missing) {
    return (
      <div className="container-page max-w-3xl py-16 text-center">
        <p className="text-ink-700">{t.apiErrors.NOT_FOUND}</p>
      </div>
    );
  }

  const optionalNumber = (value: string, set: (value: string) => void, fieldId: string, label: string, hint?: string, error?: string) => (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} optional>
      <input id={fieldId} inputMode="decimal" value={value} onChange={(event) => set(event.target.value)} className="input" />
    </FieldShell>
  );

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <Link to="/bacii/admin/questions" className="text-ink-500 hover:text-ink-900 mb-4 inline-flex items-center gap-1.5 text-sm font-medium">
        <ArrowLeftIcon className="h-4 w-4" />
        {copy.back}
      </Link>
      <h1 className="text-ink-900 mb-5 text-2xl sm:text-3xl">{editing ? copy.editTitle : copy.newTitle}</h1>

      <form onSubmit={submit} noValidate className="space-y-4">
        <div ref={summaryRef}>
          {Object.keys(problems).length > 0 && (
            <p role="alert" className="bg-danger-bg text-danger-fg rounded-md px-4 py-3 text-sm font-medium">
              {copy.fixErrors}
            </p>
          )}
        </div>

        <Section title={copy.placeHeading}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell id={ids.subject} label={copy.subject}>
              <select
                id={ids.subject}
                value={subjectId}
                onChange={(event) => {
                  setSubjectId(event.target.value);
                  setChapterId("");
                  setTopicId("");
                }}
                className="input cursor-pointer"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {`${subject.nameKm} — ${subject.nameEn} (${subject.trackNameEn})`}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell id={ids.chapter} label={copy.chapter} error={problem("chapter")}>
              <select
                id={ids.chapter}
                value={chapterId}
                onChange={(event) => {
                  setChapterId(event.target.value);
                  setTopicId("");
                }}
                aria-invalid={problems.chapter ? true : undefined}
                className="input cursor-pointer"
              >
                <option value="">{copy.chooseChapter}</option>
                {chapters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t.admin.chapterLabel(item.number, item.nameKm, item.nameEn)}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell id={ids.topic} label={copy.topic} error={problem("topic")} optional>
              <select id={ids.topic} value={topicId} onChange={(event) => setTopicId(event.target.value)} className="input cursor-pointer" disabled={!chapter}>
                <option value="">{copy.noTopic}</option>
                {chapter?.topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {`${topic.nameKm} — ${topic.nameEn}`}
                  </option>
                ))}
              </select>
            </FieldShell>
            {optionalNumber(yearText, setYearText, ids.year, copy.year, copy.yearHint, problem("year"))}
            <FieldShell id={ids.difficulty} label={copy.difficulty} error={problem("difficulty")} optional>
              <select id={ids.difficulty} value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="input cursor-pointer">
                <option value="">{copy.noDifficulty}</option>
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {copy.difficultyLevel(level)}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell id={ids.language} label={copy.language}>
              <Select id={ids.language} value={language} onChange={setLanguage} options={LANGUAGES.map((value) => ({ value, label: t.questions.languages[value] }))} />
            </FieldShell>
          </div>
        </Section>

        <Section title={copy.questionHeading}>
          <FieldShell id={fid.type} label={copy.type}>
            <Select id={fid.type} value={type} onChange={setType} options={QUESTION_TYPES.map((value) => ({ value, label: t.questions.types[value] }))} />
          </FieldShell>
          <FieldShell id={fid.content} label={copy.content} hint={copy.contentHint} error={problem("content")}>
            <textarea
              id={fid.content}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              aria-invalid={problems.content ? true : undefined}
              className="input field-sizing-content h-auto min-h-32 resize-y py-3 font-mono text-sm leading-relaxed"
            />
          </FieldShell>
          <Preview text={content} />

          <div>
            <p className="field-label">{copy.images}</p>
            <p className="text-ink-500 mb-2 text-xs">{copy.imageHint}</p>
            {images.length > 0 && (
              <ul className="mb-3 space-y-3">
                {images.map((image, index) => (
                  <li key={image.url} className="border-line flex flex-col gap-3 rounded-md border p-2 sm:flex-row">
                    <QuestionImage image={image} className="h-32 w-full shrink-0 sm:h-20 sm:w-28" />
                    <div className="min-w-0 flex-1">
                      <label className="text-ink-700 mb-1 block text-xs font-medium">
                        {copy.imageAlt}
                        <input
                          value={image.alt}
                          maxLength={300}
                          placeholder={copy.imageAltPlaceholder}
                          onChange={(event) => setImages((current) => current.map((item, i) => (i === index ? { ...item, alt: event.target.value } : item)))}
                          className="input mt-1 h-9 text-sm"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                      aria-label={copy.removeImage}
                      className="icon-btn self-end sm:self-start"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {problem("images") && <p className="field-error">{problem("images")}</p>}
            {images.length < 6 && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary">
                <ImageIcon className="h-4 w-4" />
                {uploading ? copy.saving : copy.addImage}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              aria-label={copy.addImage}
              onChange={(event) => {
                void addImages(event.target.files);
                event.target.value = "";
              }}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
        </Section>

        {type === "multiple-choice" && (
          <Section title={copy.choicesHeading}>
            <fieldset className="space-y-3">
              <legend className="sr-only">{copy.choicesHeading}</legend>
              {choices.map((choice, index) => (
                <div key={choice.id} className="border-line rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="text-ink-900 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
                      <input
                        type="radio"
                        name="correct-choice"
                        checked={correctChoice === choice.id}
                        onChange={() => setCorrectChoice(choice.id)}
                        className="accent-[var(--color-brand-600)]"
                      />
                      {copy.choice(choice.id)}
                      {correctChoice === choice.id && <span className="text-accent text-xs font-semibold">· {copy.correct}</span>}
                    </label>
                    {choices.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setChoices((current) => current.filter((_, i) => i !== index));
                          if (correctChoice === choice.id) setCorrectChoice(null);
                        }}
                        aria-label={copy.removeChoice(choice.id)}
                        className="icon-btn"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <input
                    aria-label={copy.choiceText(choice.id)}
                    value={choice.content}
                    onChange={(event) => setChoices((current) => current.map((item, i) => (i === index ? { ...item, content: event.target.value } : item)))}
                    className="input font-mono text-sm"
                  />
                  {choice.content.trim() && <MathText text={choice.content} className="text-ink-900 mt-2 text-sm" />}
                </div>
              ))}
              {problem("choices") && <p className="field-error">{problem("choices")}</p>}
              {problem("correctChoice") && <p className="field-error">{problem("correctChoice")}</p>}
              {choices.length < 8 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = [...LETTERS].find((letter) => !choices.some((choice) => choice.id === letter));
                    if (next) setChoices((current) => [...current, { id: next, content: "" }]);
                  }}
                  className="btn-secondary"
                >
                  <PlusIcon className="h-4 w-4" />
                  {copy.addChoice}
                </button>
              )}
            </fieldset>
          </Section>
        )}

        <Section title={copy.solutionHeading}>
          {type === "numeric" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldShell id={fid.numeric} label={copy.numericAnswer} error={problem("numericAnswer")}>
                <input id={fid.numeric} inputMode="decimal" value={numericText} onChange={(event) => setNumericText(event.target.value)} className="input" />
              </FieldShell>
              <FieldShell id={fid.tolerance} label={copy.tolerance} hint={copy.toleranceHint}>
                <input id={fid.tolerance} inputMode="decimal" value={toleranceText} onChange={(event) => setToleranceText(event.target.value)} className="input" />
              </FieldShell>
            </div>
          )}
          <FieldShell id={fid.answer} label={copy.answer} hint={copy.answerHint} error={problem("answer")}>
            <input
              id={fid.answer}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              aria-invalid={problems.answer ? true : undefined}
              className="input font-mono text-sm"
            />
          </FieldShell>
          {answer.trim() && <MathText text={answer} className="text-ink-900 text-sm" />}

          <div>
            <p className="field-label">{copy.steps}</p>
            <p className="text-ink-500 mb-2 text-xs">{copy.stepsHint}</p>
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={index} className="border-line rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-ink-900 text-sm font-semibold">{copy.step(index + 1)}</span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => setSteps((current) => current.map((item, i) => (i === index - 1 ? current[index] : i === index ? current[index - 1] : item)))}
                        aria-label={copy.moveUp(index + 1)}
                        className="icon-btn disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === steps.length - 1}
                        onClick={() => setSteps((current) => current.map((item, i) => (i === index + 1 ? current[index] : i === index ? current[index + 1] : item)))}
                        aria-label={copy.moveDown(index + 1)}
                        className="icon-btn disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => setSteps((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : [""]))}
                        aria-label={copy.removeStep(index + 1)}
                        className="icon-btn"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </span>
                  </div>
                  <textarea
                    aria-label={copy.step(index + 1)}
                    value={step}
                    onChange={(event) => setSteps((current) => current.map((item, i) => (i === index ? event.target.value : item)))}
                    rows={2}
                    className="input field-sizing-content h-auto min-h-16 resize-y py-2 font-mono text-sm"
                  />
                  {step.trim() && <MathText text={step} className="text-ink-900 mt-2 text-sm" />}
                </li>
              ))}
            </ol>
            {problem("steps") && <p className="field-error">{problem("steps")}</p>}
            {steps.length < 40 && (
              <button type="button" onClick={() => setSteps((current) => [...current, ""])} className="btn-secondary mt-3">
                <PlusIcon className="h-4 w-4" />
                {copy.addStep}
              </button>
            )}
          </div>
        </Section>

        <Section title={copy.sourceHeading}>
          <p className="text-ink-500 text-sm">{copy.sourceNote}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell id={fid.origin} label={copy.origin}>
              <Select id={fid.origin} value={origin} onChange={setOrigin} options={QUESTION_ORIGINS.map((value) => ({ value, label: t.questions.origins[value] }))} />
            </FieldShell>
            <FieldShell id={sid.verification} label={copy.verification} error={problem("verification")}>
              <Select id={sid.verification} value={verification} onChange={setVerification} options={VERIFICATIONS.map((value) => ({ value, label: t.questions.verification[value] }))} />
            </FieldShell>
            <div className="sm:col-span-2">
              <FieldShell id={sid.source} label={copy.source} error={problem("source")} optional>
                <input id={sid.source} value={source} maxLength={500} placeholder={copy.sourcePlaceholder} onChange={(event) => setSource(event.target.value)} className="input" />
              </FieldShell>
            </div>
            <FieldShell id={sid.sOrigin} label={copy.solutionOrigin}>
              <Select id={sid.sOrigin} value={solutionOrigin} onChange={setSolutionOrigin} options={SOLUTION_ORIGINS.map((value) => ({ value, label: t.questions.solutionOrigins[value] }))} />
            </FieldShell>
            <FieldShell id={sid.sVerification} label={copy.solutionVerification} error={problem("solutionVerification")}>
              <Select
                id={sid.sVerification}
                value={solutionVerification}
                onChange={setSolutionVerification}
                options={VERIFICATIONS.map((value) => ({ value, label: t.questions.verification[value] }))}
              />
            </FieldShell>
            <div className="sm:col-span-2">
              <FieldShell id={sid.sSource} label={copy.solutionSource} error={problem("solutionSource")} optional>
                <input id={sid.sSource} value={solutionSource} maxLength={500} onChange={(event) => setSolutionSource(event.target.value)} className="input" />
              </FieldShell>
            </div>
          </div>
        </Section>

        {submitError && (
          <p role="alert" className="bg-danger-bg text-danger-fg rounded-md px-4 py-3 text-sm font-medium">
            {submitError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          {editing && (
            <button type="button" onClick={remove} className="btn-ghost text-danger-fg sm:mr-auto">
              <TrashIcon className="h-4 w-4" />
              {copy.delete}
            </button>
          )}
          <Link to="/bacii/admin/questions" className="btn-ghost sm:ml-auto">
            {copy.cancel}
          </Link>
          <button type="submit" disabled={saving || uploading} className="btn-primary sm:min-w-40">
            {saving ? copy.saving : copy.save}
          </button>
        </div>
      </form>
    </div>
  );
}
