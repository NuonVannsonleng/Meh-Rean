import { useId } from "react";
import { CloseIcon, SearchIcon } from "./Icons";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  clearLabel: string;
}

export default function SearchBar({ value, onChange, label, placeholder, clearLabel }: SearchBarProps) {
  const inputId = useId();

  return (
    <div className="group relative" role="search">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <span className="text-ink-400 group-focus-within:text-accent pointer-events-none absolute inset-y-0 left-3.5 flex items-center transition-colors duration-200">
        <SearchIcon />
      </span>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        enterKeyHint="search"
        className="input h-12 pr-11 pl-11 shadow-xs [&::-webkit-search-cancel-button]:hidden"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          className="icon-btn animate-pop absolute inset-y-0 right-1 my-auto h-9 w-9"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
