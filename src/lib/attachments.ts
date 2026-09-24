import type { AttachmentKind, MediaFilter } from "../types";

const EXTENSION_KINDS: Record<string, AttachmentKind> = {
  pdf: "pdf",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  txt: "document",
  md: "document",
  pages: "document",
  ppt: "slides",
  pptx: "slides",
  odp: "slides",
  key: "slides",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  ods: "spreadsheet",
  csv: "spreadsheet",
  numbers: "spreadsheet",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
};

export function detectAttachmentKind(mimeType: string, name: string): AttachmentKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_KINDS[extension] ?? "other";
}

const RENDERABLE_TYPES = ["text/html", "application/xhtml+xml", "image/svg+xml", "application/xml", "text/xml"];

/**
 * Types a browser would render as a live document on the storage origin, which
 * would turn an upload into stored XSS against that origin. The declared type
 * comes from the client and the bucket sets no allowed_mime_types, so these are
 * stored as a generic binary instead: the file still downloads, but it can never
 * execute. Everything else keeps the type the browser reported.
 */
export function safeContentType(mimeType: string): string {
  const declared = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!declared) return "application/octet-stream";
  return RENDERABLE_TYPES.includes(declared) ? "application/octet-stream" : mimeType;
}

export function matchesMediaFilter(kinds: AttachmentKind[], filter: MediaFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "images":
      return kinds.includes("image");
    case "videos":
      return kinds.includes("video");
    case "documents":
      return kinds.some((kind) => kind !== "image" && kind !== "video");
  }
}

// Kept in step with the attachments bucket's file_size_limit in supabase/schema.sql.
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_POST = 10;
