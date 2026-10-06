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
  BulbIcon,
  ChatIcon,
  TrashIcon,
} from "../components/Icons";
import InstitutionLogo from "../components/InstitutionLogo";
import LoadingState from "../components/LoadingState";
import { AttachmentIcon, Lightbox } from "../components/PostAttachments";
import { RatingInput } from "../components/RatingStars";
import HelpfulButton from "../components/HelpfulButton";
import VerifiedBadge from "../components/VerifiedBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { useDismiss } from "../hooks/useDismiss";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { t } from "../i18n/en";
import { errorCode, errorMessage } from "../lib/errors";
import { formatCount, formatDate, formatDateTime, formatFileSize, formatRelativeTime } from "../lib/format";
import { subjectCategory, subjectColor, subjectLabel } from "../lib/subjects";
import { SubjectMark } from "../components/NoteRow";
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

/** The note's own school, or its author's for notes from before notes had one. */
function noteSchool(post: PostView): { name: string; domain: string | null } {
  return post.school ? { name: post.school, domain: post.schoolDomain } : { name: post.author.school, domain: post.author.schoolDomain };
}

function noteUrl(id: string): string {
  return `${window.location.origin}/post/${id}`;
}

// ---- Files ----

/**
 * One file as a tile: a picture of it (or a big icon in its kind's colour),
 * its name and size. Tapping a viewable file shows it below; the arrow
 * downloads it.
 */
function FileTile({
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
    <li
      className={`card group relative overflow-hidden transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md ${
        selected ? "ring-brand-500 ring-2" : ""
      }`}
    >
      <button
        type="button"
        onClick={previewable ? onSelect : undefined}
        disabled={!previewable}
        aria-pressed={previewable ? selected : undefined}
        title={attachment.name}
        className="block w-full text-left disabled:cursor-default"
      >
        <span className="bg-surface-muted flex aspect-[4/3] items-center justify-center overflow-hidden">
          {attachment.kind === "image" && url ? (
            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <AttachmentIcon kind={attachment.kind} className="h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7" />
          )}
        </span>
        <span className="block px-3 pt-2.5 pb-3">
          <span className="text-ink-900 block truncate text-sm font-semibold">{attachment.name}</span>
          <span className="text-ink-500 block text-xs">
            {[t.post.kinds[attachment.kind], formatFileSize(attachment.size)].join(" · ")}
          </span>
        </span>
      </button>
      {url && (
        <a
          href={url}
          download={attachment.name}
          aria-label={t.post.downloadAria(attachment.name)}
          className="press bg-surface/90 text-ink-700 hover:text-ink-900 absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur"
        >
          <DownloadIcon className="h-4 w-4" />
        </a>
      )}
    </li>
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
  const school = noteSchool(post);

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
    <aside className="space-y-4" aria-label={t.note.about}>
      <section className="card p-4">
        <h2 className="font-display text-ink-900 mb-3 text-base font-bold">{t.note.about}</h2>
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
            icon={<span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: subjectColor(post.subject) }} />}
          >
            <Link to={`/?subject=${subjectCategory(post.subject)}`} className="hover:text-ribbon-fg">
              {subjectLabel(post.subject)}
            </Link>
          </AboutRow>
          <AboutRow icon={<GraduationIcon className="h-4 w-4" />}>{t.levels[post.level]}</AboutRow>
          {school.name && (
            <AboutRow icon={<InstitutionLogo name={school.name} domain={school.domain} className="h-4 w-4 rounded-sm p-0" />}>
              <Link to={`/?school=${encodeURIComponent(school.name)}`} className="hover:text-ribbon-fg hover:underline">
                {school.name}
              </Link>
            </AboutRow>
          )}
          <AboutRow icon={<BulbIcon className="h-4 w-4" />}>{t.note.helpfulCount(post.reactions.total)}</AboutRow>
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

      <section className="card p-4">
        <h2 className="font-display text-ink-900 mb-2 text-base font-bold">{t.note.rating}</h2>
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

      {!isOwner && (
        <section className="card bg-ribbon-50 border-ribbon-100 p-4">
          <h2 className="font-display text-ink-900 text-base font-bold">{t.note.questions}</h2>
          <p className="text-ink-700 mt-1 text-sm">{t.note.questionsBody(post.author.displayName.split(" ")[0])}</p>
          <Link to={`/messages/${post.author.username}`} className="btn-secondary mt-3 w-full">
            <ChatIcon className="h-4 w-4" />
            {t.note.messageAuthor(post.author.displayName.split(" ")[0])}
          </Link>
        </section>
      )}
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
      <header className="bg-surface border-line border-b">
        <div className="container-page pt-6 xl:max-w-7xl">
          <p className="text-ink-500 flex flex-wrap items-center gap-2 text-xs">
            <Link to={`/?subject=${subjectCategory(post.subject)}`} className="press">
              <SubjectMark subject={post.subject} />
            </Link>
            <span>{t.levels[post.level]}</span>
          </p>
          <h1 className="text-ink-900 mt-3 max-w-4xl text-2xl leading-tight wrap-break-word sm:text-4xl">{post.title}</h1>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <Link to={`/u/${post.author.username}`} className="group flex min-w-0 items-center gap-3">
              <Avatar user={post.author} />
              <span className="min-w-0 text-sm">
                <span className="text-ink-900 flex items-center gap-1 font-semibold group-hover:underline">
                  <span className="truncate">{post.author.displayName}</span>
                  {post.author.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
                </span>
                <span className="text-ink-500 flex min-w-0 items-center gap-1.5">
                  {noteSchool(post).name && (
                    <>
                      <InstitutionLogo name={noteSchool(post).name} domain={noteSchool(post).domain} className="h-4 w-4 rounded-sm border-0 p-0" />
                      <span className="truncate">{noteSchool(post).name}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <time dateTime={post.createdAt} title={formatDateTime(post.createdAt)} className="shrink-0">
                    {formatRelativeTime(post.createdAt)}
                  </time>
                </span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <HelpfulButton post={post} onChange={update} />
              <button
                type="button"
                onClick={save}
                disabled={saving}
                aria-pressed={post.saved}
                className={`btn-secondary rounded-full ${post.saved ? "border-ribbon-500 text-ribbon-fg bg-ribbon-50" : ""}`}
              >
                {post.saved ? <BookmarkFilledIcon className="animate-ribbon h-4 w-4" /> : <BookmarkIcon className="h-4 w-4" />}
                {post.saved ? t.post.saved : t.post.save}
              </button>
              <button type="button" onClick={share} aria-label={t.post.share} className="btn-secondary w-10 rounded-full px-0">
                <ShareIcon className="h-4 w-4" />
              </button>
              {isOwner && <NoteMenu post={post} onDelete={remove} />}
            </div>
          </div>

          <nav aria-label={t.note.tabsLabel} className="mt-6 flex gap-6 overflow-x-auto">
            {tabs.map(({ id: tabId, label, Icon, count }) => {
              const active = tab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setTab(tabId)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-11 shrink-0 items-center gap-2 text-sm font-semibold ${
                    active ? "text-accent" : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  <span className={`rounded-full px-2 text-xs leading-5 ${active ? "bg-brand-50" : "bg-surface-hover"}`}>{count}</span>
                  {active && <span className="bg-brand-600 animate-fade absolute inset-x-0 bottom-0 h-[3px] rounded-t-full" />}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="container-page grid gap-8 py-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_19rem] xl:max-w-7xl">
        <div className="min-w-0 space-y-6">
          {tab === "files" ? (
            <>
              {post.body && (
                <section className="card p-5 sm:p-6" aria-labelledby="readme-title">
                  <h2 id="readme-title" className="font-display text-ink-900 mb-2 text-lg font-bold">
                    {t.note.readme}
                  </h2>
                  <p className="text-ink-700 leading-relaxed whitespace-pre-line">{post.body}</p>
                </section>
              )}

              <section aria-labelledby="files-title">
                <h2 id="files-title" className="font-display text-ink-900 mb-3 text-lg font-bold">
                  {t.note.files(post.attachments.length)}
                </h2>
                {post.attachments.length ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {post.attachments.map((attachment) => (
                      <FileTile
                        key={attachment.id}
                        attachment={attachment}
                        selected={attachment.id === selected}
                        onSelect={() => setSelected(attachment.id)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="card text-ink-500 px-4 py-8 text-center text-sm">{t.note.noFiles}</p>
                )}
              </section>

              {current && (
                <FileViewer
                  key={current.id}
                  attachment={current}
                  onZoom={() => setZoom(Math.max(0, images.findIndex((item) => item.id === current.id)))}
                />
              )}
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
