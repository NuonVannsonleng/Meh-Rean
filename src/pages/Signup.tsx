import { useId, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { describedBy, FieldShell, TextField } from "../components/FormField";
import InstitutionPicker from "../components/InstitutionPicker";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { gradeOptions, type InstitutionSelection } from "../lib/institutions";
import {
  safeNext,
  suggestUsername,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
  validateUsername,
} from "../lib/validation";

interface SignupErrors {
  displayName?: string;
  username?: string;
  email?: string;
  password?: string;
  school?: string;
  grade?: string;
  submit?: string;
}

export default function Signup() {
  const { user, signUp } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState<InstitutionSelection | null>(null);
  const [grade, setGrade] = useState("");
  const [major, setMajor] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const gradeId = useId();
  const majorId = useId();
  const majorListId = useId();

  if (user && !submitting) return <Navigate to={next} replace />;

  const grades = gradeOptions(school?.kind ?? "university");

  const clear = (field: keyof SignupErrors) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: SignupErrors = {
      displayName: validateDisplayName(displayName),
      username: validateUsername(username),
      email: validateEmail(email),
      password: validateNewPassword(password),
      school: school ? undefined : t.validation.school,
      grade: grade ? undefined : t.validation.grade,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      const created = await signUp({
        displayName,
        username,
        email,
        password,
        school: school?.name ?? "",
        schoolDomain: school?.domain ?? null,
        schoolCountry: school?.country ?? null,
        grade,
        fieldOfStudy: major,
      });
      notify(t.auth.welcome(created.displayName.split(" ")[0]));
      navigate(next === "/" ? "/settings" : next, { replace: true });
    } catch (error) {
      const code = errorCode(error);
      if (code === "EMAIL_CONFIRMATION") setConfirmationSent(true);
      else if (code === "EMAIL_TAKEN") setErrors({ email: errorMessage(error) });
      else if (code === "USERNAME_TAKEN") setErrors({ username: errorMessage(error) });
      else setErrors({ submit: errorMessage(error) });
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t.auth.signUpTitle}
      subtitle={t.auth.signUpSubtitle}
      footer={
        <>
          {t.auth.haveAccount}{" "}
          <Link to={`/login${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">
            {t.auth.signInLink}
          </Link>
        </>
      }
    >
      {confirmationSent && (
        <p role="status" className="bg-success-bg text-success-fg animate-fade mb-5 rounded-xl px-4 py-3 text-sm font-medium">
          {t.apiErrors.EMAIL_CONFIRMATION}
        </p>
      )}

      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField
          label={t.auth.displayNameLabel}
          value={displayName}
          onChange={(value) => {
            setDisplayName(value);
            if (!usernameEdited) setUsername(suggestUsername(value));
            clear("displayName");
          }}
          placeholder={t.auth.displayNamePlaceholder}
          autoComplete="name"
          error={errors.displayName}
        />
        <TextField
          label={t.auth.usernameLabel}
          value={username}
          onChange={(value) => {
            setUsername(value.toLowerCase().replace(/\s/g, ""));
            setUsernameEdited(true);
            clear("username");
          }}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          hint={t.auth.usernameHint}
          error={errors.username}
        />
        <TextField
          label={t.auth.emailLabel}
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            clear("email");
          }}
          autoComplete="email"
          inputMode="email"
          error={errors.email}
        />
        <TextField
          label={t.auth.passwordLabel}
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            clear("password");
          }}
          autoComplete="new-password"
          hint={t.auth.passwordHint}
          error={errors.password}
        />
        <InstitutionPicker
          label={t.institution.label}
          value={school}
          onChange={(value) => {
            setSchool(value);
            // Years and grades differ per kind, so a stale pick is dropped.
            if (!gradeOptions(value.kind).includes(grade)) setGrade("");
            clear("school");
          }}
          error={errors.school}
        />
        <FieldShell id={gradeId} label={t.institution.gradeLabel} error={errors.grade}>
          <select
            id={gradeId}
            value={grade}
            onChange={(event) => {
              setGrade(event.target.value);
              clear("grade");
            }}
            aria-invalid={errors.grade ? true : undefined}
            aria-describedby={describedBy(gradeId, errors.grade)}
            className="input cursor-pointer"
          >
            <option value="" disabled>
              {t.institution.gradePlaceholder}
            </option>
            {grades.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell id={majorId} label={t.institution.majorLabel} optional>
          <input
            id={majorId}
            type="text"
            value={major}
            onChange={(event) => setMajor(event.target.value)}
            placeholder={t.institution.majorPlaceholder}
            list={majorListId}
            autoComplete="off"
            className="input"
          />
          <datalist id={majorListId}>
            {t.institution.majorSuggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </FieldShell>

        {errors.submit && (
          <p role="alert" className="bg-danger-bg text-danger-fg animate-fade rounded-xl px-4 py-3 text-sm font-medium">
            {errors.submit}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t.auth.submittingSignUp : t.auth.submitSignUp}
        </button>
      </form>
    </AuthLayout>
  );
}
