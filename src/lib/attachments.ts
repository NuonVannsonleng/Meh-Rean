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

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_FILES_PER_POST = 10;
