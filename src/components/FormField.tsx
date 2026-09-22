import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { t } from "../i18n/en";
import { EyeIcon, EyeOffIcon } from "./Icons";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}

/** Label + control + hint/error wiring shared by every form field. */
export function FieldShell({ id, label, hint, error, optional, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {optional && <span className="text-ink-400 ml-1 font-normal">({t.common.optional})</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "onChange" | "value"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  optional?: boolean;
}

export function TextField({ label, value, onChange, hint, error, optional, type = "text", ...rest }: TextFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <div className="relative">
        <input
          {...rest}
          id={id}
          type={isPassword && visible ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={`input ${isPassword ? "pr-12" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? t.auth.hidePassword : t.auth.showPassword}
            aria-pressed={visible}
            className="icon-btn absolute inset-y-0 right-1 my-auto"
          >
            {visible ? <EyeOffIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
          </button>
        )}
      </div>
    </FieldShell>
  );
}
