import { useEffect, useRef, useState } from "react";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { t } from "../i18n/en";
import { fileExtension, formatFileSize } from "../lib/format";
import type { Attachment, AttachmentKind } from "../types";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CloseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  MusicIcon,
  PresentationIcon,
  TableIcon,
  VideoIcon,
} from "./Icons";

const kindStyles: Record<AttachmentKind, { Icon: typeof FileIcon; tone: string }> = {
  pdf: { Icon: FileTextIcon, tone: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  document: { Icon: FileTextIcon, tone: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  slides: { Icon: PresentationIcon, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  spreadsheet: { Icon: TableIcon, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  archive: { Icon: ArchiveIcon, tone: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
  audio: { Icon: MusicIcon, tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  video: { Icon: VideoIcon, tone: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
  image: { Icon: ImageIcon, tone: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  other: { Icon: FileIcon, tone: "bg-surface-hover text-ink-700" },
};

export function AttachmentIcon({ kind, className = "h-11 w-11" }: { kind: AttachmentKind; className?: string }) {
  const { Icon, tone } = kindStyles[kind];
  return (
    <span className={`${tone} ${className} flex shrink-0 items-center justify-center rounded-xl`}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

// ---- Images ----

function ImageTile({
  attachment,
  alt,
  className,
  overlay,
  onOpen,
  label,
}: {
  attachment: Attachment;
  alt: string;
  className: string;
  overlay?: string;
  onOpen: () => void;
  label: string;
}) {
  const { url } = useAttachmentUrl(attachment);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={`bg-surface-hover group relative overflow-hidden ${className}`}
    >
      {url && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className="animate-fade h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      )}
      {overlay && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white">
          {overlay}
        </span>
      )}
    </button>
  );
}

function Lightbox({
  images,
  index,
  title,
  onIndex,
  onClose,
}: {
  images: Attachment[];
  index: number;
  title: string;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const current = images[index];
  const { url } = useAttachmentUrl(current);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const step = (delta: number) => onIndex((index + delta + images.length) % images.length);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") step(1);
        if (event.key === "ArrowLeft") step(-1);
      }}
      aria-label={t.post.imageAlt(title, index + 1)}
      className="m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black/90 p-0 backdrop:bg-black/80"
    >
      <div className="relative flex h-full w-full items-center justify-center p-4 sm:p-12" onClick={onClose}>
        {url && (
          <img
            src={url}
            alt={t.post.imageAlt(title, index + 1)}
            onClick={(event) => event.stopPropagation()}
            className="animate-fade max-h-full max-w-full rounded-lg object-contain"
          />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.common.close}
          className="press absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <CloseIcon />
        </button>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(-1);
              }}
              aria-label={t.post.viewImage(((index - 1 + images.length) % images.length) + 1)}
              className="press absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ArrowLeftIcon />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(1);
              }}
              aria-label={t.post.viewImage(((index + 1) % images.length) + 1)}
              className="press absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ArrowLeftIcon className="h-5 w-5 rotate-180" />
            </button>
            <p className="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}

function ImageGrid({ images, title }: { images: Attachment[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;

  const layouts = [
    "",
    "grid-cols-1",
    "grid-cols-2 aspect-[16/9]",
    "grid-cols-2 grid-rows-2 aspect-[4/3] [&>*:first-child]:row-span-2",
    "grid-cols-2 grid-rows-2 aspect-[4/3]",
  ];
  const layout = layouts[shown.length];

  return (
    <>
      <div className={`grid gap-1 overflow-hidden rounded-xl ${layout}`}>
        {shown.map((image, index) => (
          <ImageTile
            key={image.id}
            attachment={image}
            alt={t.post.imageAlt(title, index + 1)}
            label={t.post.viewImage(index + 1)}
            onOpen={() => setOpen(index)}
            overlay={index === shown.length - 1 && extra > 0 ? t.post.moreImages(extra) : undefined}
            className={shown.length === 1 ? "aspect-[4/3] max-h-[480px] w-full" : "h-full min-h-0 w-full"}
          />
        ))}
      </div>
      {open !== null && (
        <Lightbox images={images} index={open} title={title} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

// ---- Video / audio / files ----

function VideoPlayer({ attachment }: { attachment: Attachment }) {
  const { url } = useAttachmentUrl(attachment);
  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-black">
      {url && (
        <video src={url} controls preload="metadata" playsInline className="h-full w-full" aria-label={attachment.name} />
      )}
    </div>
  );
}

function FileRow({ attachment }: { attachment: Attachment }) {
  const { url, failed } = useAttachmentUrl(attachment);
  const details = [t.post.kinds[attachment.kind], fileExtension(attachment.name), formatFileSize(attachment.size)]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(" · ");

  return (
    <div className="border-line bg-surface-muted/60 rounded-xl border p-3">
      <div className="flex items-center gap-3">
        <AttachmentIcon kind={attachment.kind} />
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 truncate text-sm font-semibold" title={attachment.name}>
            {attachment.name}
          </p>
          <p className="text-ink-500 text-xs">{failed ? t.post.fileUnavailable : details}</p>
        </div>
        {url && (
          <div className="flex shrink-0 gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.post.openAria(attachment.name)}
              className="icon-btn"
            >
              <ExternalLinkIcon className="h-4.5 w-4.5" />
            </a>
            <a
              href={url}
              download={attachment.name}
              aria-label={t.post.downloadAria(attachment.name)}
              className="btn-secondary h-10 px-3"
            >
              <DownloadIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.post.download}</span>
            </a>
          </div>
        )}
      </div>
      {attachment.kind === "audio" && url && <audio src={url} controls preload="metadata" className="mt-3 w-full" />}
    </div>
  );
}

export default function PostAttachments({ attachments, title }: { attachments: Attachment[]; title: string }) {
  const images = attachments.filter((item) => item.kind === "image");
  const videos = attachments.filter((item) => item.kind === "video");
  const files = attachments.filter((item) => item.kind !== "image" && item.kind !== "video");

  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      {images.length > 0 && <ImageGrid images={images} title={title} />}
      {videos.map((item) => (
        <VideoPlayer key={item.id} attachment={item} />
      ))}
      {files.map((item) => (
        <FileRow key={item.id} attachment={item} />
      ))}
    </div>
  );
}
