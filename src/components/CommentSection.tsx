import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { formatDateTime, formatRelativeTime } from "../lib/format";
import { addComment, deleteComment, getComments } from "../services/api";
import type { CommentView } from "../types";
import Avatar from "./Avatar";
import { TrashIcon } from "./Icons";
import VerifiedBadge from "./VerifiedBadge";

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  onCountChange: (delta: number) => void;
  autoFocus?: boolean;
}

/** A note's discussion: a timeline of comment boxes, then a box to write in. */
export default function CommentSection({ postId, postAuthorId, onCountChange, autoFocus }: CommentSectionProps) {
  const { user } = useAuth();
  const inputId = useId();
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadFailed(false);
    getComments(postId)
      .then(setComments)
      .catch(() => setLoadFailed(true));
  }, [postId]);

  useEffect(load, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const created = await addComment(postId, draft);
      setComments((current) => [...(current ?? []), created]);
      setDraft("");
      onCountChange(1);
    } catch {
      setError(t.comments.error);
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    setComments((current) => current?.filter((comment) => comment.id !== id) ?? null);
    onCountChange(-1);
    try {
      await deleteComment(id);
    } catch {
      load();
      onCountChange(1);
    }
  };

  return (
    <div className="space-y-4">
      {loadFailed ? (
        <p className="text-ink-500 text-sm">
          {t.error.body}{" "}
          <button type="button" onClick={load} className="link">
            {t.common.tryAgain}
          </button>
        </p>
      ) : comments === null ? (
        <p role="status" className="text-ink-500 text-sm">
          {t.common.loading}
        </p>
      ) : comments.length === 0 ? (
        <p className="card text-ink-500 px-4 py-6 text-center text-sm">{t.comments.empty}</p>
      ) : (
        // The faint line down the left joins the boxes into one timeline.
        <ol className="relative space-y-4 before:absolute before:top-0 before:bottom-0 before:left-4.75 before:w-0.5 before:bg-line">
          {comments.map((comment) => {
            const canDelete = user && (user.id === comment.authorId || user.id === postAuthorId);
            const byAuthor = comment.authorId === postAuthorId;
            return (
              <li key={comment.id} className="animate-fade relative flex gap-3">
                <Link to={`/u/${comment.author.username}`} className="relative shrink-0 rounded-full" tabIndex={-1} aria-hidden="true">
                  <Avatar user={comment.author} className="ring-surface ring-4" />
                </Link>
                <article className="card min-w-0 flex-1 overflow-hidden">
                  <header className={`box-header rounded-none py-2 text-sm ${byAuthor ? "bg-ribbon-50" : ""}`}>
                    <p className="text-ink-500 min-w-0 flex-1 truncate">
                      <Link to={`/u/${comment.author.username}`} className="text-ink-900 font-semibold hover:underline">
                        {comment.author.username}
                      </Link>
                      {comment.author.verified && <VerifiedBadge className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />}{" "}
                      {t.comments.commented}{" "}
                      <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
                        {formatRelativeTime(comment.createdAt)}
                      </time>
                    </p>
                    {byAuthor && (
                      <span className="border-line text-ink-500 rounded-full border px-2 text-xs leading-5 font-medium">
                        {t.comments.author}
                      </span>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(comment.id)}
                        aria-label={t.comments.delete}
                        className="icon-btn hover:text-danger-fg h-7 w-7"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </header>
                  <p className="text-ink-900 px-4 py-3 text-sm leading-relaxed whitespace-pre-line wrap-anywhere">
                    {comment.body}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      )}

      {user ? (
        <form onSubmit={submit} className="border-line flex gap-3 border-t pt-4">
          <Avatar user={user} className="hidden sm:flex" />
          <div className="card min-w-0 flex-1 p-2">
            <label htmlFor={inputId} className="text-ink-900 block px-1 pb-1.5 text-sm font-semibold">
              {t.comments.label}
            </label>
            <textarea
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={t.comments.placeholder}
              rows={4}
              maxLength={1000}
              autoFocus={autoFocus}
              className="input bg-surface-muted h-auto min-h-24 resize-y py-2"
            />
            {error && (
              <p role="alert" className="field-error px-1">
                {error}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-ink-500 hidden px-1 text-xs sm:block">{t.comments.hint}</p>
              <button type="submit" disabled={!draft.trim() || posting} className="btn-primary ml-auto">
                {posting ? t.comments.posting : t.comments.submit}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p className="card text-ink-500 px-4 py-4 text-center text-sm">
          <Link to={`/login?next=${encodeURIComponent(`/post/${postId}?tab=discussion`)}`} className="link">
            {t.nav.signIn}
          </Link>{" "}
          {t.comments.signInPrompt}
        </p>
      )}
    </div>
  );
}
