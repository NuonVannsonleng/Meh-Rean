import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import { FieldShell, TextField } from "../components/FormField";
import { CameraIcon, LockIcon, LogOutIcon, PaletteIcon, TrashIcon, UserIcon } from "../components/Icons";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { resizeAvatar } from "../lib/image";
import { validateDisplayName, validateEmail, validateNewPassword, validateUsername } from "../lib/validation";
import { changePassword, deleteAccount, updateProfile } from "../services/api";
import type { UpdateProfileInput, User } from "../types";

type ProfileErrors = Partial<Record<keyof UpdateProfileInput | "submit", string>>;

function Section({
  id,
  icon,
  title,
  body,
  children,
  tone = "default",
}: {
  id: string;
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card animate-rise scroll-mt-24 p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            tone === "danger" ? "bg-danger-bg text-danger-fg" : "bg-brand-50 text-accent"
          }`}
        >
          {icon}
        </span>
        <div>
          <h2 id={`${id}-title`} className="text-ink-900 text-lg font-semibold">
            {title}
          </h2>
          <p className="text-ink-500 text-sm">{body}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const { notify } = useToast();
  const bioId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<UpdateProfileInput>({
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    bio: user.bio,
    school: user.school,
    country: user.country,
    fieldOfStudy: user.fieldOfStudy,
    avatarUrl: user.avatarUrl,
  });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof UpdateProfileInput>(key: K, value: UpdateProfileInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, submit: undefined }));
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((current) => ({ ...current, avatarUrl: t.settings.avatarError }));
      return;
    }
    try {
      set("avatarUrl", await resizeAvatar(file));
    } catch {
      setErrors((current) => ({ ...current, avatarUrl: t.settings.avatarError }));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: ProfileErrors = {
      displayName: validateDisplayName(values.displayName),
      username: validateUsername(values.username),
      email: validateEmail(values.email),
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSaving(true);
    try {
      setUser(await updateProfile(values));
      notify(t.settings.profileSaved);
    } catch (error) {
      const code = errorCode(error);
      if (code === "EMAIL_TAKEN") setErrors({ email: errorMessage(error) });
      else if (code === "USERNAME_TAKEN") setErrors({ username: errorMessage(error) });
      else setErrors({ submit: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <fieldset>
        <legend className="field-label">{t.settings.avatarLabel}</legend>
        <div className="flex items-center gap-4">
          <Avatar user={{ id: user.id, displayName: values.displayName || user.displayName, avatarUrl: values.avatarUrl }} size="lg" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary h-10">
              <CameraIcon className="h-4 w-4" />
              {t.settings.avatarChange}
            </button>
            {values.avatarUrl && (
              <button type="button" onClick={() => set("avatarUrl", null)} className="btn-ghost h-10">
                {t.settings.avatarRemove}
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              pickAvatar(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        {errors.avatarUrl && <p className="field-error">{errors.avatarUrl}</p>}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t.auth.displayNameLabel}
          value={values.displayName}
          onChange={(value) => set("displayName", value)}
          autoComplete="name"
          error={errors.displayName}
        />
        <TextField
          label={t.auth.usernameLabel}
          value={values.username}
          onChange={(value) => set("username", value.toLowerCase().replace(/\s/g, ""))}
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          error={errors.username}
        />
      </div>
      <TextField
        label={t.auth.emailLabel}
        type="email"
        value={values.email}
        onChange={(value) => set("email", value)}
        autoComplete="email"
        error={errors.email}
      />
      <FieldShell id={bioId} label={t.settings.bioLabel} optional>
        <textarea
          id={bioId}
          value={values.bio}
          onChange={(event) => set("bio", event.target.value)}
          placeholder={t.settings.bioPlaceholder}
          rows={3}
          maxLength={280}
          className="input field-sizing-content h-auto min-h-24 resize-y py-3"
        />
      </FieldShell>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t.settings.schoolLabel}
          value={values.school}
          onChange={(value) => set("school", value)}
          placeholder={t.settings.schoolPlaceholder}
          optional
        />
        <TextField
          label={t.settings.fieldLabel}
          value={values.fieldOfStudy}
          onChange={(value) => set("fieldOfStudy", value)}
          placeholder={t.settings.fieldPlaceholder}
          optional
        />
      </div>
      <TextField
        label={t.settings.countryLabel}
        value={values.country}
        onChange={(value) => set("country", value)}
        placeholder={t.settings.countryPlaceholder}
        autoComplete="country-name"
        optional
      />

      {errors.submit && (
        <p role="alert" className="bg-danger-bg text-danger-fg rounded-xl px-4 py-3 text-sm font-medium">
          {errors.submit}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t.common.saving : t.common.save}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { notify } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = {
      current: current ? undefined : t.validation.required(t.settings.currentPassword),
      next: validateNewPassword(next),
      confirm: next === confirm ? undefined : t.validation.passwordMatch,
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setSaving(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      notify(t.settings.passwordChanged);
    } catch (error) {
      setErrors({ current: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <TextField
        label={t.settings.currentPassword}
        type="password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        error={errors.current}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t.settings.newPassword}
          type="password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint={t.auth.passwordHint}
          error={errors.next}
        />
        <TextField
          label={t.settings.confirmPassword}
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={errors.confirm}
        />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t.common.saving : t.settings.changePassword}
        </button>
      </div>
    </form>
  );
}

function AccountActions() {
  const { signOut, setUser } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    notify(t.nav.signedOut);
    navigate("/");
  };

  const handleDelete = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError(t.validation.required(t.auth.passwordLabel));
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(password);
      setUser(null);
      // Full reload so nothing from the deleted session is left in memory.
      window.location.replace("/");
    } catch (caught) {
      setError(errorMessage(caught));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-ink-700 text-sm">{t.settings.signOutBody}</p>
        <button type="button" onClick={handleSignOut} className="btn-secondary">
          <LogOutIcon className="h-4 w-4" />
          {t.nav.signOut}
        </button>
      </div>

      <form onSubmit={handleDelete} noValidate className="border-danger-fg/30 bg-danger-bg/40 space-y-4 rounded-xl border p-4">
        <div>
          <h3 className="text-danger-fg font-semibold">{t.settings.deleteHeading}</h3>
          <p className="text-ink-700 mt-1 text-sm">{t.settings.deleteBody}</p>
        </div>
        <TextField
          label={t.settings.deleteConfirmLabel}
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setError(undefined);
          }}
          autoComplete="current-password"
          error={error}
        />
        <button type="submit" disabled={deleting} className="btn-danger w-full sm:w-auto">
          <TrashIcon className="h-4 w-4" />
          {deleting ? t.settings.deleting : t.settings.deleteAction}
        </button>
      </form>
    </div>
  );
}

const sections = [
  { id: "profile", label: t.settings.profileHeading, Icon: UserIcon },
  { id: "appearance", label: t.settings.appearanceHeading, Icon: PaletteIcon },
  { id: "password", label: t.settings.passwordHeading, Icon: LockIcon },
  { id: "account", label: t.settings.dangerHeading, Icon: LogOutIcon },
];

export default function Settings() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="container-page max-w-5xl py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-ink-900 text-2xl font-display font-extrabold tracking-tight sm:text-3xl">{t.settings.title}</h1>
        <p className="text-ink-500 mt-2">{t.settings.subtitle}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label={t.settings.sectionsLabel} className="hidden lg:block">
          <ul className="sticky top-24 space-y-1">
            {sections.map(({ id, label, Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="press text-ink-700 hover:bg-surface hover:text-ink-900 flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section id="profile" icon={<UserIcon />} title={t.settings.profileHeading} body={t.settings.profileBody}>
            <ProfileForm key={user.id} user={user} />
          </Section>
          <Section id="appearance" icon={<PaletteIcon />} title={t.settings.appearanceHeading} body={t.settings.appearanceBody}>
            <ThemeSwitcher showLegend />
            <p className="field-hint">{t.theme.description}</p>
          </Section>
          <Section id="password" icon={<LockIcon />} title={t.settings.passwordHeading} body={t.settings.passwordBody}>
            <PasswordForm />
          </Section>
          <Section
            id="account"
            icon={<LogOutIcon />}
            title={t.settings.dangerHeading}
            body={t.settings.accountBody}
            tone="danger"
          >
            <AccountActions />
          </Section>
        </div>
      </div>
    </div>
  );
}
