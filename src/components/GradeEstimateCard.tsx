import gradeScale from "../data/grade-scale.json";
import { t } from "../i18n/en";
import { estimateGrade, formatPercent, type GradeScale } from "../lib/grades";

const scale = gradeScale as GradeScale;
const copy = t.bacii.estimate;

/** The grade letter for a score, or null when nothing was marked. */
export function gradeFor(score: number | null, max: number | null): string | null {
  if (score === null || max === null) return null;
  return estimateGrade(score, max, scale)?.grade ?? null;
}

/** Grade estimate for a mock exam result (roadmap 2.5). Always labelled as practice. */
export default function GradeEstimateCard({ score, max, unmarked }: { score: number; max: number; unmarked: number }) {
  const estimate = estimateGrade(score, max, scale);
  const official = scale.verification === "verified" && Boolean(scale.source);

  return (
    <section className="card mb-5 p-5 sm:p-6" aria-labelledby="grade-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="grade-title" className="font-display text-ink-900 text-lg font-bold">
          {copy.title}
        </h2>
        {!official && <span className="bg-ribbon-50 text-ribbon-fg rounded-full px-2 py-0.5 text-xs font-semibold">{copy.practiceLabel}</span>}
      </div>

      {estimate ? (
        <>
          <div className="mt-3 flex items-center gap-4">
            <p className="font-display text-accent bg-brand-50 flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-4xl font-bold" aria-label={`${copy.title}: ${estimate.grade}`}>
              {estimate.grade}
            </p>
            <div className="min-w-0">
              <p className="text-ink-900 text-xl font-bold tabular-nums">
                {formatPercent(estimate.percent)}
                <span className="text-ink-500 block text-xs font-normal">{copy.percentLabel}</span>
              </p>
              <p className="text-ink-700 text-sm">{estimate.next ? copy.nextGrade(estimate.next.pointsNeeded, estimate.next.grade) : copy.topGrade}</p>
            </div>
          </div>
          {unmarked > 0 && <p className="text-ink-700 mt-3 text-sm">{copy.onlyMarked(unmarked)}</p>}
        </>
      ) : (
        <p className="text-ink-700 mt-3 text-sm">{copy.none}</p>
      )}

      {!official && <p className="text-ink-500 mt-3 text-xs">{copy.notOfficial}</p>}
      <details className="mt-3 text-sm">
        <summary className="text-ink-700 hover:text-ink-900 cursor-pointer font-medium">{copy.howTitle}</summary>
        <ul className="text-ink-700 mt-2 grid gap-1 sm:grid-cols-2">
          {scale.bands.map((band, index) => (
            <li key={band.grade} className={estimate?.grade === band.grade ? "text-ink-900 font-semibold" : undefined}>
              {copy.band(band.grade, band.minPercent, index === 0 ? null : scale.bands[index - 1].minPercent)}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
