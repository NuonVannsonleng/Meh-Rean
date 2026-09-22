export interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioGroupProps<T extends string> {
  name: string;
  legend: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Pill-shaped native radios: keyboard arrows and screen readers work for free. */
export default function RadioGroup<T extends string>({ name, legend, options, value, onChange }: RadioGroupProps<T>) {
  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <label
              key={option.value}
              className={`press has-focus-visible:outline-brand-500 relative inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-offset-2 ${
                isActive
                  ? "border-brand-600 bg-brand-50 text-accent"
                  : "border-line text-ink-700 hover:border-brand-300"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isActive}
                onChange={() => onChange(option.value)}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
