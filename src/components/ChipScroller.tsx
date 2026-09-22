import { useCallback, useEffect, useRef, useState } from "react";
import type { ChipOption } from "./ChipGroup";
import { ArrowLeftIcon } from "./Icons";

interface ChipScrollerProps<T extends string> {
  label: string;
  options: ChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  scrollLeftLabel: string;
  scrollRightLabel: string;
}

/** One-line chip row that scrolls sideways, with fade edges and arrow buttons. */
export default function ChipScroller<T extends string>({
  label,
  options,
  selected,
  onSelect,
  scrollLeftLabel,
  scrollRightLabel,
}: ChipScrollerProps<T>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setEdges({
      start: row.scrollLeft > 4,
      end: row.scrollLeft + row.clientWidth < row.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure]);

  // Keep the selected chip in view (e.g. after picking a subject from search).
  useEffect(() => {
    const chip = rowRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    chip?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selected]);

  const scrollBy = (direction: 1 | -1) => {
    const row = rowRef.current;
    row?.scrollBy({ left: direction * row.clientWidth * 0.7, behavior: "smooth" });
  };

  const mask = `linear-gradient(to right, ${edges.start ? "transparent" : "black"} 0, black ${edges.start ? "48px" : "0"}, black calc(100% - ${edges.end ? "48px" : "0px"}), ${edges.end ? "transparent" : "black"} 100%)`;

  return (
    <div role="group" aria-label={label} className="relative -mx-4 sm:mx-0">
      <div
        ref={rowRef}
        onScroll={measure}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className="flex gap-2 overflow-x-auto scroll-smooth px-4 py-0.5 [scrollbar-width:none] sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option) => {
          const isActive = option.value === selected;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(option.value)}
              className={`press h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${
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

      {edges.start && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label={scrollLeftLabel}
          className="bg-surface border-line text-ink-700 hover:text-ink-900 press animate-fade absolute top-1/2 left-0 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-md sm:flex"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
      )}
      {edges.end && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label={scrollRightLabel}
          className="bg-surface border-line text-ink-700 hover:text-ink-900 press animate-fade absolute top-1/2 right-0 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border shadow-md sm:flex"
        >
          <ArrowLeftIcon className="h-4 w-4 rotate-180" />
        </button>
      )}
    </div>
  );
}
