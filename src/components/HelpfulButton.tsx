import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { t } from "../i18n/en";
import { errorMessage } from "../lib/errors";
import { formatCount } from "../lib/format";
import { reactToPost } from "../services/api";
import type { PostView } from "../types";
import { BulbFilledIcon, BulbIcon } from "./Icons";

/**
 * "This helped me": the one-tap thanks a student gives a note. Stored as the
 * note's reaction, so older reactions count too. The count is shown on the
 * note and adds up on its author's profile.
 */
export default function HelpfulButton({
  post,
  onChange,
  size = "md",
}: {
  post: PostView;
  onChange: (post: PostView) => void;
  size?: "sm" | "md";
}) {
  const requireAuth = useRequireAuth();
  const { notify } = useToast();
  const [pending, setPending] = useState(false);
  const helpful = post.reactions.mine !== null;

  const toggle = async () => {
    if (!requireAuth() || pending) return;
    setPending(true);
    try {
      onChange(await reactToPost(post.id, helpful ? null : "like"));
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={helpful}
      aria-label={helpful ? t.note.unmarkHelpful(post.reactions.total) : t.note.markHelpful(post.reactions.total)}
      className={`press relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors disabled:opacity-60 ${
        helpful
          ? "border-[color-mix(in_oklch,var(--color-star)_55%,transparent)] bg-[color-mix(in_oklch,var(--color-star)_16%,var(--color-surface))] text-ink-900"
          : "border-line bg-surface text-ink-700 hover:border-[color-mix(in_oklch,var(--color-star)_55%,transparent)] hover:text-ink-900"
      } ${size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm"}`}
    >
      {helpful ? <BulbFilledIcon className="text-star animate-react h-4 w-4" /> : <BulbIcon className="h-4 w-4" />}
      <span>{t.note.helpful}</span>
      <span className="text-ink-500 tabular-nums" aria-hidden="true">
        {formatCount(post.reactions.total)}
      </span>
    </button>
  );
}
