import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import { describedBy, FieldShell, TextField } from "../components/FormField";
import { CloseIcon, PaperclipIcon, UploadIcon } from "../components/Icons";
import { AttachmentIcon } from "../components/PostAttachments";
import RadioGroup from "../components/RadioGroup";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";
import { detectAttachmentKind, MAX_FILE_BYTES, MAX_FILES_PER_POST } from "../lib/attachments";
import { errorMessage } from "../lib/errors";
import { fileExtension, formatFileSize } from "../lib/format";
import { createPost } from "../services/api";
import { EDUCATION_LEVELS, SUBJECTS, type EducationLevel, type Subject } from "../types";

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
    <li className="border-line bg-surface animate-pop flex items-center gap-3 rounded-xl border p-2.5">
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
  const [subject, setSubject] = useState<Subject | "">("");
  const [level, setLevel] = useState<EducationLevel>("university");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const parsedTags = useMemo(() => parseTags(tags), [tags]);

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
    <div className="container-page max-w-2xl py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-ink-900 text-2xl font-display font-extrabold tracking-tight sm:text-3xl">{t.create.title}</h1>
        <p className="text-ink-500 mt-2">{t.create.subtitle}</p>
      </header>

      <form onSubmit={submit} noValidate className="card space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Avatar user={user} />
          <div>
            <p className="text-ink-900 text-sm font-semibold">{user.displayName}</p>
            <p className="text-ink-500 text-sm">@{user.username}</p>
          </div>
        </div>

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

        <div className="grid gap-6 sm:grid-cols-2">
          <FieldShell id={subjectId} label={t.create.subjectLabel} error={errors.subject}>
            <select
              id={subjectId}
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value as Subject);
                setErrors((current) => ({ ...current, subject: undefined }));
              }}
              aria-invalid={errors.subject ? true : undefined}
              aria-describedby={describedBy(subjectId, errors.subject)}
              className="input cursor-pointer"
            >
              <option value="" disabled>
                {t.create.subjectPlaceholder}
              </option>
              {SUBJECTS.map((value) => (
                <option key={value} value={value}>
                  {t.subjects[value]}
                </option>
              ))}
            </select>
          </FieldShell>

          <TextField
            label={t.create.tagsLabel}
            value={tags}
            onChange={setTags}
            placeholder={t.create.tagsPlaceholder}
            hint={t.create.tagsHint}
            optional
          />
        </div>

        <RadioGroup
          name="level"
          legend={t.create.levelLabel}
          options={EDUCATION_LEVELS.map((value) => ({ value, label: t.levels[value] }))}
          value={level}
          onChange={setLevel}
        />

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
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors duration-200 ${
              dragging
                ? "border-brand-500 bg-brand-50"
                : errors.files || errors.content
                  ? "border-danger-fg"
                  : "border-line bg-surface-muted/60"
            }`}
          >
            <span className="bg-brand-50 text-accent flex h-12 w-12 items-center justify-center rounded-full">
              <UploadIcon className="h-6 w-6" />
            </span>
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

        {errors.submit && (
          <p role="alert" className="bg-danger-bg text-danger-fg rounded-xl px-4 py-3 text-sm font-medium">
            {errors.submit}
          </p>
        )}

        <div className="border-line flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
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
