export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string | number> {
  legend: string;
  options: ChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  hideLegend?: boolean;
  /** "scroll" keeps one sideways-scrolling line on phones; "wrap" always wraps. */
  layout?: "scroll" | "wrap";
}

export default function ChipGroup<T extends string | number>({
  legend,
  options,
  selected,
  onSelect,
  hideLegend = false,
  layout = "scroll",
}: ChipGroupProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend
        className={hideLegend ? "sr-only" : "text-ink-500 mb-2 text-xs font-semibold tracking-wide uppercase"}
      >
        {legend}
      </legend>
      <div className={layout === "wrap" ? "flex flex-wrap gap-2" : "scroll-row"}>
        {options.map((option) => {
          const isActive = option.value === selected;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(option.value)}
              className={`press h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium ${
                isActive
                  ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                  : "border-line bg-surface text-ink-700 hover:border-brand-300 hover:text-accent"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
