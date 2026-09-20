import { t } from "../i18n/en";
import type { Resource, ResourceType } from "../types";
import { DownloadIcon } from "./Icons";

const badgeStyles: Record<ResourceType, string> = {
  note: "bg-note-bg text-note-fg",
  paper: "bg-paper-bg text-paper-fg",
  slide: "bg-slide-bg text-slide-fg",
};

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface ResourceCardProps {
  resource: Resource;
}

export default function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <article className="border-line bg-surface hover:border-brand-200 lift group flex flex-col gap-4 rounded-2xl border p-4 shadow-xs hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase ${badgeStyles[resource.type]}`}
          >
            {t.resource.typeLabel[resource.type]}
          </span>
        </div>
        <h3 className="text-ink-900 group-hover:text-brand-700 text-base leading-snug font-semibold transition-colors duration-200">
          {resource.title}
        </h3>
        <p className="text-ink-500 text-sm">
          {t.resource.uploadedBy(resource.uploadedBy)}
          <span aria-hidden="true"> · </span>
          <time dateTime={resource.createdAt}>
            {formatDate(resource.createdAt)}
          </time>
        </p>
      </div>

      <a
        href={resource.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t.resource.downloadAria(resource.title)}
        className="border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:border-brand-300 active:bg-brand-200 press inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold sm:w-auto"
      >
        <DownloadIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" />
        {t.resource.download}
      </a>
    </article>
  );
}
