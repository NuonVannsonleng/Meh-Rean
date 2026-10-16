import { t } from "../i18n/en";
import type { TopicStatus } from "../lib/learningProfile";

export const STATUS_STYLE: Record<TopicStatus, string> = {
  unknown: "bg-surface-hover text-ink-700",
  "work-on": "bg-ribbon-50 text-ribbon-fg",
  practising: "bg-brand-50 text-accent",
  "going-well": "bg-brand-600 text-white",
};

/** How a student is doing on a topic, from their own answers — always an estimate. */
export default function TopicStatusBadge({ status }: { status: TopicStatus }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}>{t.learning.status[status]}</span>;
}
