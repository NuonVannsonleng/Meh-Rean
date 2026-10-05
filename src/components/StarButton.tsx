import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { t } from "../i18n/en";
import { errorMessage } from "../lib/errors";
import { formatCount } from "../lib/format";
import { reactToPost } from "../services/api";
import type { PostView } from "../types";
import { StarFilledIcon, StarIcon } from "./Icons";

/**
 * Star a note: a public "this is useful", counted on the note and its author.
 * Stored as the note's reaction, so stars and the older reactions add up.
 */
export default function StarButton({
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
  const starred = post.reactions.mine !== null;

  const toggle = async () => {
    if (!requireAuth() || pending) return;
    setPending(true);
    try {
      onChange(await reactToPost(post.id, starred ? null : "like"));
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
      aria-pressed={starred}
      aria-label={starred ? t.note.unstarAria(post.reactions.total) : t.note.starAria(post.reactions.total)}
      className={`press border-line bg-surface-muted text-ink-900 hover:bg-surface-hover inline-flex shrink-0 items-center gap-1.5 rounded-md border font-semibold disabled:opacity-60 ${
        size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm"
      }`}
    >
      {starred ? (
        <StarFilledIcon className="text-star animate-react h-4 w-4" />
      ) : (
        <StarIcon className="text-ink-500 h-4 w-4" />
      )}
      <span>{starred ? t.note.starred : t.note.star}</span>
      <span className="counter" aria-hidden="true">
        {formatCount(post.reactions.total)}
      </span>
    </button>
  );
}
