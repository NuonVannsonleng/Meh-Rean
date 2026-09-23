import { useCallback, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDismiss } from "../hooks/useDismiss";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { t } from "../i18n/en";
import { errorMessage } from "../lib/errors";
import { formatCount, formatDateTime, formatRelativeTime } from "../lib/format";
import { deletePost, ratePost, reactToPost, toggleSavePost } from "../services/api";
import { REACTION_TYPES, type PostView, type ReactionType } from "../types";
import Avatar from "./Avatar";
import CommentSection from "./CommentSection";
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  CommentIcon,
  ExternalLinkIcon,
  LinkIcon,
  MoreIcon,
  ShareIcon,
  StarFilledIcon,
  StarIcon,
  TrashIcon,
} from "./Icons";
import PostAttachments from "./PostAttachments";
import { RatingInput } from "./RatingStars";
import ReactionButton from "./ReactionButton";
import ReactionIcon from "./ReactionIcon";
import VerifiedBadge from "./VerifiedBadge";

interface PostCardProps {
  post: PostView;
  /** Position in a list, used to stagger the entrance animation. */
  index?: number;
  variant?: "feed" | "detail";
  onChange?: (post: PostView) => void;
  onDeleted?: (id: string) => void;
}

const actionClass =
  "press text-ink-500 hover:bg-surface-hover hover:text-ink-900 flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium disabled:opacity-60";

const menuItemClass =
  "press text-ink-700 hover:bg-surface-hover flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium";

function postUrl(id: string): string {
  return `${window.location.origin}/post/${id}`;
}

function PostMenu({ post, isOwner, onDelete }: { post: PostView; isOwner: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { notify } = useToast();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const copyLink = async () => {
    close();
    try {
      await navigator.clipboard.writeText(postUrl(post.id));
      notify(t.common.linkCopied);
    } catch {
      window.prompt(t.post.copyLink, postUrl(post.id));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={t.post.menu}
        aria-expanded={open}
        aria-controls={menuId}
        className="icon-btn -mr-2"
      >
        <MoreIcon />
      </button>
      {open && (
        <div id={menuId} className="card animate-pop absolute right-0 z-30 mt-1 w-52 origin-top-right p-1.5 shadow-xl">
          <Link to={`/post/${post.id}`} onClick={close} className={menuItemClass}>
            <ExternalLinkIcon className="h-4 w-4" />
            {t.post.openPost}
          </Link>
          <button type="button" onClick={copyLink} className={menuItemClass}>
            <LinkIcon className="h-4 w-4" />
            {t.post.copyLink}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                close();
                onDelete();
              }}
              className={`${menuItemClass} text-danger-fg hover:bg-danger-bg`}
            >
              <TrashIcon className="h-4 w-4" />
              {t.post.delete}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TopReactions({ post }: { post: PostView }) {
  const top = REACTION_TYPES.filter((type) => post.reactions.counts[type] > 0)
    .sort((a, b) => post.reactions.counts[b] - post.reactions.counts[a])
    .slice(0, 3);
  if (top.length === 0) return <span />;

  return (
    <span className="flex items-center gap-1.5" title={t.post.reactions(post.reactions.total)}>
      <span className="flex -space-x-1.5" aria-hidden="true">
        {top.map((type) => (
          <ReactionIcon
            key={type}
            type={type}
            className="ring-surface animate-pop h-5 w-5 ring-2"
            glyphClassName="h-3 w-3"
          />
        ))}
      </span>
      <span className="sr-only">{t.post.reactions(post.reactions.total)}</span>
      <span aria-hidden="true">{formatCount(post.reactions.total)}</span>
    </span>
  );
}

export default function PostCard({ post: initial, index = 0, variant = "feed", onChange, onDeleted }: PostCardProps) {
  const { user } = useAuth();
  const { notify } = useToast();
  const requireAuth = useRequireAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(initial);
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(variant === "detail");
  const [showComments, setShowComments] = useState(variant === "detail");
  const [showRating, setShowRating] = useState(false);

  const isDetail = variant === "detail";
  const isOwner = user?.id === post.authorId;
  const isLong = post.body.length > 280 || post.body.split("\n").length > 4;

  const apply = (next: PostView) => {
    setPost(next);
    onChange?.(next);
  };

  const mutate = async (action: () => Promise<PostView>, success?: (next: PostView) => string | null) => {
    if (!requireAuth() || pending) return;
    setPending(true);
    try {
      const next = await action();
      apply(next);
      const message = success?.(next);
      if (message) notify(message);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const react = (type: ReactionType | null) => mutate(() => reactToPost(post.id, type));

  const rate = (value: number | null) =>
    mutate(
      () => ratePost(post.id, value),
      () => (value === null ? null : t.post.ratingSaved),
    ).then(() => setShowRating(false));

  const save = () =>
    mutate(
      () => toggleSavePost(post.id),
      (next) => (next.saved ? t.post.savedToast : t.post.unsavedToast),
    );

  const share = async () => {
    const url = postUrl(post.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: t.post.shareText(post.title), url });
      } catch {
        // User dismissed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify(t.common.linkCopied);
    } catch {
      window.prompt(t.post.copyLink, url);
    }
  };

  const remove = async () => {
    if (!window.confirm(t.post.deleteConfirm)) return;
    try {
      await deletePost(post.id);
      notify(t.post.deleted);
      onDeleted?.(post.id);
      if (isDetail) navigate("/");
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  const toggleComments = () => {
    if (isDetail) {
      document.getElementById(`comments-${post.id}`)?.querySelector("textarea")?.focus();
      return;
    }
    setShowComments((current) => !current);
  };

  const TitleTag = isDetail ? "h1" : "h2";
  const ratingText = post.rating.count > 0 ? post.rating.average.toFixed(1) : null;

  return (
    <article
      className="card animate-rise hover:border-brand-200 overflow-visible transition-[border-color,box-shadow] duration-300 hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      {/* Header */}
      <header className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <Link to={`/u/${post.author.username}`} tabIndex={-1} aria-hidden="true" className="rounded-full">
          <Avatar user={post.author} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
            <Link to={`/u/${post.author.username}`} className="touch-target text-ink-900 font-semibold hover:underline">
              {post.author.displayName}
            </Link>
            {post.author.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
            <span className="text-ink-500">@{post.author.username}</span>
          </p>
          <p className="text-ink-500 truncate text-xs sm:text-sm">
            <Link to={`/post/${post.id}`} className="touch-target hover:underline">
              <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)}>
                {formatRelativeTime(post.createdAt)}
              </time>
            </Link>
            {post.author.school && (
              <>
                <span aria-hidden="true"> · </span>
                {post.author.school}
              </>
            )}
          </p>
        </div>
        <PostMenu post={post} isOwner={isOwner} onDelete={remove} />
      </header>

      {/* Body */}
      <div className="space-y-3 px-4 pt-3 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          <Link
            to={`/?subject=${post.subject}`}
            className="touch-target bg-brand-50 text-accent hover:bg-brand-100 press rounded-full px-2.5 py-1 text-xs font-semibold"
          >
            {t.subjects[post.subject]}
          </Link>
          <span className="bg-surface-hover text-ink-700 rounded-full px-2.5 py-1 text-xs font-medium">
            {t.levels[post.level]}
          </span>
        </div>

        <TitleTag className={`text-ink-900 leading-snug font-semibold ${isDetail ? "text-2xl sm:text-3xl" : "text-lg"}`}>
          {isDetail ? (
            post.title
          ) : (
            <Link to={`/post/${post.id}`} className="hover:text-accent rounded transition-colors">
              {post.title}
            </Link>
          )}
        </TitleTag>

        {post.body && (
          <div>
            <p
              className={`text-ink-700 text-[15px] leading-relaxed whitespace-pre-line ${
                !expanded && isLong ? "line-clamp-4" : ""
              }`}
            >
              {post.body}
            </p>
            {isLong && !isDetail && (
              <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                className="link mt-1 text-sm"
              >
                {expanded ? t.common.seeLess : t.common.seeMore}
              </button>
            )}
          </div>
        )}

        {post.tags.length > 0 && (
          <ul className="flex flex-wrap gap-x-2 gap-y-1">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link to={`/?q=${encodeURIComponent(tag)}`} className="touch-target text-accent text-sm font-medium hover:underline">
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <PostAttachments attachments={post.attachments} title={post.title} />
      </div>

      {/* Stats */}
      <div className="text-ink-500 flex items-center justify-between gap-3 px-4 pt-3 pb-2 text-sm sm:px-5">
        <TopReactions post={post} />
        <div className="flex items-center gap-3">
          {ratingText && (
            <span className="flex items-center gap-1" aria-label={t.post.ratingAria(ratingText, post.rating.count)}>
              <StarFilledIcon className="text-star h-4 w-4" />
              <span aria-hidden="true">{t.post.ratingSummary(ratingText, post.rating.count)}</span>
            </span>
          )}
          {post.commentCount > 0 && (
            <button type="button" onClick={toggleComments} className="touch-target hover:text-ink-900 hover:underline">
              {t.post.comments(post.commentCount)}
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-line mx-2 flex gap-1 border-t py-1 sm:mx-3">
        <ReactionButton mine={post.reactions.mine} disabled={pending} onReact={react} className={actionClass} />
        <button type="button" onClick={toggleComments} aria-expanded={isDetail ? undefined : showComments} className={actionClass}>
          <CommentIcon className="h-4.5 w-4.5" />
          <span className="hidden min-[400px]:inline">{t.post.comment}</span>
        </button>
        {!isOwner && (
          <button
            type="button"
            onClick={() => requireAuth() && setShowRating((current) => !current)}
            aria-expanded={showRating}
            className={`${actionClass} ${post.rating.mine ? "text-star" : ""}`}
          >
            {post.rating.mine ? <StarFilledIcon className="h-4.5 w-4.5" /> : <StarIcon className="h-4.5 w-4.5" />}
            <span className="hidden min-[400px]:inline">
              {post.rating.mine ? t.post.rated(post.rating.mine) : t.post.rate}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-pressed={post.saved}
          aria-label={post.saved ? t.post.saved : t.post.save}
          className={`${actionClass} ${post.saved ? "text-ribbon-fg" : ""}`}
        >
          {post.saved ? (
            <BookmarkFilledIcon className="animate-ribbon h-4.5 w-4.5" />
          ) : (
            <BookmarkIcon className="h-4.5 w-4.5" />
          )}
          <span className="hidden sm:inline">{post.saved ? t.post.saved : t.post.save}</span>
        </button>
        <button type="button" onClick={share} aria-label={t.post.share} className={actionClass}>
          <ShareIcon className="h-4.5 w-4.5" />
          <span className="hidden sm:inline">{t.post.share}</span>
        </button>
      </div>

      {showRating && !isOwner && (
        <div className="border-line border-t px-4 py-3 sm:px-5">
          <p className="text-ink-700 mb-1 text-sm font-medium">{t.post.rateLabel}</p>
          <RatingInput value={post.rating.mine} disabled={pending} onRate={rate} />
        </div>
      )}

      {showComments && (
        <div id={`comments-${post.id}`} className="border-line border-t px-4 py-4 sm:px-5">
          {isDetail && <h2 className="text-ink-900 mb-4 text-base font-semibold">{t.comments.heading}</h2>}
          <CommentSection
            postId={post.id}
            postAuthorId={post.authorId}
            autoFocus={!isDetail}
            onCountChange={(delta) =>
              setPost((current) => ({ ...current, commentCount: current.commentCount + delta }))
            }
          />
        </div>
      )}
    </article>
  );
}
