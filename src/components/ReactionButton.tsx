import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useDismiss } from "../hooks/useDismiss";
import { t } from "../i18n/en";
import { REACTION_TYPES, type ReactionType } from "../types";
import { ThumbsUpIcon } from "./Icons";
import ReactionIcon, { reactionColor } from "./ReactionIcon";

interface ReactionButtonProps {
  mine: ReactionType | null;
  disabled?: boolean;
  onReact: (type: ReactionType | null) => void;
  className: string;
}

const LONG_PRESS_MS = 450;
const HOVER_OPEN_MS = 350;
const SPARK_ANGLES = [0, 60, 120, 180, 240, 300];

function Burst({ type }: { type: ReactionType }) {
  return (
    <span className="reaction-burst" style={{ "--burst-color": reactionColor[type] } as CSSProperties}>
      {SPARK_ANGLES.map((angle) => (
        <span key={angle} style={{ "--a": `${angle}deg` } as CSSProperties} />
      ))}
    </span>
  );
}

/**
 * Tap to like (or undo). Hover, long-press or ArrowUp opens the full picker.
 */
export default function ReactionButton({ mine, disabled, onReact, className }: ReactionButtonProps) {
  const [open, setOpenState] = useState(false);
  const [below, setBelow] = useState(false);
  const [burst, setBurst] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const focusPicker = useRef(false);
  const pickerId = useId();

  /** Open upward unless the sticky header would cover the picker. */
  const setOpen = useCallback((next: boolean) => {
    if (next) setBelow((ref.current?.getBoundingClientRect().top ?? Infinity) < 140);
    setOpenState(next);
  }, []);

  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(ref, open, close);

  // Keyboard users land on the first reaction as soon as the picker renders.
  useEffect(() => {
    if (!open || !focusPicker.current) return;
    focusPicker.current = false;
    ref.current?.querySelector<HTMLButtonElement>("[data-reaction]")?.focus();
  }, [open]);

  const clearTimer = () => window.clearTimeout(timer.current);

  const react = (type: ReactionType | null) => {
    if (type) setBurst((count) => count + 1);
    onReact(type);
  };

  const choose = (type: ReactionType) => {
    setOpen(false);
    react(type === mine ? null : type);
  };

  return (
    <div
      ref={ref}
      className="relative flex flex-1"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse" || disabled) return;
        clearTimer();
        timer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_MS);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        clearTimer();
        timer.current = window.setTimeout(close, 250);
      }}
    >
      {open && (
        <div
          id={pickerId}
          role="group"
          aria-label={t.post.reactionsAria}
          className={`card animate-pop absolute left-0 z-30 flex gap-1 rounded-full p-1.5 shadow-xl ${
            below ? "top-full mt-2 origin-top-left" : "bottom-full mb-2 origin-bottom-left"
          }`}
        >
          {REACTION_TYPES.map((type, index) => (
            <button
              key={type}
              type="button"
              data-reaction={type}
              onClick={() => choose(type)}
              aria-label={t.post.reactWith(t.reactions[type])}
              aria-pressed={mine === type}
              style={{ animationDelay: `${index * 35}ms` }}
              className={`group/react animate-rise relative flex h-11 w-11 items-center justify-center rounded-full outline-offset-1 ${
                mine === type ? "bg-brand-50" : ""
              }`}
            >
              <span
                className={`bg-ink-900 text-surface pointer-events-none absolute -top-8 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap opacity-0 transition-all duration-150 group-hover/react:-translate-y-1 group-hover/react:opacity-100 group-focus-visible/react:-translate-y-1 group-focus-visible/react:opacity-100 ${
                  below ? "hidden" : ""
                }`}
              >
                {t.reactions[type]}
              </span>
              <ReactionIcon
                type={type}
                className="h-9 w-9 transition-transform duration-200 ease-spring group-hover/react:-translate-y-1.5 group-hover/react:scale-125 group-focus-visible/react:scale-110"
              />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-pressed={mine !== null}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? pickerId : undefined}
        aria-keyshortcuts="ArrowUp"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          suppressClick.current = false;
          clearTimer();
          timer.current = window.setTimeout(() => {
            suppressClick.current = true;
            setOpen(true);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            focusPicker.current = true;
            setOpen(true);
          }
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          clearTimer();
          setOpen(false);
          react(mine ? null : "like");
        }}
        style={mine ? { color: reactionColor[mine] } : undefined}
        className={`${className} select-none ${mine ? "font-semibold" : ""}`}
      >
        <span className="relative flex">
          {mine ? (
            <ReactionIcon key={`${mine}-${burst}`} type={mine} className="animate-react h-5 w-5" />
          ) : (
            <ThumbsUpIcon className="h-4.5 w-4.5" />
          )}
          {mine && burst > 0 && <Burst key={burst} type={mine} />}
        </span>
        <span>{mine ? t.reactions[mine] : t.post.react}</span>
      </button>
    </div>
  );
}
