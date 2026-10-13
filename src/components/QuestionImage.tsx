import { useMemo } from "react";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import type { QuestionImage as QuestionImageData } from "../types";

/**
 * An image in a question. Online the address is built from the stored path
 * in our storage bucket (the database stores nothing else); in the
 * browser-only demo it is a file kept in this browser, resolved like note
 * attachments.
 */
export default function QuestionImage({ image, className = "" }: { image: QuestionImageData; className?: string }) {
  const attachment = useMemo(
    () => ({ id: image.path, name: image.alt, mimeType: "image/*", size: 0, kind: "image" as const, url: image.url }),
    [image],
  );
  const { url } = useAttachmentUrl(attachment);
  if (!url) return <span className={`bg-surface-hover animate-shimmer block rounded-md ${className}`} aria-hidden="true" />;
  // Addresses come from our storage bucket (https; plain http only for a local
  // development server) or this browser's own files (blob:).
  if (!/^(https:|blob:|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(url)) return null;
  return <img src={url} alt={image.alt} loading="lazy" className={`rounded-md bg-white object-contain ${className}`} />;
}
