import { useEffect, useRef, useState } from "react";
import { t } from "../../i18n/en";
import { CalculatorIcon, CloseIcon } from "../Icons";
import Calculator from "./Calculator";

const copy = t.calculator;

/** The calculator button (bottom right, above the phone's tab bar) and its pop-up. */
export default function CalculatorDock() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  return (
    <>
      {!open && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={copy.openLabel}
          data-testid="calculator-button"
          className="press bg-brand-600 hover:bg-brand-700 fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-lg sm:right-6 sm:bottom-6"
        >
          <CalculatorIcon className="h-5 w-5" />
          {copy.open}
        </button>
      )}
      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label={copy.title}
          className="animate-pop fixed inset-x-0 bottom-0 z-50 max-h-[100dvh] overflow-y-auto px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] outline-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[22rem] sm:p-0"
          onKeyDown={(event) => {
            if (event.key === "Escape" && event.shiftKey) close();
          }}
        >
          <div className="mx-auto max-w-[24rem]">
            <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
              <p className="text-ink-500 bg-surface/90 hidden rounded-md px-2 py-1 text-[11px] sm:block">{copy.keyboardHint}</p>
              <button type="button" onClick={close} aria-label={copy.close} className="bg-surface text-ink-700 hover:text-ink-900 border-line ml-auto flex h-9 w-9 items-center justify-center rounded-full border shadow-md">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <Calculator onOff={close} />
          </div>
        </div>
      )}
    </>
  );
}
