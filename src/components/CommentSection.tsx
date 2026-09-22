import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { t } from "../i18n/en";
import { formatDateTime, formatRelativeTime } from "../lib/format";
import { addComment, deleteComment, getComments } from "../services/api";
import type { CommentView } from "../types";
import Avatar from "./Avatar";
import { SendIcon, TrashIcon } from "./Icons";

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  onCountChange: (delta: number) => void;
  autoFocus?: boolean;
}

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
    <section aria-label={t.comments.heading} className="space-y-4">
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
        <p className="text-ink-500 text-sm">{t.comments.empty}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const canDelete = user && (user.id === comment.authorId || user.id === postAuthorId);
            return (
              <li key={comment.id} className="animate-fade group flex gap-2.5">
                <Link to={`/u/${comment.author.username}`} className="rounded-full" tabIndex={-1} aria-hidden="true">
                  <Avatar user={comment.author} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="bg-surface-hover rounded-2xl rounded-tl-md px-3.5 py-2.5">
                    <Link
                      to={`/u/${comment.author.username}`}
                      className="text-ink-900 text-sm font-semibold hover:underline"
                    >
                      {comment.author.displayName}
                    </Link>
                    <p className="text-ink-700 text-sm whitespace-pre-line">{comment.body}</p>
                  </div>
                  <div className="text-ink-500 mt-1 flex items-center gap-3 px-2 text-xs">
                    <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
                      {formatRelativeTime(comment.createdAt)}
                    </time>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(comment.id)}
                        aria-label={t.comments.delete}
                        className="hover:text-danger-fg inline-flex items-center gap-1 rounded font-medium"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {user ? (
        <form onSubmit={submit} className="flex items-start gap-2.5">
          <Avatar user={user} size="sm" className="mt-1.5" />
          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              {t.comments.label}
            </label>
            <div className="relative">
              <textarea
                id={inputId}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={t.comments.placeholder}
                rows={1}
                maxLength={1000}
                autoFocus={autoFocus}
                className="input field-sizing-content h-auto min-h-11 resize-none rounded-2xl py-2.5 pr-12"
              />
              <button
                type="submit"
                disabled={!draft.trim() || posting}
                aria-label={posting ? t.comments.posting : t.comments.submit}
                className="text-accent hover:bg-brand-50 press absolute right-1.5 bottom-1.5 flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40"
              >
                <SendIcon className="h-4 w-4" />
              </button>
            </div>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
          </div>
        </form>
      ) : (
        <p className="text-ink-500 text-sm">
          <Link to={`/login?next=${encodeURIComponent(`/post/${postId}`)}`} className="link">
            {t.nav.signIn}
          </Link>{" "}
          {t.comments.signInPrompt}
        </p>
      )}
    </section>
  );
}
