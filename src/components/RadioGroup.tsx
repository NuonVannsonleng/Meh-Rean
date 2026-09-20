export interface RadioOption<T extends string | number> {
  value: T;
  label: string;
}

interface RadioGroupProps<T extends string | number> {
  name: string;
  legend: string;
  options: RadioOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  variant?: "card" | "chip";
  error?: string;
  errorId?: string;
}

export default function RadioGroup<T extends string | number>({
  name,
  legend,
  options,
  value,
  onChange,
  variant = "card",
  error,
  errorId,
}: RadioGroupProps<T>) {
  const isCard = variant === "card";

  return (
    <fieldset aria-describedby={error && errorId ? errorId : undefined}>
      <legend className="text-ink-900 mb-1.5 text-sm font-semibold">
        {legend}
      </legend>
      <div
        className={
          isCard ? "grid grid-cols-1 gap-2 sm:grid-cols-3" : "flex flex-wrap gap-2"
        }
      >
        {options.map((option) => {
          const isActive = option.value === value;
          const inactive = error
            ? "border-danger-fg text-ink-700 hover:border-brand-300"
            : "border-line text-ink-700 hover:border-brand-300";
          return (
            <label
              key={String(option.value)}
              className={[
                "press relative cursor-pointer border font-medium",
                isCard
                  ? "flex h-12 items-center gap-2.5 rounded-xl px-3.5 text-sm"
                  : "inline-flex h-10 items-center rounded-full px-4 text-sm has-focus-visible:outline-brand-600 has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
                isActive
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : inactive,
              ].join(" ")}
            >
              <input
                type="radio"
                name={name}
                value={String(option.value)}
                checked={isActive}
                onChange={() => onChange(option.value)}
                className={
                  isCard
                    ? "accent-brand-600 h-4 w-4"
                    : "absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
                }
              />
              {option.label}
            </label>
          );
        })}
      </div>
      {error && errorId && (
        <p id={errorId} className="text-danger-fg animate-fade mt-1.5 text-sm font-medium">
          {error}
        </p>
      )}
    </fieldset>
  );
}
