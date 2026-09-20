export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  title?: string;
}

interface ChipGroupProps<T extends string | number> {
  legend: string;
  options: ChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

export default function ChipGroup<T extends string | number>({
  legend,
  options,
  selected,
  onSelect,
}: ChipGroupProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-ink-500 mb-2 text-xs font-semibold tracking-wide uppercase">
        {legend}
      </legend>
      {/* The fieldset + legend already exposes the group and its name */}
      <div className="scroll-row">
        {options.map((option) => {
          const isActive = option.value === selected;
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={isActive}
              title={option.title}
              onClick={() => onSelect(option.value)}
              className={`press shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium ${
                isActive
                  ? "border-brand-600 bg-brand-600 scale-[1.03] text-white shadow-sm"
                  : "border-line bg-surface text-ink-700 hover:border-brand-300 hover:text-brand-700 hover:-translate-y-0.5"
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
