import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t } from "../../i18n/en";
import { CalculatorIcon } from "../Icons";
import Calculator from "./Calculator";

const copy = t.calculator;
/** Space kept free around the calculator: the top bar and a small margin. */
const MARGIN = 72;

/** The calculator button (bottom right, above the phone's tab bar) and its pop-up, scaled down to fit short screens. */
export default function CalculatorDock() {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Shrink the whole calculator when the window is too short for it.
  useLayoutEffect(() => {
    if (!open || !deviceRef.current) return;
    const device = deviceRef.current;
    const fit = () => setScale(Math.min(1, Math.max(0.6, (window.innerHeight - MARGIN) / device.offsetHeight)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
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
          className="animate-pop fixed inset-x-0 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-2 outline-none sm:inset-x-auto sm:right-4 sm:bottom-4 sm:px-0"
        >
          <div
            ref={deviceRef}
            className="w-full max-w-[20rem] origin-bottom sm:w-[19rem] sm:origin-bottom-right"
            style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
          >
            <Calculator onOff={close} closeLabel={copy.close} />
          </div>
        </div>
      )}
    </>
  );
}
