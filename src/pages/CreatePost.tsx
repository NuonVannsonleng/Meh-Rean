import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import { describedBy, FieldShell, TextField } from "../components/FormField";
import { ChevronDownIcon, CloseIcon, PaperclipIcon, UploadIcon } from "../components/Icons";
import InstitutionPicker from "../components/InstitutionPicker";
import { AttachmentIcon } from "../components/PostAttachments";
import RadioGroup from "../components/RadioGroup";
import SubjectPicker from "../components/SubjectPicker";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";
import { detectAttachmentKind, MAX_FILE_BYTES, MAX_FILES_PER_POST } from "../lib/attachments";
import { errorMessage } from "../lib/errors";
import { fileExtension, formatFileSize } from "../lib/format";
import { selectionFromProfile, type InstitutionSelection } from "../lib/institutions";
import { isMainSubject, SUBJECT_COLORS, subjectColor, subjectLabel } from "../lib/subjects";
import { createPost } from "../services/api";
import { EDUCATION_LEVELS, SUBJECTS, type EducationLevel, type InstitutionKind } from "../types";

/** High schools for high school notes; universities for university and postgraduate ones. */
function kindForLevel(level: EducationLevel): InstitutionKind {
  return level === "high-school" ? "high-school" : "university";
}

interface FormErrors {
  title?: string;
  subject?: string;
  content?: string;
  files?: string;
  submit?: string;
}

interface PickedFile {
  key: string;
  file: File;
  previewUrl: string | null;
}

const MAX_TAGS = 5;

function parseTags(value: string): string[] {
  const tags = value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

function FilePreview({ picked, onRemove }: { picked: PickedFile; onRemove: () => void }) {
  const { file, previewUrl } = picked;
  const kind = detectAttachmentKind(file.type, file.name);

  return (
    <li className="border-line bg-surface animate-pop flex items-center gap-3 rounded-md border p-2.5">
      {previewUrl && kind === "image" ? (
        <img src={previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      ) : previewUrl && kind === "video" ? (
        <video src={previewUrl} muted preload="metadata" className="h-12 w-12 shrink-0 rounded-lg bg-black object-cover" />
      ) : (
        <AttachmentIcon kind={kind} className="h-12 w-12" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-ink-900 truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className={`text-xs ${file.size > MAX_FILE_BYTES ? "text-danger-fg font-medium" : "text-ink-500"}`}>
          {[fileExtension(file.name) || t.post.kinds[kind], formatFileSize(file.size)].join(" · ")}
        </p>
      </div>
      <button type="button" onClick={onRemove} aria-label={t.create.removeFile(file.name)} className="icon-btn">
        <CloseIcon className="h-4 w-4" />
      </button>
    </li>
  );
}

export default function CreatePost() {
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const subjectId = useId();
  const bodyId = useId();
  const filesId = useId();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [pickingSubject, setPickingSubject] = useState(false);
  // The student's own school is the first guess for where a note is from.
  const [school, setSchool] = useState<InstitutionSelection | null>(() => (user ? selectionFromProfile(user) : null));
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [level, setLevel] = useState<EducationLevel>(() => (school?.kind === "high-school" ? "high-school" : "university"));
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const parsedTags = useMemo(() => parseTags(tags), [tags]);
  // A subject from the full list (or "other") shows on the Other chip.
  const pickedMore = Boolean(subject) && (!isMainSubject(subject) || subject === "other");

  // Revoke preview URLs when files are removed or the page unmounts.
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(
    () => () => filesRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl)),
    [],
  );

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list).map((file) => {
      const kind = detectAttachmentKind(file.type, file.name);
      return {
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : null,
      };
    });
    setFiles((current) => [...current, ...incoming]);
    setErrors((current) => ({ ...current, files: undefined, content: undefined }));
  };

  const removeFile = (key: string) => {
    setFiles((current) => {
      const target = current.find((item) => item.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.key !== key);
    });
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!title.trim()) next.title = t.create.errors.title;
    else if (title.trim().length < 4) next.title = t.create.errors.titleShort;
    if (!subject) next.subject = t.create.errors.subject;
    if (!body.trim() && files.length === 0) next.content = t.create.errors.content;
    if (files.length > MAX_FILES_PER_POST) next.files = t.create.errors.tooManyFiles;
    const tooLarge = files.find((item) => item.file.size > MAX_FILE_BYTES);
    if (tooLarge) next.files = t.create.errors.fileTooLarge(tooLarge.file.name);
    return next;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !subject) {
      const first = event.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const post = await createPost({
        title,
        body,
        subject,
        level,
        school: level === "self-study" ? null : (school?.name ?? null),
        schoolDomain: level === "self-study" ? null : (school?.domain ?? null),
        tags: parsedTags,
        files: files.map((item) => item.file),
      });
      notify(t.create.success);
      navigate(`/post/${post.id}`);
    } catch (error) {
      setErrors({ submit: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container-page max-w-3xl py-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3">
        <Avatar user={user} size="lg" />
        <div>
          <h1 className="text-ink-900 text-2xl sm:text-3xl">{t.create.title}</h1>
          <p className="text-ink-500 mt-0.5 text-sm">{t.create.subtitle}</p>
        </div>
      </header>

      <form onSubmit={submit} noValidate className="card space-y-6 p-4 sm:p-6">
        <TextField
          label={t.create.titleLabel}
          value={title}
          onChange={(value) => {
            setTitle(value);
            if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
          }}
          placeholder={t.create.titlePlaceholder}
          maxLength={140}
          error={errors.title}
        />

        <FieldShell id={bodyId} label={t.create.bodyLabel} error={errors.content}>
          <textarea
            id={bodyId}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              if (errors.content) setErrors((current) => ({ ...current, content: undefined }));
            }}
            placeholder={t.create.bodyPlaceholder}
            rows={5}
            maxLength={5000}
            aria-invalid={errors.content ? true : undefined}
            aria-describedby={describedBy(bodyId, errors.content)}
            className="input field-sizing-content h-auto min-h-32 resize-y py-3 leading-relaxed"
          />
        </FieldShell>

        {/* Subjects as one-tap chips in their colours, like the home page filter. */}
        <fieldset aria-describedby={errors.subject ? `${subjectId}-error` : undefined}>
          <legend className="field-label">{t.create.subjectLabel}</legend>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.filter((value) => value !== "other").map((value) => {
              const active = subject === value;
              return (
                <label
                  key={value}
                  className={`press inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
                    active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 hover:border-ink-400"
                  }`}
                >
                  <input
                    type="radio"
                    name={subjectId}
                    value={value}
                    checked={active}
                    onChange={() => {
                      setSubject(value);
                      setErrors((current) => ({ ...current, subject: undefined }));
                    }}
                    className="sr-only"
                  />
                  <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70" style={{ backgroundColor: SUBJECT_COLORS[value] }} />
                  {t.subjects[value]}
                </label>
              );
            })}
            {/* "Other" opens every specific subject, searchable; the chip then shows the pick. */}
            <button
              type="button"
              onClick={() => setPickingSubject(true)}
              aria-haspopup="dialog"
              aria-pressed={pickedMore}
              className={`press inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
                pickedMore ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-700 border-dashed hover:border-ink-400"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-white/70"
                style={{ backgroundColor: pickedMore ? subjectColor(subject) : SUBJECT_COLORS.other }}
              />
              {pickedMore ? subjectLabel(subject) : t.create.subjectOther}
              <ChevronDownIcon className="h-3.5 w-3.5 opacity-70" />
            </button>
          </div>
          {errors.subject && (
            <p id={`${subjectId}-error`} className="field-error">
              {errors.subject}
            </p>
          )}
        </fieldset>

        <TextField
          label={t.create.tagsLabel}
          value={tags}
          onChange={setTags}
          placeholder={t.create.tagsPlaceholder}
          hint={t.create.tagsHint}
          optional
        />

        <RadioGroup
          name="level"
          legend={t.create.levelLabel}
          options={EDUCATION_LEVELS.map((value) => ({ value, label: t.levels[value] }))}
          value={level}
          onChange={(next) => {
            setLevel(next);
            if (next === "self-study") return;
            // Tapping a level opens the matching school search, unless the
            // school already picked (or the student's own) is the right kind.
            if (school?.kind !== kindForLevel(next)) {
              setSchool(null);
              setSchoolOpen(true);
            }
          }}
        />

        {level !== "self-study" && (
          <InstitutionPicker
            label={level === "high-school" ? t.create.schoolLabel : t.create.universityLabel}
            placeholder={level === "high-school" ? t.create.schoolPlaceholder : t.create.universityPlaceholder}
            hint={t.create.schoolHint}
            kind={kindForLevel(level)}
            value={school}
            onChange={(selection) => {
              setSchool(selection);
              // Picking a high school while on University (or the other way) moves the level too.
              if (selection.kind === "high-school") setLevel("high-school");
              else if (level === "high-school") setLevel("university");
            }}
            open={schoolOpen}
            onOpenChange={setSchoolOpen}
            optional
          />
        )}

        {/* Files */}
        <div>
          <p id={`${filesId}-label`} className="field-label">
            {t.create.filesHeading}
          </p>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors duration-200 ${
              dragging
                ? "border-brand-500 bg-brand-50"
                : errors.files || errors.content
                  ? "border-danger-fg"
                  : "border-line bg-surface-muted/60"
            }`}
          >
            <UploadIcon className="text-ink-500 h-7 w-7" />
            <p className="text-ink-900 hidden text-sm font-semibold sm:block">{t.create.dropTitle}</p>
            <p className="text-ink-500 hidden text-sm sm:block">{t.create.dropOr}</p>
            <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">
              <PaperclipIcon className="h-4 w-4" />
              {t.create.browse}
            </button>
            <p id={`${filesId}-hint`} className="text-ink-500 max-w-sm text-xs leading-relaxed">
              {t.create.dropHint}
            </p>
            <input
              ref={inputRef}
              id={filesId}
              type="file"
              multiple
              aria-labelledby={`${filesId}-label`}
              aria-describedby={`${filesId}-hint`}
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
          {errors.files && <p className="field-error">{errors.files}</p>}
          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((item) => (
                <FilePreview key={item.key} picked={item} onRemove={() => removeFile(item.key)} />
              ))}
            </ul>
          )}
        </div>

        {pickingSubject && (
          <SubjectPicker
            value={subject}
            onSelect={(id) => {
              setSubject(id);
              setErrors((current) => ({ ...current, subject: undefined }));
            }}
            onClose={() => setPickingSubject(false)}
          />
        )}

        {errors.submit && (
          <p role="alert" className="bg-danger-bg text-danger-fg rounded-md px-4 py-3 text-sm font-medium">
            {errors.submit}
          </p>
        )}

        <div className="border-line flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
          <p className="text-ink-500 mr-auto hidden self-center text-xs sm:block">{t.create.publicNote}</p>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={submitting} className="btn-primary sm:min-w-36">
            {submitting ? t.create.submitting : t.create.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
