import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "../hooks/useDismiss";
import { t } from "../i18n/en";
import { FilterIcon } from "./Icons";

interface FilterMenuProps {
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}

/** "Filters" button: a popover on larger screens, a bottom sheet on phones. */
export default function FilterMenu({ activeCount, onClear, children }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss([anchorRef, sheetRef], open, close);

  const header = (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-ink-900 text-base font-semibold">{t.feed.filtersLabel}</h2>
      {activeCount > 0 && (
        <button type="button" onClick={onClear} className="link text-sm">
          {t.feed.clearAll}
        </button>
      )}
    </div>
  );

  return (
    <div ref={anchorRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`press border-line bg-surface text-ink-700 hover:border-brand-300 hover:text-ink-900 flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium ${
          open || activeCount > 0 ? "border-brand-500 text-accent" : ""
        }`}
      >
        <FilterIcon className="h-4 w-4" />
        {t.feed.filtersButton}
        {activeCount > 0 && (
          <span className="bg-brand-600 animate-pop flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {/* Tablet & desktop: popover anchored to the button */}
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label={t.feed.filtersLabel}
          className="card animate-pop absolute top-full right-0 z-30 mt-2 hidden w-80 origin-top-right p-5 shadow-2xl sm:block"
        >
          {header}
          <div className="space-y-5">{children}</div>
        </div>
      )}

      {/* Phones: bottom sheet rendered at the root so it sits above the tab bar */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:hidden">
            <div aria-hidden="true" className="bg-ink-900/35 animate-fade absolute inset-0" />
            <div
              ref={sheetRef}
              role="dialog"
              aria-label={t.feed.filtersLabel}
              className="bg-surface relative max-h-[85dvh] overflow-y-auto rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl [animation:sheet-up_340ms_var(--ease-out-soft)_both]"
            >
              <div className="bg-line mx-auto mb-4 h-1.5 w-10 rounded-full" aria-hidden="true" />
              {header}
              <div className="space-y-5">{children}</div>
              <button type="button" onClick={close} className="btn-primary mt-6 w-full">
                {t.feed.applyFilters}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
