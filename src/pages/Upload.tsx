import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import RadioGroup, { type RadioOption } from "../components/RadioGroup";
import { CheckIcon, UploadIcon } from "../components/Icons";
import { t } from "../i18n/en";
import {
  createCourse,
  createInstitution,
  createResource,
  getCourses,
  getInstitutions,
} from "../services/api";
import {
  SCHOOL_GRADES,
  UNIVERSITY_YEARS,
  type CourseWithCount,
  type Institution,
  type InstitutionKind,
  type ResourceType,
} from "../types";

/** Sentinel value for the "not in the list" option of a select. */
const NEW = "__new__";

const typeOptions: RadioOption<ResourceType>[] = [
  { value: "note", label: t.upload.typeOptions.note },
  { value: "paper", label: t.upload.typeOptions.paper },
  { value: "slide", label: t.upload.typeOptions.slide },
];

const kindOptions: RadioOption<InstitutionKind>[] = [
  { value: "school", label: t.upload.institutionKindOptions.school },
  { value: "university", label: t.upload.institutionKindOptions.university },
];

const semesterOptions: RadioOption<number>[] = [1, 2].map((semester) => ({
  value: semester,
  label: t.upload.semester(semester),
}));

function levelOptionsFor(kind: InstitutionKind): RadioOption<number>[] {
  const levels = kind === "school" ? SCHOOL_GRADES : UNIVERSITY_YEARS;
  return levels.map((level) => ({
    value: level,
    label: t.level.label(kind, level),
  }));
}

function defaultLevelFor(kind: InstitutionKind): number {
  return kind === "school" ? 7 : 1;
}

interface FormValues {
  institutionId: string;
  newInstitutionKind: InstitutionKind | "";
  newInstitutionName: string;
  courseId: string;
  newCourseCode: string;
  newCourseName: string;
  newCourseInstructor: string;
  newCourseLevel: number;
  newCourseSemester: 1 | 2;
  type: ResourceType | "";
  title: string;
  file: File | null;
}

type FormErrors = Partial<Record<keyof FormValues | "submit", string>>;

const emptyForm: FormValues = {
  institutionId: "",
  newInstitutionKind: "",
  newInstitutionName: "",
  courseId: "",
  newCourseCode: "",
  newCourseName: "",
  newCourseInstructor: "",
  newCourseLevel: 1,
  newCourseSemester: 1,
  type: "",
  title: "",
  file: null,
};

interface SuccessSummary {
  courseLabel: string;
  institutionLabel: string;
  /** Only set when an existing course was chosen — new ones are not persisted. */
  courseId: string | null;
}

const fieldBase =
  "bg-surface text-ink-900 placeholder:text-ink-400 h-12 w-full rounded-xl border px-3.5 text-base transition-[border-color,box-shadow] duration-200 outline-none";

/** Border colour is swapped, never stacked, so the error state always wins. */
function fieldClass(hasError: boolean): string {
  return (
    fieldBase +
    (hasError
      ? " border-danger-fg bg-danger-bg"
      : " border-line focus:border-brand-500 focus:shadow-[0_0_0_4px_var(--color-brand-100)]")
  );
}

const primaryButton =
  "bg-brand-600 hover:bg-brand-700 active:bg-brand-800 press inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white";

const secondaryButton =
  "border-line text-ink-700 hover:border-brand-300 hover:text-brand-700 press inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-semibold";

const labelClass = "text-ink-900 mb-1.5 block text-sm font-semibold";
const errorClass = "text-danger-fg animate-fade mt-1.5 text-sm font-medium";

function validate(
  values: FormValues,
  isNewInstitution: boolean,
  isNewCourse: boolean,
): FormErrors {
  const errors: FormErrors = {};

  if (!values.institutionId) {
    errors.institutionId = t.upload.errors.institution;
  } else if (isNewInstitution) {
    if (!values.newInstitutionKind) {
      errors.newInstitutionKind = t.upload.errors.institutionKind;
    }
    if (!values.newInstitutionName.trim()) {
      errors.newInstitutionName = t.upload.errors.institutionName;
    }
  }

  if (values.institutionId && !isNewInstitution && !values.courseId) {
    errors.courseId = t.upload.errors.course;
  }

  if (isNewCourse) {
    if (!values.newCourseCode.trim())
      errors.newCourseCode = t.upload.errors.courseCode;
    if (!values.newCourseName.trim())
      errors.newCourseName = t.upload.errors.courseName;
    if (!values.newCourseInstructor.trim())
      errors.newCourseInstructor = t.upload.errors.instructor;
  }

  if (!values.type) errors.type = t.upload.errors.type;

  if (!values.title.trim()) {
    errors.title = t.upload.errors.title;
  } else if (values.title.trim().length < 4) {
    errors.title = t.upload.errors.titleTooShort;
  }

  if (!values.file) errors.file = t.upload.errors.file;

  return errors;
}

export default function Upload() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [courses, setCourses] = useState<CourseWithCount[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const institutionFieldId = useId();
  const kindGroupId = useId();
  const institutionNameFieldId = useId();
  const courseFieldId = useId();
  const codeFieldId = useId();
  const nameFieldId = useId();
  const instructorFieldId = useId();
  const typeGroupId = useId();
  const titleFieldId = useId();
  const fileFieldId = useId();

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setHasLoadError(false);
    try {
      const [loadedInstitutions, loadedCourses] = await Promise.all([
        getInstitutions(),
        getCourses(),
      ]);
      setInstitutions(loadedInstitutions);
      setCourses(loadedCourses);
    } catch {
      setHasLoadError(true);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const isNewInstitution = values.institutionId === NEW;

  const chosenInstitution = useMemo(
    () => institutions.find((item) => item.id === values.institutionId),
    [institutions, values.institutionId],
  );

  /** Drives every grade-vs-year label and option in the form. */
  const kind: InstitutionKind | "" = isNewInstitution
    ? values.newInstitutionKind
    : (chosenInstitution?.kind ?? "");

  const schools = useMemo(
    () => institutions.filter((item) => item.kind === "school"),
    [institutions],
  );
  const universities = useMemo(
    () => institutions.filter((item) => item.kind === "university"),
    [institutions],
  );

  const coursesForInstitution = useMemo(
    () =>
      isNewInstitution || !values.institutionId
        ? []
        : courses.filter(
            (course) => course.institutionId === values.institutionId,
          ),
    [courses, values.institutionId, isNewInstitution],
  );

  // A brand new institution can only ever have a brand new course
  const isNewCourse = isNewInstitution || values.courseId === NEW;

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({
      ...previous,
      [key]: undefined,
      submit: undefined,
    }));
  }

  const handleInstitutionChange = (institutionId: string) => {
    const nextKind =
      institutions.find((item) => item.id === institutionId)?.kind ?? "";
    setValues((previous) => ({
      ...previous,
      institutionId,
      courseId: "",
      newInstitutionKind: institutionId === NEW ? previous.newInstitutionKind : "",
      newInstitutionName: institutionId === NEW ? previous.newInstitutionName : "",
      newCourseLevel: nextKind ? defaultLevelFor(nextKind) : previous.newCourseLevel,
    }));
    setErrors((previous) => ({
      ...previous,
      institutionId: undefined,
      courseId: undefined,
      submit: undefined,
    }));
  };

  /** Switching school↔university must move the level into the valid range. */
  const handleKindChange = (nextKind: InstitutionKind) => {
    setValues((previous) => ({
      ...previous,
      newInstitutionKind: nextKind,
      newCourseLevel: defaultLevelFor(nextKind),
    }));
    setErrors((previous) => ({
      ...previous,
      newInstitutionKind: undefined,
      submit: undefined,
    }));
  };

  const resetForm = () => {
    setValues(emptyForm);
    setErrors({});
    setSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values, isNewInstitution, isNewCourse);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !values.file || !values.type) {
      return;
    }

    setIsSubmitting(true);
    try {
      let institutionId = values.institutionId;
      let institutionLabel = chosenInstitution?.name ?? "";

      if (isNewInstitution && values.newInstitutionKind) {
        const created = await createInstitution({
          name: values.newInstitutionName,
          kind: values.newInstitutionKind,
        });
        institutionId = created.id;
        institutionLabel = created.name;
      }

      let courseId = values.courseId;
      let courseLabel = "";
      let existingCourseId: string | null = null;

      if (isNewCourse) {
        const created = await createCourse({
          institutionId,
          code: values.newCourseCode,
          name: values.newCourseName,
          level: values.newCourseLevel,
          semester: values.newCourseSemester,
          instructor: values.newCourseInstructor,
        });
        courseId = created.id;
        courseLabel = `${created.code} — ${created.name}`;
      } else {
        const chosen = coursesForInstitution.find(
          (course) => course.id === courseId,
        );
        courseLabel = chosen ? `${chosen.code} — ${chosen.name}` : "";
        existingCourseId = courseId;
      }

      await createResource({
        courseId,
        title: values.title,
        type: values.type,
        fileName: values.file.name,
      });

      setSuccess({ courseLabel, institutionLabel, courseId: existingCourseId });
    } catch {
      setErrors({ submit: t.upload.errors.submit });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container-page max-w-2xl py-10 sm:py-14">
        <div className="animate-rise border-line bg-surface rounded-2xl border p-6 text-center shadow-xs sm:p-10">
          <span className="bg-success-bg text-success-fg animate-check mx-auto flex h-14 w-14 items-center justify-center rounded-full">
            <CheckIcon className="h-7 w-7" />
          </span>
          <h1 className="text-ink-900 mt-4 text-2xl font-bold tracking-tight">
            {t.upload.success.title}
          </h1>
          <p className="text-ink-700 mt-2 text-sm font-medium">
            {t.upload.success.summary(
              success.courseLabel,
              success.institutionLabel,
            )}
          </p>
          <p className="text-ink-500 mt-3 text-sm">
            {success.courseId
              ? t.upload.success.body
              : t.upload.success.newCourseBody}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={resetForm} className={primaryButton}>
              {t.upload.success.uploadAnother}
            </button>
            {success.courseId ? (
              <Link
                to={`/courses/${success.courseId}`}
                className={secondaryButton}
              >
                {t.upload.success.viewCourse}
              </Link>
            ) : (
              <Link to="/" className={secondaryButton}>
                {t.upload.success.backToCourses}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const fileDescribedBy = errors.file
    ? `${fileFieldId}-hint ${fileFieldId}-error`
    : `${fileFieldId}-hint`;

  return (
    <div className="container-page max-w-2xl py-6 sm:py-10">
      <header className="animate-rise">
        <h1 className="text-ink-900 text-2xl font-bold tracking-tight sm:text-3xl">
          {t.upload.title}
        </h1>
        <p className="text-ink-700 mt-2 text-sm sm:text-base">
          {t.upload.subtitle}
        </p>
      </header>

      <p
        className="border-line bg-surface text-ink-500 animate-rise mt-5 rounded-xl border border-dashed px-4 py-3 text-sm"
        style={{ animationDelay: "60ms" }}
      >
        <span className="bg-surface-muted text-ink-700 mr-2 rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wider uppercase">
          {t.common.prototypeBadge}
        </span>
        {t.upload.prototypeNotice}
      </p>

      {isLoadingData && (
        <div className="mt-6">
          <LoadingState variant="row" count={3} />
        </div>
      )}

      {!isLoadingData && hasLoadError && (
        <div className="mt-6">
          <ErrorState onRetry={() => void loadData()} />
        </div>
      )}

      {!isLoadingData && !hasLoadError && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="animate-rise mt-6 space-y-6"
          style={{ animationDelay: "120ms" }}
        >
          {/* --- Where the resource comes from --- */}
          <fieldset className="border-line bg-surface space-y-6 rounded-2xl border p-5 shadow-xs sm:p-7">
            <legend className="text-ink-500 px-1 text-xs font-semibold tracking-wide uppercase">
              {t.upload.stepCourse}
            </legend>

            <div>
              <label htmlFor={institutionFieldId} className={labelClass}>
                {t.upload.institutionLabel}
              </label>
              <select
                id={institutionFieldId}
                value={values.institutionId}
                onChange={(event) =>
                  handleInstitutionChange(event.target.value)
                }
                aria-invalid={Boolean(errors.institutionId)}
                aria-describedby={
                  errors.institutionId
                    ? `${institutionFieldId}-error`
                    : undefined
                }
                className={fieldClass(Boolean(errors.institutionId))}
              >
                <option value="">{t.upload.institutionPlaceholder}</option>
                <optgroup label={t.upload.institutionGroupSchools}>
                  {schools.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.shortName})
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t.upload.institutionGroupUniversities}>
                  {universities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.shortName})
                    </option>
                  ))}
                </optgroup>
                <option value={NEW}>{t.upload.institutionOther}</option>
              </select>
              {errors.institutionId && (
                <p
                  id={`${institutionFieldId}-error`}
                  className={errorClass}
                >
                  {errors.institutionId}
                </p>
              )}
            </div>

            {isNewInstitution && (
              <div className="animate-rise space-y-6">
                <RadioGroup
                  name="institution-kind"
                  legend={t.upload.institutionKindLabel}
                  options={kindOptions}
                  value={values.newInstitutionKind}
                  onChange={handleKindChange}
                  error={errors.newInstitutionKind}
                  errorId={`${kindGroupId}-error`}
                />

                <div>
                  <label htmlFor={institutionNameFieldId} className={labelClass}>
                    {t.upload.institutionNameLabel}
                  </label>
                  <input
                    id={institutionNameFieldId}
                    type="text"
                    value={values.newInstitutionName}
                    onChange={(event) =>
                      update("newInstitutionName", event.target.value)
                    }
                    placeholder={t.upload.institutionNamePlaceholder}
                    aria-invalid={Boolean(errors.newInstitutionName)}
                    aria-describedby={
                      errors.newInstitutionName
                        ? `${institutionNameFieldId}-error`
                        : undefined
                    }
                    className={fieldClass(Boolean(errors.newInstitutionName))}
                  />
                  {errors.newInstitutionName && (
                    <p
                      id={`${institutionNameFieldId}-error`}
                      className={errorClass}
                    >
                      {errors.newInstitutionName}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!isNewInstitution && (
              <div>
                <label htmlFor={courseFieldId} className={labelClass}>
                  {t.upload.courseLabel}
                </label>
                <select
                  id={courseFieldId}
                  value={values.courseId}
                  onChange={(event) => update("courseId", event.target.value)}
                  disabled={!values.institutionId}
                  aria-invalid={Boolean(errors.courseId)}
                  aria-describedby={
                    errors.courseId ? `${courseFieldId}-error` : undefined
                  }
                  className={`${fieldClass(Boolean(errors.courseId))} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <option value="">{t.upload.coursePlaceholder}</option>
                  {coursesForInstitution.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} — {course.name}
                    </option>
                  ))}
                  <option value={NEW}>{t.upload.courseOther}</option>
                </select>
                {values.institutionId &&
                  coursesForInstitution.length === 0 && (
                    <p className="text-ink-500 animate-fade mt-1.5 text-sm">
                      {t.upload.courseEmpty}
                    </p>
                  )}
                {errors.courseId && (
                  <p id={`${courseFieldId}-error`} className={errorClass}>
                    {errors.courseId}
                  </p>
                )}
              </div>
            )}

            {isNewCourse && kind !== "" && (
              <div className="animate-rise border-line space-y-6 rounded-xl border border-dashed p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={codeFieldId} className={labelClass}>
                      {t.upload.courseCodeLabel}
                    </label>
                    <input
                      id={codeFieldId}
                      type="text"
                      value={values.newCourseCode}
                      onChange={(event) =>
                        update("newCourseCode", event.target.value)
                      }
                      placeholder={t.upload.courseCodePlaceholder}
                      aria-invalid={Boolean(errors.newCourseCode)}
                      aria-describedby={
                        errors.newCourseCode ? `${codeFieldId}-error` : undefined
                      }
                      className={fieldClass(Boolean(errors.newCourseCode))}
                    />
                    {errors.newCourseCode && (
                      <p id={`${codeFieldId}-error`} className={errorClass}>
                        {errors.newCourseCode}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={nameFieldId} className={labelClass}>
                      {t.upload.courseNameLabel}
                    </label>
                    <input
                      id={nameFieldId}
                      type="text"
                      value={values.newCourseName}
                      onChange={(event) =>
                        update("newCourseName", event.target.value)
                      }
                      placeholder={t.upload.courseNamePlaceholder}
                      aria-invalid={Boolean(errors.newCourseName)}
                      aria-describedby={
                        errors.newCourseName ? `${nameFieldId}-error` : undefined
                      }
                      className={fieldClass(Boolean(errors.newCourseName))}
                    />
                    {errors.newCourseName && (
                      <p id={`${nameFieldId}-error`} className={errorClass}>
                        {errors.newCourseName}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor={instructorFieldId} className={labelClass}>
                    {t.upload.instructorLabel(kind)}
                  </label>
                  <input
                    id={instructorFieldId}
                    type="text"
                    value={values.newCourseInstructor}
                    onChange={(event) =>
                      update("newCourseInstructor", event.target.value)
                    }
                    placeholder={t.upload.instructorPlaceholder(kind)}
                    aria-invalid={Boolean(errors.newCourseInstructor)}
                    aria-describedby={
                      errors.newCourseInstructor
                        ? `${instructorFieldId}-error`
                        : undefined
                    }
                    className={fieldClass(Boolean(errors.newCourseInstructor))}
                  />
                  {errors.newCourseInstructor && (
                    <p id={`${instructorFieldId}-error`} className={errorClass}>
                      {errors.newCourseInstructor}
                    </p>
                  )}
                </div>

                <RadioGroup
                  name="course-level"
                  legend={
                    kind === "school"
                      ? t.upload.gradeLabel
                      : t.upload.yearLabel
                  }
                  options={levelOptionsFor(kind)}
                  value={values.newCourseLevel}
                  onChange={(level) => update("newCourseLevel", level)}
                  variant="chip"
                />

                <RadioGroup
                  name="course-semester"
                  legend={t.upload.semesterLabel}
                  options={semesterOptions}
                  value={values.newCourseSemester}
                  onChange={(semester) =>
                    update("newCourseSemester", semester === 2 ? 2 : 1)
                  }
                  variant="chip"
                />
              </div>
            )}
          </fieldset>

          {/* --- What is being shared --- */}
          <fieldset className="border-line bg-surface space-y-6 rounded-2xl border p-5 shadow-xs sm:p-7">
            <legend className="text-ink-500 px-1 text-xs font-semibold tracking-wide uppercase">
              {t.upload.stepResource}
            </legend>

            <RadioGroup
              name="resource-type"
              legend={t.upload.typeLabel}
              options={typeOptions}
              value={values.type}
              onChange={(type) => update("type", type)}
              error={errors.type}
              errorId={`${typeGroupId}-error`}
            />

            <div>
              <label htmlFor={titleFieldId} className={labelClass}>
                {t.upload.titleLabel}
              </label>
              <input
                id={titleFieldId}
                type="text"
                value={values.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder={t.upload.titlePlaceholder}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={
                  errors.title ? `${titleFieldId}-error` : undefined
                }
                className={fieldClass(Boolean(errors.title))}
              />
              {errors.title && (
                <p id={`${titleFieldId}-error`} className={errorClass}>
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={fileFieldId} className={labelClass}>
                {t.upload.fileLabel}
              </label>
              <input
                ref={fileInputRef}
                id={fileFieldId}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg"
                onChange={(event) =>
                  update("file", event.target.files?.[0] ?? null)
                }
                aria-invalid={Boolean(errors.file)}
                aria-describedby={fileDescribedBy}
                className={
                  "text-ink-700 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 w-full cursor-pointer rounded-xl border px-3.5 py-3 text-sm transition-colors duration-200 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-semibold " +
                  (errors.file ? "border-danger-fg bg-danger-bg" : "border-line")
                }
              />
              <p
                id={`${fileFieldId}-hint`}
                className="text-ink-500 mt-1.5 text-sm"
              >
                {t.upload.fileHint}
              </p>
              {errors.file && (
                <p id={`${fileFieldId}-error`} className={errorClass}>
                  {errors.file}
                </p>
              )}
            </div>

            {errors.submit && (
              <p
                role="alert"
                className="text-danger-fg animate-fade text-sm font-medium"
              >
                {errors.submit}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 press inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <UploadIcon
                className={`h-4 w-4 ${isSubmitting ? "animate-bounce" : ""}`}
              />
              {isSubmitting ? t.upload.submitting : t.upload.submit}
            </button>
          </fieldset>
        </form>
      )}
    </div>
  );
}
