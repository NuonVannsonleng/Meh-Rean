import { t } from "../i18n/en";
import { formatDate } from "../lib/format";
import type { TopicMastery } from "../lib/mastery";
import MasteryBadge from "./MasteryBadge";

const copy = t.learning.mastery;

/**
 * One topic's estimate (Learning OS 3.5): the label, a 0–100 bar, how sure it
 * is, and how it changed. No answers, or too few, says so instead of a number.
 */
export default function MasteryMeter({ mastery, history = [], labelAfter }: { mastery: TopicMastery | undefined; history?: { correct: boolean; score: number }[]; labelAfter: number }) {
  if (!mastery || mastery.score === null) return <MasteryBadge label="unknown" />;
  const labelled = mastery.label !== "unknown";
  const recent = history.slice(-12);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <MasteryBadge label={mastery.label} />
        {labelled && <span className="text-ink-900 font-display text-lg font-bold tabular-nums">{copy.score(mastery.score)}</span>}
        <span className="text-ink-500 text-xs">{copy.confidence[mastery.confidenceLevel]}</span>
      </div>
      {labelled ? (
        <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={mastery.score} aria-label={copy.meterLabel(mastery.score, copy.labels[mastery.label])} className="bg-surface-hover mt-2 h-2 overflow-hidden rounded-full">
          <div className="bg-brand-600 h-full rounded-full" style={{ width: `${mastery.score}%`, opacity: mastery.confidenceLevel === "low" ? 0.5 : 1 }} />
        </div>
      ) : (
        <p className="text-ink-700 mt-1 text-sm">{copy.labelAfter(labelAfter - mastery.evidence)}</p>
      )}
      <p className="text-ink-700 mt-1.5 text-sm">{copy.basedOn(mastery.evidence, mastery.correct)}</p>
      {mastery.lastAt && <p className="text-ink-500 text-xs">{copy.lastPractised(formatDate(mastery.lastAt))}</p>}
      {labelled && recent.length > 1 && (
        <div className="mt-3">
          <p className="text-ink-700 mb-1 text-xs font-semibold">{copy.history}</p>
          <ol className="flex h-10 items-end gap-1" aria-label={copy.history}>
            {recent.map((step, index) => (
              <li key={index} title={copy.historyStep(history.length - recent.length + index + 1, step.correct, step.score)} className="flex h-full w-3 items-end">
                <span className="sr-only">{copy.historyStep(history.length - recent.length + index + 1, step.correct, step.score)}</span>
                <span aria-hidden="true" className={`block w-full rounded-sm ${step.correct ? "bg-brand-500" : "bg-ribbon-500"}`} style={{ height: `${Math.max(8, step.score)}%` }} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
