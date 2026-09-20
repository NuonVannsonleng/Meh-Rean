import { useId } from "react";
import { t } from "../i18n/en";
import { CloseIcon, SearchIcon } from "./Icons";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  const inputId = useId();

  return (
    <div className="group relative">
      <label htmlFor={inputId} className="sr-only">
        {t.search.label}
      </label>
      <span className="text-ink-400 group-focus-within:text-brand-600 pointer-events-none absolute inset-y-0 left-3 flex items-center transition-colors duration-200">
        <SearchIcon />
      </span>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t.search.placeholder}
        autoComplete="off"
        className="border-line bg-surface text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:shadow-brand-100 h-12 w-full rounded-xl border pr-11 pl-11 text-base shadow-sm transition-[border-color,box-shadow] duration-200 outline-none focus:shadow-[0_0_0_4px_var(--color-brand-100)] sm:h-13 [&::-webkit-search-cancel-button]:hidden"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t.search.clear}
          className="text-ink-400 hover:bg-surface-muted hover:text-ink-700 press animate-pop absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-lg"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
