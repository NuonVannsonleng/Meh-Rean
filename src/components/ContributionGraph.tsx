import { useMemo } from "react";
import { t } from "../i18n/en";

/** Days shown: 53 weeks, ending today. */
const WEEKS = 53;
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short" });
const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Five steps of the brand green, from empty to busiest. */
const LEVELS = [
  "var(--color-surface-hover)",
  "var(--color-brand-200)",
  "var(--color-brand-400)",
  "var(--color-brand-600)",
  "var(--color-brand-800)",
];

function level(count: number, max: number): number {
  if (!count) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / Math.max(max, 1)) * 4)));
}

/**
 * A year of a student's uploads, one square per day, like a code host's
 * contribution calendar: the steadier the green, the steadier the studying.
 */
export default function ContributionGraph({ dates }: { dates: string[] }) {
  const { weeks, total, months, max } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const iso of dates) {
      const key = dayKey(new Date(iso));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    // Start on the Sunday 52 weeks before this week's Sunday.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);

    const grid: { date: Date; count: number; future: boolean }[][] = [];
    const labels: { week: number; label: string }[] = [];
    let sum = 0;
    let busiest = 0;
    for (let week = 0; week < WEEKS; week += 1) {
      const column = [];
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + week * 7 + day);
        const future = date > today;
        const count = future ? 0 : (counts.get(dayKey(date)) ?? 0);
        sum += count;
        busiest = Math.max(busiest, count);
        column.push({ date, count, future });
        // A month label above the first week that starts in that month.
        if (day === 0 && date.getDate() <= 7) labels.push({ week, label: monthFormat.format(date) });
      }
      grid.push(column);
    }
    return { weeks: grid, total: sum, months: labels, max: busiest };
  }, [dates]);

  const cell = 11;
  const gap = 3;
  const left = 28;
  const top = 16;

  return (
    <section aria-labelledby="contributions-title">
      <h2 id="contributions-title" className="text-ink-900 mb-2 text-base font-normal">
        {t.profile.contributions(total)}
      </h2>
      <div className="card overflow-x-auto p-4">
        <svg
          // Room on the right for the last month's label.
          width={left + WEEKS * (cell + gap) + 16}
          height={top + 7 * (cell + gap)}
          role="img"
          aria-label={t.profile.contributions(total)}
          className="block"
        >
          {months.map(({ week, label }) => (
            <text key={`${week}-${label}`} x={left + week * (cell + gap)} y={10} fontSize={10} fill="var(--color-ink-500)">
              {label}
            </text>
          ))}
          {[1, 3, 5].map((day) => (
            <text key={day} x={0} y={top + day * (cell + gap) + 9} fontSize={9} fill="var(--color-ink-500)">
              {t.profile.weekdays[day]}
            </text>
          ))}
          {weeks.map((column, week) =>
            column.map(({ date, count, future }, day) =>
              future ? null : (
                <rect
                  key={`${week}-${day}`}
                  x={left + week * (cell + gap)}
                  y={top + day * (cell + gap)}
                  width={cell}
                  height={cell}
                  rx={2}
                  fill={LEVELS[level(count, max)]}
                  stroke="rgb(0 0 0 / 0.06)"
                >
                  <title>{t.profile.contributionDay(count, dayFormat.format(date))}</title>
                </rect>
              ),
            ),
          )}
        </svg>
        <div className="text-ink-500 mt-2 flex items-center justify-end gap-1 text-xs" aria-hidden="true">
          {t.profile.less}
          {LEVELS.map((color) => (
            <span key={color} className="h-[11px] w-[11px] rounded-[2px] border border-black/5" style={{ backgroundColor: color }} />
          ))}
          {t.profile.more}
        </div>
      </div>
    </section>
  );
}
