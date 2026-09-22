import { t } from "../i18n/en";

const BOOK_TOPS = [3, 16, 29];

interface LogoMarkProps {
  className?: string;
  /** Plays the "books stack, bookmark drops" intro once on mount. */
  animated?: boolean;
}

/** Stacked books with a teal bookmark — the Meh Rean mark, drawn as SVG. */
export function LogoMark({ className = "h-8 w-8", animated = false }: LogoMarkProps) {
  return (
    <svg viewBox="0 0 46 45" className={`${className} ${animated ? "logo-animate" : ""}`} aria-hidden="true">
      {BOOK_TOPS.map((y) => (
        <g key={y} className="logo-book">
          <path
            d={`M42 ${y}H10.5a6.5 6.5 0 0 0 0 13H42`}
            fill="var(--color-logo-page)"
            stroke="var(--color-logo-cover)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={`M14 ${y + 4}H40M14 ${y + 6.5}H40M14 ${y + 9}H40`}
            stroke="var(--color-rule)"
            strokeWidth="0.7"
          />
        </g>
      ))}
      <path className="logo-ribbon" d="M27 5.5h5.5v33l-2.75-2.8-2.75 2.8z" fill="var(--color-logo-ribbon)" />
    </svg>
  );
}

interface LogoProps {
  stacked?: boolean;
  animated?: boolean;
  className?: string;
}

/** Mark + wordmark. `stacked` mirrors the two-line lockup of the brand artwork. */
export default function Logo({ stacked = false, animated = false, className = "" }: LogoProps) {
  return (
    <span className={`logo-hover inline-flex items-center ${stacked ? "gap-3" : "gap-2"} ${className}`}>
      <LogoMark animated={animated} className={stacked ? "h-16 w-16" : "h-8 w-8 sm:h-9 sm:w-9"} />
      <span
        className={`font-display text-logo-cover font-extrabold tracking-tight ${
          stacked ? "text-3xl leading-[0.9]" : "text-xl leading-none"
        } ${animated ? "animate-rise [animation-delay:250ms]" : ""}`}
      >
        {stacked ? (
          <>
            {t.common.appName.split(" ")[0]}
            <br />
            {t.common.appName.split(" ").slice(1).join(" ")}
          </>
        ) : (
          t.common.appName
        )}
      </span>
    </span>
  );
}
