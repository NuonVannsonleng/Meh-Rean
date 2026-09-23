import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { TextField } from "../components/FormField";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";
import { errorMessage } from "../lib/errors";
import { safeNext } from "../lib/validation";
import { DEMO_ACCOUNT, isLocalMode } from "../services/api";

interface LoginErrors {
  identifier?: string;
  password?: string;
  submit?: string;
}

export default function Login() {
  const { user, signIn } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) return <Navigate to={next} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: LoginErrors = {};
    if (!identifier.trim()) found.identifier = t.validation.required(isLocalMode ? t.auth.identifierLabel : t.auth.emailLabel);
    if (!password) found.password = t.validation.required(t.auth.passwordLabel);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const signedIn = await signIn({ email: identifier, password });
      notify(t.auth.welcomeBack(signedIn.displayName.split(" ")[0]));
      navigate(next, { replace: true });
    } catch (error) {
      setErrors({ submit: errorMessage(error) });
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={t.auth.signInTitle}
      subtitle={t.auth.signInSubtitle}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link to={`/signup${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">
            {t.auth.createOne}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField
          label={isLocalMode ? t.auth.identifierLabel : t.auth.emailLabel}
          type={isLocalMode ? "text" : "email"}
          inputMode="email"
          hint={isLocalMode ? undefined : t.auth.emailOnlyHint}
          value={identifier}
          onChange={setIdentifier}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={errors.identifier}
        />
        <TextField
          label={t.auth.passwordLabel}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={errors.password}
        />

        {errors.submit && (
          <p role="alert" className="bg-danger-bg text-danger-fg animate-fade rounded-xl px-4 py-3 text-sm font-medium">
            {errors.submit}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? t.auth.submittingSignIn : t.auth.submitSignIn}
        </button>
      </form>

      {isLocalMode && (
      <div className="bg-surface-muted border-line mt-6 rounded-xl border p-4">
        <p className="text-ink-900 text-sm font-semibold">{t.auth.demoTitle}</p>
        <p className="text-ink-500 mt-1 text-sm">{t.auth.demoBody(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password)}</p>
        <button
          type="button"
          onClick={() => {
            setIdentifier(DEMO_ACCOUNT.email);
            setPassword(DEMO_ACCOUNT.password);
            setErrors({});
          }}
          className="link mt-2 text-sm"
        >
          {t.auth.demoAction}
        </button>
      </div>
      )}
    </AuthLayout>
  );
}
