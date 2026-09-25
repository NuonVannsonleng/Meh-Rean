import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import { FieldShell, TextField } from "../components/FormField";
import InstitutionPicker from "../components/InstitutionPicker";
import { CameraIcon, CheckIcon, CloseIcon, LockIcon, LogOutIcon, PaletteIcon, TrashIcon, UserIcon } from "../components/Icons";
import ImageCropper from "../components/ImageCropper";
import VerifiedBadge from "../components/VerifiedBadge";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { gradeOptions, selectionFromProfile, type InstitutionSelection } from "../lib/institutions";
import { validateDisplayName, validateEmail, validateNewPassword, validateUsername } from "../lib/validation";
import {
  changePassword,
  decideVerification,
  deleteAccount,
  getMyVerification,
  getVerificationRequests,
  requestVerification,
  updateProfile,
  uploadProfileImage,
} from "../services/api";
import type {
  ProfileImageKind,
  UpdateProfileInput,
  User,
  VerificationRequest,
  VerificationStatus,
} from "../types";
import { formatDate } from "../lib/format";

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
  const gradeId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<UpdateProfileInput>({
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    bio: user.bio,
    school: user.school,
    schoolDomain: user.schoolDomain,
    schoolCountry: user.schoolCountry,
    grade: user.grade,
    country: user.country,
    fieldOfStudy: user.fieldOfStudy,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
  });
  const [school, setSchool] = useState<InstitutionSelection | null>(() => selectionFromProfile(user));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [cropping, setCropping] = useState<{ file: File; kind: ProfileImageKind } | null>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof UpdateProfileInput>(key: K, value: UpdateProfileInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, submit: undefined }));
  };

  const pickSchool = (selection: InstitutionSelection) => {
    setSchool(selection);
    const grades = gradeOptions(selection.kind);
    setValues((current) => ({
      ...current,
      school: selection.name,
      schoolDomain: selection.domain,
      schoolCountry: selection.country,
      // Years and grades differ per kind, so a stale pick is dropped.
      grade: current.grade && grades.includes(current.grade) ? current.grade : null,
      // Only a guess, and only while the student hasn't said where they are.
      country: current.country.trim() || selection.country || "",
    }));
    setErrors((current) => ({ ...current, school: undefined, submit: undefined }));
  };

  const pickImage = (file: File | undefined, kind: ProfileImageKind) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((current) => ({ ...current, avatarUrl: t.settings.avatarError }));
      return;
    }
    setErrors((current) => ({ ...current, avatarUrl: undefined }));
    setCropping({ file, kind });
  };

  const applyCrop = async (dataUrl: string) => {
    const kind = cropping?.kind ?? "avatar";
    setCropping(null);
    try {
      const url = await uploadProfileImage(kind, dataUrl);
      set(kind === "avatar" ? "avatarUrl" : "bannerUrl", url);
    } catch (error) {
      setErrors((current) => ({ ...current, submit: errorMessage(error) }));
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
        <legend className="field-label">{t.settings.bannerLabel}</legend>
        <div
          className={`border-line relative mb-3 h-28 overflow-hidden rounded-xl border sm:h-36 ${
            values.bannerUrl ? "" : "bg-brand-50 ruled-paper"
          }`}
        >
          {values.bannerUrl && <img src={values.bannerUrl} alt="" className="h-full w-full object-cover" />}
          <div className="absolute right-2 bottom-2 flex gap-2">
            {values.bannerUrl && (
              <button
                type="button"
                onClick={() => set("bannerUrl", null)}
                className="btn-secondary h-9 px-3 text-xs"
              >
                {t.settings.avatarRemove}
              </button>
            )}
            <button type="button" onClick={() => bannerRef.current?.click()} className="btn-secondary h-9 px-3 text-xs">
              <CameraIcon className="h-4 w-4" />
              {t.settings.bannerChange}
            </button>
          </div>
        </div>
        <p className="field-hint mb-5">{t.settings.bannerHint}</p>
        <input
          ref={bannerRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            pickImage(event.target.files?.[0], "banner");
            event.target.value = "";
          }}
        />
      </fieldset>

      {cropping && (
        <ImageCropper
          file={cropping.file}
          kind={cropping.kind}
          onCancel={() => setCropping(null)}
          onDone={applyCrop}
        />
      )}

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
              pickImage(event.target.files?.[0], "avatar");
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
        <InstitutionPicker label={t.institution.label} value={school} onChange={pickSchool} optional />
        <FieldShell id={gradeId} label={t.institution.gradeLabel} optional>
          <select
            id={gradeId}
            value={values.grade ?? ""}
            onChange={(event) => set("grade", event.target.value || null)}
            className="input cursor-pointer"
          >
            <option value="">{t.institution.gradePlaceholder}</option>
            {gradeOptions(school?.kind ?? "university").map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </FieldShell>
      </div>
      <TextField
        label={t.settings.fieldLabel}
        value={values.fieldOfStudy}
        onChange={(value) => set("fieldOfStudy", value)}
        placeholder={t.settings.fieldPlaceholder}
        optional
      />
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

function VerificationPanel({ user }: { user: User }) {
  const { notify } = useToast();
  const reasonId = useId();
  const [status, setStatus] = useState<VerificationStatus>(user.verified ? "approved" : "none");
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getMyVerification()
      .then((state) => {
        setStatus(state.status);
        setRequestedAt(state.request?.createdAt ?? null);
      })
      .catch(() => setStatus(user.verified ? "approved" : "none"));
  }, [user.verified]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 10) {
      setError(t.verification.reasonHint);
      return;
    }
    setSending(true);
    setError(undefined);
    try {
      const created = await requestVerification({ reason, link });
      setStatus("pending");
      setRequestedAt(created.createdAt);
      setReason("");
      setLink("");
      notify(t.verification.sent);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  };

  if (status === "approved") {
    return (
      <p className="text-ink-700 flex items-center gap-2 text-sm">
        <VerifiedBadge className="h-5 w-5" />
        {t.verification.statusApproved}
      </p>
    );
  }

  if (status === "pending") {
    return (
      <div className="bg-surface-muted border-line rounded-xl border p-4">
        <p className="text-ink-900 text-sm font-semibold">{t.verification.statusPending}</p>
        {requestedAt && <p className="text-ink-500 mt-1 text-sm">{t.verification.requestedOn(formatDate(requestedAt))}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {status === "rejected" && (
        <p className="text-ink-700 bg-surface-muted border-line rounded-xl border px-4 py-3 text-sm">
          {t.verification.statusRejected}
        </p>
      )}
      <FieldShell id={reasonId} label={t.verification.reasonLabel} hint={t.verification.reasonHint} error={error}>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError(undefined);
          }}
          placeholder={t.verification.reasonPlaceholder}
          rows={3}
          maxLength={1000}
          aria-invalid={error ? true : undefined}
          className="input field-sizing-content h-auto min-h-24 resize-y py-3"
        />
      </FieldShell>
      <TextField
        label={t.verification.linkLabel}
        value={link}
        onChange={setLink}
        placeholder={t.verification.linkPlaceholder}
        optional
      />
      <div className="flex justify-end">
        <button type="submit" disabled={sending} className="btn-primary">
          {sending ? t.verification.submitting : t.verification.submit}
        </button>
      </div>
    </form>
  );
}

function VerificationQueue() {
  const { notify } = useToast();
  const [requests, setRequests] = useState<VerificationRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    getVerificationRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  }, []);

  useEffect(load, [load]);

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await decideVerification(id, approve);
      setRequests((current) => current?.filter((request) => request.id !== id) ?? null);
      notify(approve ? t.verification.approved : t.verification.rejected);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  if (requests === null) return <p className="text-ink-500 text-sm">{t.common.loading}</p>;
  if (!requests.length) return <p className="text-ink-500 text-sm">{t.verification.queueEmpty}</p>;

  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <li key={request.id} className="border-line animate-fade rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <Avatar user={request.user} />
            <div className="min-w-0 flex-1">
              <p className="text-ink-900 truncate text-sm font-semibold">{request.user.displayName}</p>
              <p className="text-ink-500 truncate text-sm">@{request.user.username}</p>
            </div>
            <time className="text-ink-500 shrink-0 text-xs">{formatDate(request.createdAt)}</time>
          </div>
          <p className="text-ink-700 mt-3 text-sm whitespace-pre-line">{request.reason}</p>
          <p className="text-ink-500 mt-1 text-sm break-all">{request.link || t.verification.noLink}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy === request.id}
              onClick={() => decide(request.id, true)}
              className="btn-primary h-10 flex-1 sm:flex-none"
            >
              <CheckIcon className="h-4 w-4" />
              {t.verification.approve}
            </button>
            <button
              type="button"
              disabled={busy === request.id}
              onClick={() => decide(request.id, false)}
              className="btn-secondary h-10 flex-1 sm:flex-none"
            >
              <CloseIcon className="h-4 w-4" />
              {t.verification.reject}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

const sections = [
  { id: "profile", label: t.settings.profileHeading, Icon: UserIcon },
  { id: "verification", label: t.verification.heading, Icon: CheckIcon },
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
          <Section id="verification" icon={<CheckIcon />} title={t.verification.heading} body={t.verification.body}>
            <VerificationPanel user={user} />
          </Section>
          {user.isAdmin && (
            <Section
              id="queue"
              icon={<VerifiedBadge className="h-5 w-5" />}
              title={t.verification.queueHeading}
              body={t.verification.queueBody}
            >
              <VerificationQueue />
            </Section>
          )}
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
