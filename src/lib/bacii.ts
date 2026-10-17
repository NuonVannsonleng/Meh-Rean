import { isLocalMode } from "../services/api";
import type { VideoQuizQuestion } from "../types";
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
  /** "km" when the title or description is in Khmer (absent in older saved lookups). */
  language?: "km" | "other";
  /** From a channel admins marked as trusted. */
  trusted?: boolean;
  /** Where the exercise is worked, from the creator's own chapter list. */
  start?: { seconds: number; title: string } | null;
}

export interface VideoLookup {
  exercise: {
    subject: string;
    topic: string;
    topicKm: string;
    summary: string;
    /** Set when the exercise is recognised as a BacII past-paper exercise. */
    paper: { year: number; exercise: string | null } | null;
    /** Meh Rean's chapter for it, when it fits one (absent in older saved lookups). */
    chapter?: { id: string; subjectId: string; number: number; nameEn: string; nameKm: string } | null;
    topicId?: string | null;
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
  /** The upstream service's own reason, when the server passed one on. */
  readonly detail: string | null;
  constructor(code: LookupErrorCode, message: string, detail: string | null = null) {
    super(message);
    this.code = code;
    this.detail = detail;
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

/** One request to api/bacii-videos, with its errors turned into LookupErrors. */
async function postExercise<T>(payload: Record<string, unknown>): Promise<T> {
  // Browser-only previews have no server to read the exercise.
  if (isLocalMode) throw new LookupError("NOT_CONFIGURED", "This needs the online version of Meh Rean.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new LookupError("UNAUTHORIZED", "Sign in first.");

  let response: Response;
  try {
    response = await fetch("/api/bacii-videos", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new LookupError("OFFLINE", "Could not reach Meh Rean. Check your connection.");
  }
  const body = (await response.json().catch(() => null)) as (T & { error?: undefined }) | { error?: { code: LookupErrorCode; message: string; detail?: string } } | null;
  if (!response.ok || !body || body.error) {
    const error = body?.error;
    if (error) throw new LookupError(error.code, error.message, error.detail ?? null);
    // No answer of ours: a missing function (404), or the host stopping a slow one (504).
    if (response.status === 404) throw new LookupError("NOT_CONFIGURED", "This isn't available here yet.", "HTTP 404");
    throw new LookupError(
      "UPSTREAM",
      response.status === 504 ? "That took too long. Please try again." : "Something went wrong. Try again.",
      `HTTP ${response.status}`,
    );
  }
  return body as T;
}

const imagePayload = (image: PreparedImage | null) => (image ? { mediaType: image.mediaType, data: image.data } : null);

/** Asks the server to read the exercise and find videos that teach it. */
export function findExerciseVideos(input: {
  text: string;
  subject: BaciiSubject | "";
  image: PreparedImage | null;
  /** The chapter the student came from, as a hint. */
  chapterId?: string;
}): Promise<VideoLookup> {
  return postExercise<VideoLookup>({
    text: input.text,
    subject: input.subject,
    chapterId: input.chapterId || undefined,
    image: imagePayload(input.image),
  });
}

/** What the reader made of a photo, for the student to check (roadmap 4.5). */
export interface ExerciseTranscript {
  /** The exercise, formulas in LaTeX between $…$. */
  text: string;
  /** Parts the reader was not sure about. */
  unclear: string[];
  subject: string;
  chapter: { id: string; subjectId: string; number: number; nameEn: string; nameKm: string } | null;
  topicId: string | null;
}

/** An AI worked solution: always shown as unchecked. */
export interface AISolution {
  steps: string[];
  answer: string;
  confidence: "high" | "medium" | "low";
  caveats: string;
  provider: string;
}

/** Reads a photographed exercise; counts as one of the day's lookups. */
export async function readExercisePhoto(image: PreparedImage, subject: BaciiSubject | ""): Promise<ExerciseTranscript> {
  const body = await postExercise<{ transcript: ExerciseTranscript }>({ task: "read", subject, image: imagePayload(image) });
  return body.transcript;
}

/** Admins: draft quiz questions from a transcript they may use (not stored by the server). */
export async function draftVideoQuiz(transcript: string, language: "km" | "en", title: string): Promise<VideoQuizQuestion[]> {
  const body = await postExercise<{ questions: VideoQuizQuestion[] }>({ task: "quiz", transcript, language, title });
  return body.questions;
}

/** Asks the AI for a worked solution of the (checked) exercise text; counts as a lookup. */
export async function solveWithAI(text: string, subject: BaciiSubject | "", chapterId?: string): Promise<AISolution> {
  const body = await postExercise<{ solution: AISolution }>({ task: "solve", text, subject, chapterId: chapterId || undefined });
  return body.solution;
}

export interface VideoUsage {
  lookups: { used: number; limit: number };
  /** The shared YouTube allowance; null when it cannot be counted. */
  youtube: { unitsUsed: number; unitsLimit: number } | null;
}

/** Lookups left today and YouTube quota used; null when unknown (offline, browser-only, not set up). */
export interface CompanionAnswer {
  kind: "summary" | "explain" | "plan";
  text: string;
  /** Only for a sound plan (known topics, adding up to the session); otherwise null. */
  steps: { minutes: number; activity: "review" | "practise" | "watch" | "read" | "break"; topicId: string | null }[] | null;
  minutes: number;
  model: string;
  generatedAt: string;
}

/**
 * The AI study companion (Learning OS 8.2). The server reads the student's
 * own data; this only says which suggestions the page shows.
 */
export async function askCompanion(
  kind: CompanionAnswer["kind"],
  recommendations: { topicId: string; reasons: string[]; neededFor?: string }[],
  minutes: number,
): Promise<CompanionAnswer> {
  return postExercise<CompanionAnswer>({ task: "companion", kind, recommendations: recommendations.slice(0, 5), minutes });
}

export async function getVideoUsage(): Promise<VideoUsage | null> {
  if (isLocalMode) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const response = await fetch("/api/bacii-videos", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    return (await response.json()) as VideoUsage;
  } catch {
    return null;
  }
}

/** A YouTube search anyone can open, with no server or key involved. */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** The player, from YouTube's privacy-enhanced domain (no cookies until play). */
export function youtubeEmbedUrl(id: string, startSeconds = 0): string {
  const start = startSeconds > 0 ? `&start=${Math.floor(startSeconds)}` : "";
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0${start}`;
}

/** "1:05:09" or "4:09". */
export function formatVideoTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
