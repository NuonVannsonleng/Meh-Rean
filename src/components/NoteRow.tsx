import { useState } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n/en";
import { formatCount, formatDateTime, formatRelativeTime } from "../lib/format";
import { SUBJECT_COLORS } from "../lib/subjects";
import type { PostView } from "../types";
import { CommentIcon, PaperclipIcon, StarIcon } from "./Icons";
import StarButton from "./StarButton";

/** The coloured dot and name of a note's subject. */
export function SubjectMark({ subject }: { subject: PostView["subject"] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: SUBJECT_COLORS[subject] }} />
      {t.subjects[subject]}
    </span>
  );
}

/**
 * One note in a list, laid out like a project in a code host's list: title,
 * description, topics, then subject, stars, discussion and files on one line.
 */
export default function NoteRow({
  post: initial,
  showAuthor = true,
  onChange,
}: {
  post: PostView;
  /** Profiles list their own notes, so the author is already known there. */
  showAuthor?: boolean;
  onChange?: (post: PostView) => void;
}) {
  const [post, setPost] = useState(initial);
  const files = post.attachments.length;

  return (
    <li className="border-line flex gap-4 border-b py-5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <h3 className="text-[17px] leading-snug break-words">
          <Link to={`/post/${post.id}`} className="text-ribbon-fg hover:underline">
            {showAuthor && <span className="font-normal">{post.author.username} / </span>}
            <span className="font-semibold">{post.title}</span>
          </Link>
        </h3>
        {post.body && <p className="text-ink-500 mt-1.5 line-clamp-2 text-sm">{post.body}</p>}
        {post.tags.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link to={`/?q=${encodeURIComponent(tag)}`} className="topic">
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-ink-500 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <SubjectMark subject={post.subject} />
          <span>{t.levels[post.level]}</span>
          {post.reactions.total > 0 && (
            <Link to={`/post/${post.id}`} className="hover:text-ribbon-fg inline-flex items-center gap-1" aria-label={t.note.stars(post.reactions.total)}>
              <StarIcon className="h-3.5 w-3.5" />
              {formatCount(post.reactions.total)}
            </Link>
          )}
          {post.commentCount > 0 && (
            <Link to={`/post/${post.id}?tab=discussion`} className="hover:text-ribbon-fg inline-flex items-center gap-1" aria-label={t.post.comments(post.commentCount)}>
              <CommentIcon className="h-3.5 w-3.5" />
              {formatCount(post.commentCount)}
            </Link>
          )}
          {files > 0 && (
            <span className="inline-flex items-center gap-1" aria-label={t.note.files(files)}>
              <PaperclipIcon className="h-3.5 w-3.5" />
              {files}
            </span>
          )}
          <span>
            {t.note.updated}{" "}
            <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </time>
          </span>
        </p>
      </div>
      <div className="shrink-0 pt-0.5">
        <StarButton
          post={post}
          size="sm"
          onChange={(next) => {
            setPost(next);
            onChange?.(next);
          }}
        />
      </div>
    </li>
  );
}
