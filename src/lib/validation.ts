import { t } from "../i18n/en";

export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return t.validation.required(t.auth.emailLabel);
  return EMAIL_PATTERN.test(value.trim()) ? undefined : t.validation.email;
}

export function validateUsername(value: string): string | undefined {
  if (!value.trim()) return t.validation.required(t.auth.usernameLabel);
  return USERNAME_PATTERN.test(value.trim().toLowerCase()) ? undefined : t.validation.username;
}

export function validateDisplayName(value: string): string | undefined {
  if (!value.trim()) return t.validation.required(t.auth.displayNameLabel);
  return value.trim().length < 2 ? t.validation.nameLength : undefined;
}

export function validateNewPassword(value: string): string | undefined {
  return value.length < 8 ? t.validation.passwordLength : undefined;
}

/** Turns "Sokha Chan" into a username suggestion like "sokha.chan". */
export function suggestUsername(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 20);
}

/** Only allow in-app redirects after sign-in. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
