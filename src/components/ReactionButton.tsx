import { useCallback, useId, useRef, useState } from "react";
import { useDismiss } from "../hooks/useDismiss";
import { t } from "../i18n/en";
import { REACTION_TYPES, type ReactionType } from "../types";
import { ThumbsUpIcon } from "./Icons";

interface ReactionButtonProps {
  mine: ReactionType | null;
  disabled?: boolean;
  onReact: (type: ReactionType | null) => void;
  className: string;
}

const LONG_PRESS_MS = 450;
const HOVER_OPEN_MS = 350;

/**
 * Tap to like (or undo). Hover, long-press or ArrowUp opens the full picker.
 */
export default function ReactionButton({ mine, disabled, onReact, className }: ReactionButtonProps) {
  const [open, setOpenState] = useState(false);
  const [below, setBelow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const suppressClick = useRef(false);
  const pickerId = useId();

  /** Open upward unless the sticky header would cover the picker. */
  const setOpen = useCallback((next: boolean) => {
    if (next) setBelow((ref.current?.getBoundingClientRect().top ?? Infinity) < 140);
    setOpenState(next);
  }, []);

  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(ref, open, close);

  const clearTimer = () => window.clearTimeout(timer.current);

  const choose = (type: ReactionType) => {
    setOpen(false);
    onReact(type === mine ? null : type);
  };

  const current = mine ? t.reactions[mine] : null;

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
          className={`card animate-pop absolute left-0 z-30 flex gap-0.5 rounded-full p-1.5 shadow-xl ${
            below ? "top-full mt-2 origin-top-left" : "bottom-full mb-2 origin-bottom-left"
          }`}
        >
          {REACTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              data-reaction={type}
              onClick={() => choose(type)}
              aria-label={t.post.reactWith(t.reactions[type].label)}
              aria-pressed={mine === type}
              title={t.reactions[type].label}
              className={`flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-transform duration-150 hover:-translate-y-1 hover:scale-125 motion-reduce:hover:transform-none ${
                mine === type ? "bg-brand-50" : ""
              }`}
            >
              <span aria-hidden="true">{t.reactions[type].emoji}</span>
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
            setOpen(true);
            requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>("[data-reaction]")?.focus());
          }
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          clearTimer();
          setOpen(false);
          onReact(mine ? null : "like");
        }}
        className={`${className} ${mine ? "text-accent" : ""} select-none`}
      >
        {current ? (
          <span aria-hidden="true" className="animate-pop text-lg leading-none">
            {current.emoji}
          </span>
        ) : (
          <ThumbsUpIcon className="h-4.5 w-4.5" />
        )}
        <span>{current ? current.label : t.post.react}</span>
      </button>
    </div>
  );
}
