// Daily question and streak (roadmap 3.3). The database does the same in
// daily_question() and daily_streak(); these mirror it for the browser-only
// store.

/** Days follow Cambodia's clock (UTC+7, no daylight saving). */
const CAMBODIA_OFFSET_MS = 7 * 3_600_000;

/** "2026-10-13": the date in Phnom Penh at this moment. */
export function cambodiaDay(at: Date): string {
  return new Date(at.getTime() + CAMBODIA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The day before or after, as "YYYY-MM-DD". */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface ChapterScore {
  chapterId: string;
  answered: number;
  correct: number;
}

/**
 * The weakest of these chapters: lowest (correct + 1) / (answered + 2), so a
 * chapter never tried counts as half right and a known weakness comes first.
 * Ties go to the chapter with more answers, then to `random`.
 */
export function weakestChapter(chapterIds: string[], scores: ChapterScore[], random: () => number = Math.random): { chapterId: string; fromResults: boolean } | null {
  if (!chapterIds.length) return null;
  const of = new Map(scores.map((score) => [score.chapterId, score]));
  const ranked = chapterIds
    .map((chapterId) => {
      const score = of.get(chapterId);
      const answered = score?.answered ?? 0;
      return { chapterId, answered, rate: ((score?.correct ?? 0) + 1) / (answered + 2), tie: random() };
    })
    .sort((a, b) => a.rate - b.rate || b.answered - a.answered || a.tie - b.tie);
  return { chapterId: ranked[0].chapterId, fromResults: ranked[0].answered > 0 };
}

export interface Streak {
  current: number;
  best: number;
  answeredToday: boolean;
}

/** Days in a row with the daily question answered, back from today (or yesterday while today's is open). */
export function streakOf(answeredDays: string[], today: string): Streak {
  const days = [...new Set(answeredDays)].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  const runEnds = new Map<string, number>();
  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    runEnds.set(day, run);
    previous = day;
  }
  const last = days[days.length - 1];
  const current = last && (last === today || last === addDays(today, -1)) ? (runEnds.get(last) ?? 0) : 0;
  return { current, best, answeredToday: last === today };
}
