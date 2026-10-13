import { t } from "../i18n/en";
import type { Verification } from "../types";
import { CheckIcon } from "./Icons";

const STYLE: Record<Verification, string> = {
  verified: "bg-brand-50 text-accent",
  provisional: "bg-surface-hover text-ink-700",
  "needs-review": "bg-danger-bg text-danger-fg",
};

/** How far a question, solution or curriculum entry has been checked. */
export default function VerificationBadge({ value, label }: { value: Verification; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STYLE[value]}`}>
      {value === "verified" && <CheckIcon className="h-3 w-3" />}
      {label ? `${label}: ` : ""}
      {t.questions.verification[value]}
    </span>
  );
}
