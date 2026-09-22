import { useEffect, type RefObject } from "react";

type Ref = RefObject<HTMLElement | null>;

/** Closes a popover on pointer-down outside all given elements, or on Escape. */
export function useDismiss(refs: Ref | Ref[], open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    const list = Array.isArray(refs) ? refs : [refs];

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!list.some((ref) => ref.current?.contains(target))) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
    // `refs` is a stable ref (or array of stable refs) created by the caller.
  }, [open, onClose]);
}
