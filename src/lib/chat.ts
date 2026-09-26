import { t } from "../i18n/en";
import type { MessageAttachment, MessageKind } from "../types";

/** Mirrors messages_body_len in supabase/schema.sql. */
export const MAX_MESSAGE_LENGTH = 2000;
/** Voice notes stop recording on their own after this long. */
export const MAX_VOICE_SECONDS = 5 * 60;
/** Bars kept per voice note; send_message() keeps at most 64. */
export const WAVEFORM_BARS = 48;

/** Mirrors the image types send_message() accepts for a photo message. */
const PHOTO_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;

/** How a picked or dropped file is sent: shown inline, or as a download card. */
export function kindForFile(file: File): Exclude<MessageKind, "text" | "sticker" | "voice"> {
  const type = file.type.toLowerCase();
  if (PHOTO_TYPES.test(type)) return "image";
  if (type.startsWith("video/")) return "video";
  return "file";
}

/** Photos this big are scaled down before sending; phones take huge ones. */
const MAX_PHOTO_EDGE = 2048;
const RESIZE_ABOVE_BYTES = 1.5 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

/**
 * Measures a photo and, when it is large, re-encodes it smaller. Anything that
 * cannot be decoded here is sent untouched rather than failing the send.
 */
export async function preparePhoto(file: File): Promise<{ file: File; width?: number; height?: number }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { file };
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(width, height));
  // GIFs would lose their animation, and small photos are fine as they are.
  if (file.type === "image/gif" || (scale === 1 && file.size <= RESIZE_ABOVE_BYTES)) {
    bitmap.close();
    return { file, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // JPEG stays JPEG; anything that may have transparency goes to WebP.
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  const blob = await toBlob(canvas, type);
  if (!blob || blob.type !== type || blob.size >= file.size) return { file, width, height };

  const extension = type === "image/jpeg" ? "jpg" : "webp";
  const name = file.name.replace(/\.[^.]+$/, "") + `.${extension}`;
  return { file: new File([blob], name, { type }), width: canvas.width, height: canvas.height };
}

/** Reads a video's size and length without playing it. */
export function videoMeta(file: File): Promise<Pick<MessageAttachment, "width" | "height" | "duration">> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (meta: Pick<MessageAttachment, "width" | "height" | "duration">) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    const timer = window.setTimeout(() => done({}), 5000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () =>
      done({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    video.onerror = () => done({});
    video.src = url;
  });
}

/** "0:07", "12:45". */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Squeezes any number of loudness samples into `bars` values from 0 to 100. */
export function toWaveform(samples: number[], bars = WAVEFORM_BARS): number[] {
  if (!samples.length) return Array.from({ length: bars }, () => 8);
  const peak = Math.max(...samples, 0.01);
  return Array.from({ length: bars }, (_, index) => {
    const start = Math.floor((index * samples.length) / bars);
    const end = Math.max(start + 1, Math.floor(((index + 1) * samples.length) / bars));
    const slice = samples.slice(start, end);
    const average = slice.reduce((sum, value) => sum + value, 0) / slice.length;
    return Math.max(6, Math.min(100, Math.round((average / peak) * 100)));
  });
}

/** One line describing a message, for reply quotes and the inbox. */
export function messageSnippet(message: {
  kind: MessageKind;
  body: string;
  deleted: boolean;
  attachmentName?: string | null;
  duration?: number;
}): string {
  if (message.deleted) return t.messages.preview.unsent;
  const caption = message.body.trim();
  switch (message.kind) {
    case "text":
      return caption;
    case "sticker":
      return t.messages.preview.sticker;
    case "voice":
      return message.duration
        ? `${t.messages.preview.voice} (${formatDuration(message.duration)})`
        : t.messages.preview.voice;
    case "image":
      return caption ? `${t.messages.preview.image} · ${caption}` : t.messages.preview.image;
    case "video":
      return caption ? `${t.messages.preview.video} · ${caption}` : t.messages.preview.video;
    case "file":
      return t.messages.preview.file(message.attachmentName ?? null);
  }
}
