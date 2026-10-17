import { t } from "../i18n/en";
import type { MasteryLabel } from "../lib/mastery";

export const MASTERY_LABELS: MasteryLabel[] = ["unknown", "needs-foundation", "developing", "practising", "strong", "consistently-strong"];

export const MASTERY_STYLE: Record<MasteryLabel, string> = {
  unknown: "bg-surface-hover text-ink-700",
  "needs-foundation": "bg-ribbon-100 text-ribbon-fg",
  developing: "bg-ribbon-50 text-ribbon-fg",
  practising: "bg-brand-50 text-accent",
  strong: "bg-brand-100 text-accent",
  "consistently-strong": "bg-brand-600 text-white",
};

/** A topic's mastery label (Learning OS 3.5) — always an estimate from the student's own answers. */
export default function MasteryBadge({ label }: { label: MasteryLabel }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${MASTERY_STYLE[label]}`}>{t.learning.mastery.labels[label]}</span>;
}
