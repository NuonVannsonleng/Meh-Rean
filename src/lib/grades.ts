// Grade estimates for mock exams (roadmap 2.5). The bands are data
// (src/data/grade-scale.json) so they can be replaced without code changes;
// until a source is recorded they are a practice setting, never an official
// result.

export interface GradeBand {
  grade: string;
  minPercent: number;
}

export interface GradeScale {
  id: string;
  verification: "provisional" | "verified";
  source: string | null;
  note: string;
  bands: GradeBand[];
}

export interface GradeEstimate {
  grade: string;
  /** Exact percentage, 0–100. */
  percent: number;
  /** The next grade up and the whole points still needed for it; null at the top. */
  next: { grade: string; pointsNeeded: number } | null;
}

/** Problems with a scale; empty when it can be used. */
export function checkGradeScale(scale: GradeScale): string[] {
  const problems: string[] = [];
  const { bands } = scale;
  if (!bands.length) return ["no bands"];
  const grades = new Set<string>();
  bands.forEach((band, index) => {
    if (!band.grade.trim()) problems.push(`band ${index + 1} has no grade`);
    if (grades.has(band.grade)) problems.push(`grade ${band.grade} appears twice`);
    grades.add(band.grade);
    if (!(band.minPercent >= 0 && band.minPercent <= 100)) problems.push(`${band.grade}: minimum must be 0–100`);
    if (index > 0 && band.minPercent >= bands[index - 1].minPercent) problems.push(`${band.grade}: bands must go from highest to lowest`);
  });
  if (bands[bands.length - 1].minPercent !== 0) problems.push("the lowest band must start at 0");
  if (scale.verification === "verified" && !scale.source?.trim()) problems.push("a verified scale needs a source");
  return problems;
}

/** Estimate a grade from points; null when nothing was marked (max 0). */
export function estimateGrade(score: number, max: number, scale: GradeScale): GradeEstimate | null {
  if (!(max > 0) || !(score >= 0)) return null;
  const percent = Math.min(100, (score / max) * 100);
  // Small tolerance so 9 / 10 counts as exactly 90%, whatever floating point says.
  const reaches = (band: GradeBand) => percent + 1e-9 >= band.minPercent;
  const index = scale.bands.findIndex(reaches);
  const band = scale.bands[index === -1 ? scale.bands.length - 1 : index];
  const above = index > 0 ? scale.bands[index - 1] : null;
  const next = above ? { grade: above.grade, pointsNeeded: Math.max(1, Math.ceil((above.minPercent / 100) * max - score - 1e-9)) } : null;
  return { grade: band.grade, percent, next };
}

/** "66.6%": one decimal, never rounded up, so it cannot show 90% under a B. */
export function formatPercent(percent: number): string {
  const tenths = Math.floor(percent * 10 + 1e-9) / 10;
  return `${Number.isInteger(tenths) ? tenths : tenths.toFixed(1)}%`;
}
