import { isLocalMode } from "../services/api";
import { supabase } from "../services/supabase/client";

/** BacII exam subjects, by their id in src/lib/subjects.ts, with the Khmer name. */
export const BACII_SUBJECTS = [
  { id: "mathematics", km: "គណិតវិទ្យា" },
  { id: "physics", km: "រូបវិទ្យា" },
  { id: "chemistry", km: "គីមីវិទ្យា" },
  { id: "biology", km: "ជីវវិទ្យា" },
  { id: "earth-science", km: "ផែនដីវិទ្យា" },
  { id: "khmer-literature", km: "អក្សរសាស្ត្រខ្មែរ" },
  { id: "history", km: "ប្រវត្តិវិទ្យា" },
  { id: "geography", km: "ភូមិវិទ្យា" },
  { id: "morality-civics", km: "សីលធម៌-ពលរដ្ឋ" },
  { id: "english", km: "ភាសាអង់គ្លេស" },
] as const;

export type BaciiSubject = (typeof BACII_SUBJECTS)[number]["id"];

export type VideoMatch = "exact" | "same-topic" | "related";

export interface ExerciseVideo {
  id: string;
  title: string;
  channel: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  match: VideoMatch;
  /** Why it fits this exercise, in a few words. */
  reason: string;
}

export interface VideoLookup {
  exercise: {
    subject: string;
    topic: string;
    topicKm: string;
    summary: string;
    /** Set when the exercise is recognised as a BacII past-paper exercise. */
    paper: { year: number; exercise: string | null } | null;
  };
  queries: string[];
  searchUrl: string;
  videos: ExerciseVideo[];
}

/** What went wrong, for the page to explain; see api/bacii-videos.ts. */
export type LookupErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "LIMIT"
  | "NOT_AN_EXERCISE"
  | "IMAGE_TOO_LARGE"
  | "BAD_IMAGE"
  | "EMPTY"
  | "UPSTREAM"
  | "OFFLINE";

export class LookupError extends Error {
  readonly code: LookupErrorCode;
  constructor(code: LookupErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface PreparedImage {
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}

/**
 * Shrinks a photo to at most 1600px on its long side as a JPEG: plenty to read
 * an exercise, and small enough to send quickly from a phone.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new LookupError("BAD_IMAGE", "This browser could not read the photo.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.slice(dataUrl.indexOf(",") + 1), previewUrl: dataUrl };
}

/** Asks the server to read the exercise and find videos that teach it. */
export async function findExerciseVideos(input: {
  text: string;
  subject: BaciiSubject | "";
  image: PreparedImage | null;
}): Promise<VideoLookup> {
  // Browser-only previews have no server to read the exercise.
  if (isLocalMode) throw new LookupError("NOT_CONFIGURED", "Video search needs the online version of Meh Rean.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new LookupError("UNAUTHORIZED", "Sign in to search for videos.");

  let response: Response;
  try {
    response = await fetch("/api/bacii-videos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text: input.text,
        subject: input.subject,
        image: input.image ? { mediaType: input.image.mediaType, data: input.image.data } : null,
      }),
    });
  } catch {
    throw new LookupError("OFFLINE", "Could not reach Meh Rean. Check your connection.");
  }
  const body = (await response.json().catch(() => null)) as
    | (VideoLookup & { error?: undefined })
    | { error?: { code: LookupErrorCode; message: string } }
    | null;
  if (!response.ok || !body || body.error) {
    const error = body?.error;
    // A missing function (404) is a server that has not been set up yet.
    throw new LookupError(error?.code ?? (response.status === 404 ? "NOT_CONFIGURED" : "UPSTREAM"), error?.message ?? "Something went wrong. Try again.");
  }
  return body as VideoLookup;
}

/** A YouTube search anyone can open, with no server or key involved. */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** The player, from YouTube's privacy-enhanced domain (no cookies until play). */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
}
