import { useState } from "react";
import { t } from "../i18n/en";
import { StarFilledIcon, StarIcon } from "./Icons";

const STARS = [1, 2, 3, 4, 5];

interface RatingInputProps {
  value: number | null;
  disabled?: boolean;
  onRate: (value: number | null) => void;
}

/** Interactive 1–5 star picker; the user's current rating is highlighted. */
export function RatingInput({ value, disabled, onRate }: RatingInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className="animate-fade flex flex-wrap items-center gap-x-3 gap-y-2">
      <div role="group" aria-label={t.post.rateLabel} className="flex" onPointerLeave={() => setHover(null)}>
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            aria-label={t.post.rateStar(star)}
            aria-pressed={value === star}
            onPointerEnter={() => setHover(star)}
            onClick={() => onRate(star)}
            className="press flex h-11 w-10 items-center justify-center rounded-lg disabled:opacity-60"
          >
            {star <= shown ? (
              <span className="animate-react flex" style={{ animationDelay: hover === null ? `${star * 45}ms` : "0ms" }}>
                <StarFilledIcon className="text-star h-7 w-7" />
              </span>
            ) : (
              <StarIcon className="text-ink-400 h-7 w-7" />
            )}
          </button>
        ))}
      </div>
      {value !== null && (
        <button type="button" disabled={disabled} onClick={() => onRate(null)} className="link text-sm">
          {t.post.clearRating}
        </button>
      )}
    </div>
  );
}
