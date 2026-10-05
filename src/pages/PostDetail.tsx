import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import CommentSection from "../components/CommentSection";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  CalendarIcon,
  CommentIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  FileTextIcon,
  GraduationIcon,
  LinkIcon,
  MoreIcon,
  ShareIcon,
  StarFilledIcon,
  StarIcon,
  TrashIcon,
} from "../components/Icons";
import InstitutionLogo from "../components/InstitutionLogo";
import LoadingState from "../components/LoadingState";
import { AttachmentIcon, Lightbox } from "../components/PostAttachments";
import { RatingInput } from "../components/RatingStars";
import StarButton from "../components/StarButton";
import VerifiedBadge from "../components/VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { useDismiss } from "../hooks/useDismiss";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { fileExtension, formatCount, formatDate, formatDateTime, formatFileSize, formatRelativeTime } from "../lib/format";
import { SUBJECT_COLORS } from "../lib/subjects";
import { deletePost, getPost, ratePost, toggleSavePost } from "../services/api";
import type { Attachment, PostView } from "../types";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; post: PostView }
  | { status: "not-found" }
  | { status: "error" };

type Tab = "files" | "discussion";

/** Kinds the browser can show in the page; anything else is a download. */
const PREVIEWABLE = new Set<Attachment["kind"]>(["image", "video", "audio", "pdf"]);

function noteUrl(id: string): string {
  return `${window.location.origin}/post/${id}`;
}

// ---- Files ----

function FileTableRow({
  attachment,
  selected,
  onSelect,
}: {
  attachment: Attachment;
  selected: boolean;
  onSelect: () => void;
}) {
  const { url } = useAttachmentUrl(attachment);
  const previewable = PREVIEWABLE.has(attachment.kind);
  return (
    <tr className={`border-line border-t first:border-t-0 ${selected ? "bg-ribbon-50" : "hover:bg-surface-muted"}`}>
      <td className="w-8 py-2 pr-1 pl-4">
        <AttachmentIcon kind={attachment.kind} className="h-6 w-6 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5" />
      </td>
      {/* w-full + max-w-0: the name takes the spare width and truncates. */}
      <td className="w-full max-w-0 py-2 pr-3">
        {previewable ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className="text-ink-900 hover:text-ribbon-fg block max-w-full truncate text-left text-sm hover:underline"
            title={attachment.name}
          >
            {attachment.name}
          </button>
        ) : (
          <span className="text-ink-900 block truncate text-sm" title={attachment.name}>
            {attachment.name}
          </span>
        )}
      </td>
      <td className="text-ink-500 hidden py-2 pr-3 text-sm whitespace-nowrap sm:table-cell">
        {t.post.kinds[attachment.kind]}
        {fileExtension(attachment.name) && ` · ${fileExtension(attachment.name)}`}
      </td>
      <td className="text-ink-500 py-2 pr-3 text-right text-sm whitespace-nowrap tabular-nums">{formatFileSize(attachment.size)}</td>
      <td className="w-10 py-1.5 pr-3 text-right">
        {url && (
          <a href={url} download={attachment.name} aria-label={t.post.downloadAria(attachment.name)} className="icon-btn h-8 w-8">
            <DownloadIcon className="h-4 w-4" />
          </a>
        )}
      </td>
    </tr>
  );
}

function FileViewer({ attachment, onZoom }: { attachment: Attachment; onZoom: () => void }) {
  const { url, failed } = useAttachmentUrl(attachment);
  let body: ReactNode = <p className="text-ink-500 p-6 text-center text-sm">{t.common.loading}</p>;
  if (failed) body = <p className="text-ink-500 p-6 text-center text-sm">{t.post.fileUnavailable}</p>;
  else if (url) {
    if (attachment.kind === "image") {
      body = (
        <button type="button" onClick={onZoom} aria-label={t.post.viewImage(1)} className="bg-surface-muted flex w-full justify-center p-4">
          <img src={url} alt={attachment.name} className="max-h-[70vh] max-w-full rounded object-contain" />
        </button>
      );
    } else if (attachment.kind === "video") {
      body = <video src={url} controls playsInline preload="metadata" className="max-h-[70vh] w-full bg-black" aria-label={attachment.name} />;
    } else if (attachment.kind === "audio") {
      body = <audio src={url} controls preload="metadata" className="w-full p-4" aria-label={attachment.name} />;
    } else if (attachment.kind === "pdf") {
      body = <iframe src={url} title={attachment.name} className="h-[75vh] w-full border-0" />;
    }
  }

  return (
    <section className="card overflow-hidden" aria-label={attachment.name}>
      <div className="box-header justify-between rounded-none">
        <span className="text-ink-900 min-w-0 truncate font-mono text-sm font-semibold">{attachment.name}</span>
        {url && (
          <span className="flex shrink-0 gap-1.5">
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary h-7 px-2 text-xs" aria-label={t.post.openAria(attachment.name)}>
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.note.open}</span>
            </a>
            <a href={url} download={attachment.name} className="btn-secondary h-7 px-2 text-xs">
              <DownloadIcon className="h-3.5 w-3.5" />
              {t.post.download}
            </a>
          </span>
        )}
      </div>
      {body}
    </section>
  );
}

// ---- Header actions ----

function NoteMenu({ post, onDelete }: { post: PostView; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const { notify } = useToast();
  const item = "press text-ink-700 hover:bg-surface-hover flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.post.menu}
        className="btn-secondary h-8 w-8 px-0"
      >
        <MoreIcon className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="card animate-pop absolute right-0 z-30 mt-1 w-48 origin-top-right p-1.5 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              close();
              try {
                await navigator.clipboard.writeText(noteUrl(post.id));
                notify(t.common.linkCopied);
              } catch {
                notify(noteUrl(post.id));
              }
            }}
            className={item}
          >
            <LinkIcon className="h-4 w-4" />
            {t.post.copyLink}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onDelete();
            }}
            className={`${item} text-danger-fg hover:bg-danger-bg`}
          >
            <TrashIcon className="h-4 w-4" />
            {t.post.delete}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- About ----

function AboutRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="text-ink-700 flex items-center gap-2 text-sm">
      <span className="text-ink-500 flex w-4 justify-center">{icon}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function About({ post, onChange }: { post: PostView; onChange: (post: PostView) => void }) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const { notify } = useToast();
  const [pending, setPending] = useState(false);
  const isOwner = user?.id === post.authorId;
  const average = post.rating.count ? post.rating.average.toFixed(1) : null;

  const rate = async (value: number | null) => {
    if (!requireAuth() || pending) return;
    setPending(true);
    try {
      onChange(await ratePost(post.id, value));
      if (value !== null) notify(t.post.ratingSaved);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <aside className="space-y-6" aria-label={t.note.about}>
      <section>
        <h2 className="text-ink-900 mb-3 text-base font-semibold">{t.note.about}</h2>
        {post.tags.length > 0 && (
          <ul className="mb-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link to={`/?q=${encodeURIComponent(tag)}`} className="topic">
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <ul className="space-y-2.5">
          <AboutRow
            icon={<span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: SUBJECT_COLORS[post.subject] }} />}
          >
            <Link to={`/?subject=${post.subject}`} className="hover:text-ribbon-fg">
              {t.subjects[post.subject]}
            </Link>
          </AboutRow>
          <AboutRow icon={<GraduationIcon className="h-4 w-4" />}>{t.levels[post.level]}</AboutRow>
          {post.author.school && (
            <AboutRow icon={<InstitutionLogo name={post.author.school} domain={post.author.schoolDomain} className="h-4 w-4 rounded-sm p-0" />}>
              <Link to={`/?school=${encodeURIComponent(post.author.school)}`} className="hover:text-ribbon-fg hover:underline">
                {post.author.school}
              </Link>
            </AboutRow>
          )}
          <AboutRow icon={<StarIcon className="h-4 w-4" />}>
            <strong className="text-ink-900">{formatCount(post.reactions.total)}</strong> {t.note.starsWord(post.reactions.total)}
          </AboutRow>
          <AboutRow icon={<CommentIcon className="h-4 w-4" />}>
            <Link to="?tab=discussion" className="hover:text-ribbon-fg">
              <strong className="text-ink-900">{formatCount(post.commentCount)}</strong> {t.note.comments(post.commentCount)}
            </Link>
          </AboutRow>
          <AboutRow icon={<CalendarIcon className="h-4 w-4" />}>
            <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)}>
              {t.note.uploadedOn(formatDate(post.createdAt))}
            </time>
          </AboutRow>
        </ul>
      </section>

      <section className="border-line border-t pt-5">
        <h2 className="text-ink-900 mb-2 text-base font-semibold">{t.note.rating}</h2>
        {average ? (
          <p className="text-ink-700 flex items-center gap-1.5 text-sm" aria-label={t.post.ratingAria(average, post.rating.count)}>
            <StarFilledIcon className="text-star h-4 w-4" />
            <span aria-hidden="true">{t.post.ratingSummary(average, post.rating.count)}</span>
          </p>
        ) : (
          <p className="text-ink-500 text-sm">{t.note.noRatings}</p>
        )}
        {!isOwner && (
          <div className="mt-2">
            <p className="text-ink-500 text-xs">{t.post.rateLabel}</p>
            <RatingInput value={post.rating.mine} disabled={pending} onRate={rate} />
          </div>
        )}
      </section>

      <section className="border-line border-t pt-5">
        <h2 className="text-ink-900 mb-3 text-base font-semibold">{t.note.uploadedBy}</h2>
        <Link to={`/u/${post.author.username}`} className="group flex items-center gap-3">
          <Avatar user={post.author} />
          <span className="min-w-0">
            <span className="text-ink-900 flex items-center gap-1 text-sm font-semibold group-hover:underline">
              <span className="truncate">{post.author.displayName}</span>
              {post.author.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
            </span>
            <span className="text-ink-500 block truncate text-xs">{post.author.username}</span>
          </span>
        </Link>
      </section>
    </aside>
  );
}

// ---- Page ----

export default function PostDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const requireAuth = useRequireAuth();
  const { notify } = useToast();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const tab: Tab = params.get("tab") === "discussion" ? "discussion" : "files";

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const post = await getPost(id);
      setState({ status: "ready", post });
      setSelected(post.attachments.find((item) => PREVIEWABLE.has(item.kind))?.id ?? null);
    } catch (error) {
      setState({ status: errorCode(error) === "NOT_FOUND" ? "not-found" : "error" });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  useEffect(() => {
    if (state.status === "ready") document.title = `${state.post.author.username}/${state.post.title} · ${t.common.appName}`;
    return () => {
      document.title = t.common.appName;
    };
  }, [state]);

  const update = (post: PostView) => setState({ status: "ready", post });

  if (state.status === "loading") {
    return (
      <div className="container-page py-6 xl:max-w-7xl">
        <LoadingState count={1} variant="block" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="container-page py-6 xl:max-w-7xl">
        <ErrorState onRetry={load} />
      </div>
    );
  }
  if (state.status === "not-found") {
    return (
      <div className="container-page max-w-3xl py-10">
        <EmptyState
          icon={<FileIcon className="h-6 w-6" />}
          title={t.post.notFoundTitle}
          body={t.post.notFoundBody}
          action={
            <Link to="/" className="btn-primary">
              {t.post.backToFeed}
            </Link>
          }
        />
      </div>
    );
  }

  const { post } = state;
  const isOwner = user?.id === post.authorId;
  const images = post.attachments.filter((item) => item.kind === "image");
  const current = post.attachments.find((item) => item.id === selected) ?? null;

  const save = async () => {
    if (!requireAuth() || saving) return;
    setSaving(true);
    try {
      const next = await toggleSavePost(post.id);
      update(next);
      notify(next.saved ? t.post.savedToast : t.post.unsavedToast);
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const url = noteUrl(post.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: t.post.shareText(post.title), url });
      } catch {
        // Share sheet dismissed.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify(t.common.linkCopied);
    } catch {
      notify(url);
    }
  };

  const remove = async () => {
    if (!window.confirm(t.post.deleteConfirm)) return;
    try {
      await deletePost(post.id);
      notify(t.post.deleted);
      navigate(`/u/${post.author.username}?tab=notes`);
    } catch (error) {
      notify(errorMessage(error));
    }
  };

  const setTab = (next: Tab) => setParams(next === "files" ? {} : { tab: next }, { replace: true });
  const tabs: { id: Tab; label: string; Icon: typeof FileTextIcon; count: number }[] = [
    { id: "files", label: t.note.filesTab, Icon: FileTextIcon, count: post.attachments.length },
    { id: "discussion", label: t.note.discussionTab, Icon: CommentIcon, count: post.commentCount },
  ];

  return (
    <div>
      {/* Like a project header: owner / name, actions, then tabs. */}
      <header className="border-line bg-surface-muted border-b pt-5">
        <div className="container-page xl:max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xl leading-tight font-normal">
              <FileTextIcon className="text-ink-500 h-5 w-5" />
              <Link to={`/u/${post.author.username}`} className="text-ribbon-fg hover:underline">
                {post.author.username}
              </Link>
              <span className="text-ink-500">/</span>
              <span className="text-ink-900 min-w-0 font-semibold wrap-break-word">{post.title}</span>
              <span className="border-line text-ink-500 ml-1 rounded-full border px-2 text-xs leading-5 font-medium">
                {t.subjects[post.subject]}
              </span>
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                aria-pressed={post.saved}
                className="btn-secondary h-8 px-3"
              >
                {post.saved ? <BookmarkFilledIcon className="text-ribbon-fg h-4 w-4" /> : <BookmarkIcon className="h-4 w-4" />}
                {post.saved ? t.post.saved : t.post.save}
              </button>
              <StarButton post={post} onChange={update} />
              <button type="button" onClick={share} aria-label={t.post.share} className="btn-secondary h-8 w-8 px-0">
                <ShareIcon className="h-4 w-4" />
              </button>
              {isOwner && <NoteMenu post={post} onDelete={remove} />}
            </div>
          </div>

          <nav aria-label={t.note.tabsLabel} className="-mb-px mt-4 flex gap-1 overflow-x-auto">
            {tabs.map(({ id: tabId, label, Icon, count }) => {
              const active = tab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setTab(tabId)}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm ${
                    active
                      ? "border-rule text-ink-900 font-semibold"
                      : "text-ink-700 hover:border-line border-transparent"
                  }`}
                >
                  <Icon className="text-ink-500 h-4 w-4" />
                  {label}
                  <span className="counter">{count}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="container-page grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_18rem] xl:max-w-7xl">
        <div className="min-w-0 space-y-6">
          {tab === "files" ? (
            <>
              <section className="card overflow-hidden" aria-label={t.note.filesTab}>
                <div className="box-header rounded-none">
                  <Avatar user={post.author} size="sm" className="h-6 w-6 text-[10px]" />
                  <p className="text-ink-700 min-w-0 flex-1 truncate text-sm">
                    <Link to={`/u/${post.author.username}`} className="text-ink-900 font-semibold hover:underline">
                      {post.author.username}
                    </Link>{" "}
                    {t.note.uploaded}
                  </p>
                  <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)} className="text-ink-500 shrink-0 text-xs">
                    {formatRelativeTime(post.createdAt)}
                  </time>
                </div>
                {post.attachments.length ? (
                  <table className="w-full border-collapse">
                    <caption className="sr-only">{t.note.files(post.attachments.length)}</caption>
                    <tbody>
                      {post.attachments.map((attachment) => (
                        <FileTableRow
                          key={attachment.id}
                          attachment={attachment}
                          selected={attachment.id === selected}
                          onSelect={() => setSelected(attachment.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-ink-500 px-4 py-6 text-center text-sm">{t.note.noFiles}</p>
                )}
              </section>

              {current && (
                <FileViewer
                  key={current.id}
                  attachment={current}
                  onZoom={() => setZoom(Math.max(0, images.findIndex((item) => item.id === current.id)))}
                />
              )}

              <section className="card overflow-hidden" aria-labelledby="readme-title">
                <div className="box-header rounded-none">
                  <FileTextIcon className="text-ink-500 h-4 w-4" />
                  <h2 id="readme-title" className="text-ink-900 text-sm font-semibold">
                    {t.note.readme}
                  </h2>
                </div>
                <div className="px-4 py-5 sm:px-6">
                  <h2 className="text-ink-900 border-line mb-3 border-b pb-2 text-2xl font-semibold">{post.title}</h2>
                  {post.body ? (
                    <p className="text-ink-700 leading-relaxed whitespace-pre-line">{post.body}</p>
                  ) : (
                    <p className="text-ink-500 text-sm italic">{t.note.noDescription}</p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <section aria-label={t.note.discussionTab}>
              <CommentSection
                postId={post.id}
                postAuthorId={post.authorId}
                onCountChange={(delta) => update({ ...post, commentCount: post.commentCount + delta })}
              />
            </section>
          )}
        </div>

        <About post={post} onChange={update} />
      </div>

      {zoom !== null && images.length > 0 && (
        <Lightbox images={images} index={zoom} title={post.title} onIndex={setZoom} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}
