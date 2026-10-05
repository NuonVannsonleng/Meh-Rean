import { useState } from "react";
import { Link } from "react-router-dom";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { t } from "../i18n/en";
import { formatCount, formatDateTime, formatRelativeTime } from "../lib/format";
import { SUBJECT_COLORS } from "../lib/subjects";
import type { Attachment, AttachmentKind, PostView } from "../types";
import Avatar from "./Avatar";
import { CommentIcon } from "./Icons";
import { AttachmentIcon } from "./PostAttachments";
import HelpfulButton from "./HelpfulButton";
import VerifiedBadge from "./VerifiedBadge";

/** A subject's name on a soft wash of its own colour. */
export function SubjectMark({ subject }: { subject: PostView["subject"] }) {
  const color = SUBJECT_COLORS[subject];
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold"
      style={{ backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`, color: `color-mix(in oklch, ${color} 45%, var(--color-ink-900))` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {t.subjects[subject]}
    </span>
  );
}

/** "2 PDF · 1 Image": what is inside, without opening the note. */
function FileSummary({ attachments }: { attachments: Attachment[] }) {
  const counts = new Map<AttachmentKind, number>();
  for (const attachment of attachments) counts.set(attachment.kind, (counts.get(attachment.kind) ?? 0) + 1);
  if (!counts.size) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t.note.files(attachments.length)}>
      {[...counts].map(([kind, count]) => (
        <li key={kind} className="bg-surface-muted text-ink-700 inline-flex h-7 items-center gap-1.5 rounded-lg pr-2 pl-1 text-xs font-medium">
          <AttachmentIcon kind={kind} className="h-5 w-5 rounded-md [&>svg]:h-3 [&>svg]:w-3" />
          {count > 1 ? `${count} ${t.post.kinds[kind]}` : t.post.kinds[kind]}
        </li>
      ))}
    </ul>
  );
}

function Thumbnail({ image, alt }: { image: Attachment; alt: string }) {
  const { url } = useAttachmentUrl(image);
  return (
    <div className="bg-surface-muted hidden w-36 shrink-0 overflow-hidden sm:block md:w-44">
      {url && <img src={url} alt={alt} loading="lazy" className="animate-fade h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
    </div>
  );
}

/**
 * A note in a list, drawn like a book on a shelf: a spine in its subject's
 * colour, then title, what is inside, and who shared it. The whole card opens
 * the note; the Helpful button and links inside it still work on their own.
 */
export default function NoteRow({
  post: initial,
  showAuthor = true,
  onChange,
}: {
  post: PostView;
  /** A profile lists its own notes, so the author is already known there. */
  showAuthor?: boolean;
  onChange?: (post: PostView) => void;
}) {
  const [post, setPost] = useState(initial);
  const color = SUBJECT_COLORS[post.subject];
  const image = post.attachments.find((item) => item.kind === "image");

  return (
    <li>
      <article className="card group relative flex overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md">
        {/* The book spine. */}
        <span aria-hidden="true" className="w-1.5 shrink-0" style={{ backgroundColor: color }} />

        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <p className="text-ink-500 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <SubjectMark subject={post.subject} />
            <span>{t.levels[post.level]}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </time>
          </p>

          <h3 className="font-display text-ink-900 mt-2 text-lg leading-snug font-bold">
            {/* Stretched over the whole card, so anywhere on it opens the note. */}
            <Link to={`/post/${post.id}`} className="after:absolute after:inset-0 after:content-[''] group-hover:text-accent">
              {post.title}
            </Link>
          </h3>
          {post.body && <p className="text-ink-500 mt-1 line-clamp-2 text-sm leading-relaxed">{post.body}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FileSummary attachments={post.attachments} />
            {post.tags.slice(0, 3).map((tag) => (
              <Link key={tag} to={`/?q=${encodeURIComponent(tag)}`} className="text-ribbon-fg relative z-10 text-xs font-medium hover:underline">
                #{tag}
              </Link>
            ))}
          </div>

          <div className="border-line mt-4 flex items-center gap-3 border-t pt-3">
            {showAuthor ? (
              <Link to={`/u/${post.author.username}`} className="relative z-10 flex min-w-0 flex-1 items-center gap-2">
                <Avatar user={post.author} size="sm" className="h-7 w-7 text-[10px]" />
                <span className="min-w-0">
                  <span className="text-ink-900 flex items-center gap-1 text-sm font-semibold hover:underline">
                    <span className="truncate">{post.author.displayName}</span>
                    {post.author.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                  </span>
                  {post.author.school && <span className="text-ink-500 block truncate text-xs">{post.author.school}</span>}
                </span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {post.commentCount > 0 && (
              <Link
                to={`/post/${post.id}?tab=discussion`}
                aria-label={t.post.comments(post.commentCount)}
                className="text-ink-500 hover:text-ink-900 relative z-10 inline-flex items-center gap-1 text-sm"
              >
                <CommentIcon className="h-4 w-4" />
                {formatCount(post.commentCount)}
              </Link>
            )}
            <HelpfulButton
              post={post}
              size="sm"
              onChange={(next) => {
                setPost(next);
                onChange?.(next);
              }}
            />
          </div>
        </div>

        {image && <Thumbnail image={image} alt={post.title} />}
      </article>
    </li>
  );
}
