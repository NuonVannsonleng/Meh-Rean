import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { TextField } from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
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
  const [errors, setErrors] = useState<SignupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (user && !submitting) return <Navigate to={next} replace />;

  const clear = (field: keyof SignupErrors) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: SignupErrors = {
      displayName: validateDisplayName(displayName),
      username: validateUsername(username),
      email: validateEmail(email),
      password: validateNewPassword(password),
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      const created = await signUp({ displayName, username, email, password });
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
