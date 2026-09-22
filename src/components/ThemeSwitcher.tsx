import { useId } from "react";
import { useTheme } from "../context/ThemeContext";
import { t } from "../i18n/en";
import type { ThemePreference } from "../types";
import { MonitorIcon, MoonIcon, SunIcon } from "./Icons";

const options: { value: ThemePreference; Icon: typeof SunIcon }[] = [
  { value: "light", Icon: SunIcon },
  { value: "dark", Icon: MoonIcon },
  { value: "system", Icon: MonitorIcon },
];

export default function ThemeSwitcher({ showLegend = false }: { showLegend?: boolean }) {
  const { preference, setPreference } = useTheme();
  const name = useId();

  return (
    <fieldset>
      <legend className={showLegend ? "field-label" : "sr-only"}>{t.theme.label}</legend>
      <div className="bg-surface-muted border-line grid grid-cols-3 gap-1 rounded-xl border p-1">
        {options.map(({ value, Icon }) => {
          const isActive = preference === value;
          return (
            <label
              key={value}
              className={`press has-focus-visible:outline-brand-500 relative flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-medium has-focus-visible:outline-2 ${
                isActive ? "bg-surface text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={isActive}
                onChange={() => setPreference(value)}
                className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              />
              <Icon className="h-4 w-4" />
              {t.theme.options[value]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
