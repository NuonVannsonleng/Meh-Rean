/**
 * POST /api/bacii-videos — "Stuck on an exercise?" for BacII (Grade 12) students.
 *
 * Takes an exercise as a photo and/or text, has an AI model read it (subject,
 * topic, which BacII paper it is from if it can tell), searches YouTube for
 * teaching videos in Khmer and English, then has the model rank them so a video
 * that works the very same exercise comes first.
 *
 * Runs as a Vercel Function, so the keys stay on the server. Environment:
 *   GEMINI_API_KEY       Google Gemini, from aistudio.google.com (has a free tier)
 *   ANTHROPIC_API_KEY    or Claude, from console.anthropic.com; used when set
 *   YOUTUBE_API_KEY      required, YouTube Data API v3 key from Google Cloud
 *   BACII_GEMINI_MODEL   optional, default gemini-2.5-flash
 *   BACII_AI_MODEL       optional Claude model, default claude-opus-5-5
 *   BACII_DAILY_LIMIT    optional, lookups per student per day, default 20
 *   YOUTUBE_DAILY_QUOTA  optional, the project's YouTube units a day, default 10000
 *   BACII_SEARCH_CACHE_HOURS optional, how long a YouTube search is reused, default 24
 *   VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY), which
 *   the app already has: used to check who is asking and to count lookups.
 *
 * Only signed-in students can use it, each up to the daily limit, so the keys
 * cannot be spent by anyone on the internet. Lookups are counted in
 * public.bacii_video_lookups (supabase/schema.sql) with the student's own
 * session, under row level security: no service key is needed.
 *
 * GET /api/bacii-videos tells a signed-in student how many lookups they have
 * left today and how much of the shared YouTube quota is used (roadmap 4.1).
 *
 * The same endpoint also serves "Photo to solution" (roadmap 4.5), sharing
 * the AI set-up and the daily allowance: { task: "read" } transcribes a photo
 * (LaTeX for formulas) for the student to check, and { task: "solve" } writes
 * an AI worked solution, always shown as unchecked. One file, so Vercel has
 * no shared modules to bundle.
 *
 * { task: "quiz" } (admins only, roadmap 4.6) drafts multiple-choice questions
 * from a transcript the admin may use; the admin reviews them before saving.
 * The transcript is not stored.
 */

// --------------------------------------------------------------- types --

/** BacII subjects the reader can choose from (ids from src/lib/subjects.ts). */
const SUBJECTS = [
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "earth-science",
  "khmer-literature",
  "history",
  "geography",
  "morality-civics",
  "english",
  "other",
] as const;

type Match = "exact" | "same-topic" | "related";

interface ExerciseReading {
  is_exercise: boolean;
  subject: (typeof SUBJECTS)[number];
  topic_en: string;
  topic_km: string;
  summary: string;
  exercise_text: string;
  bacii_year: number | null;
  exercise_number: string | null;
  search_queries: string[];
  /** One of Meh Rean's curriculum ids, when the exercise fits one (roadmap 4.2). */
  chapter_id: string | null;
  topic_id: string | null;
}

interface Candidate {
  channelId: string;
  id: string;
  title: string;
  channel: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
}

const MAX_IMAGE_BYTES = 3_500_000;
const MAX_TEXT = 4000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const env = (name: string) => process.env[name]?.trim() || "";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const fail = (status: number, code: string, message: string, detail?: string) =>
  json(status, { error: { code, message, ...(detail ? { detail } : {}) } });

/**
 * What an upstream service said went wrong, for the site owner to act on (an
 * invalid key, a model not on this plan, quota used up). Keys travel in headers
 * and are never part of these messages.
 */
const upstreamDetail = (error: unknown) => String(error instanceof Error ? error.message : error).slice(0, 400);

// ------------------------------------------------------------- Supabase --

const supabaseUrl = () => (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, "");
const supabaseKey = () => env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_ANON_KEY");

/** The signed-in student's id, or null for a missing or expired session. */
async function userFromToken(token: string): Promise<string | null> {
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: { apikey: supabaseKey(), Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string };
  return user.id ?? null;
}

/**
 * Counts this lookup against the student's daily limit. Returns "ok",
 * "limit" when it is used up, or "setup" when the table is missing.
 */
/** The student's lookups in the last 24 hours, or null when the table is missing. */
async function countLookups(token: string): Promise<number | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await fetch(
    `${supabaseUrl()}/rest/v1/bacii_video_lookups?select=id&created_at=gte.${encodeURIComponent(since)}`,
    { method: "HEAD", headers: { apikey: supabaseKey(), Authorization: `Bearer ${token}`, Prefer: "count=exact" } },
  );
  if (count.status === 404) return null;
  if (!count.ok) throw new Error(`lookup count failed: ${count.status}`);
  return Number(count.headers.get("content-range")?.split("/")[1] ?? "0");
}

async function takeLookup(token: string, limit: number): Promise<"ok" | "limit" | "setup"> {
  const headers = { apikey: supabaseKey(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const used = await countLookups(token);
  if (used === null) return "setup";
  if (used >= limit) return "limit";
  const insert = await fetch(`${supabaseUrl()}/rest/v1/bacii_video_lookups`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: "{}",
  });
  if (insert.status === 404) return "setup";
  if (!insert.ok) throw new Error(`lookup insert failed: ${insert.status}`);
  return "ok";
}

/** Records YouTube searches for the quota count; a failure here never fails a lookup. */
async function logSearches(token: string, searches: number): Promise<void> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/youtube_search_log`, {
    method: "POST",
    headers: { apikey: supabaseKey(), Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ searches }),
  });
  if (!response.ok) throw new Error(`search log failed: ${response.status}`);
}

async function youtubeUnitsToday(token: string): Promise<number | null> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/rpc/youtube_units_today`, {
    method: "POST",
    headers: { apikey: supabaseKey(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) return null;
  return Number(await response.json());
}

// ----------------------------------------------------------- Curriculum --

interface ChapterInfo {
  id: string;
  number: number;
  nameEn: string;
  nameKm: string;
  subjectId: string;
  subjectKey: string;
  topics: { id: string; nameEn: string; nameKm: string }[];
}

let chapterCache: { at: number; chapters: ChapterInfo[] } | null = null;

/**
 * Meh Rean's chapters and topics (public rows, read with the publishable
 * key), kept for an hour. Read from the database rather than bundled, so an
 * admin's edits apply and the function carries no data files.
 */
async function curriculumChapters(): Promise<ChapterInfo[]> {
  if (chapterCache && Date.now() - chapterCache.at < 3_600_000) return chapterCache.chapters;
  try {
    const select = "id,number,name_en,name_km,subject_id,curriculum_subjects(subject_key),curriculum_topics(id,name_en,name_km,sort)";
    const response = await fetch(`${supabaseUrl()}/rest/v1/curriculum_chapters?select=${select}&order=subject_id,number`, {
      headers: { apikey: supabaseKey() },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`curriculum ${response.status}`);
    const rows = (await response.json()) as {
      id: string;
      number: number;
      name_en: string;
      name_km: string;
      subject_id: string;
      curriculum_subjects: { subject_key: string } | null;
      curriculum_topics: { id: string; name_en: string; name_km: string; sort: number }[];
    }[];
    const chapters = rows.map((row) => ({
      id: row.id,
      number: row.number,
      nameEn: row.name_en,
      nameKm: row.name_km,
      subjectId: row.subject_id,
      subjectKey: row.curriculum_subjects?.subject_key ?? "",
      topics: [...(row.curriculum_topics ?? [])].sort((a, b) => a.sort - b.sort).map((topic) => ({ id: topic.id, nameEn: topic.name_en, nameKm: topic.name_km })),
    }));
    chapterCache = { at: Date.now(), chapters };
    return chapters;
  } catch (error) {
    console.error(error);
    return chapterCache?.chapters ?? [];
  }
}

let channelCache: { at: number; channels: { channelId: string; subjectKeys: string[] }[] } | null = null;

/** Channels admins marked as trusted (public rows), kept ten minutes. */
async function trustedChannels(): Promise<{ channelId: string; subjectKeys: string[] }[]> {
  if (channelCache && Date.now() - channelCache.at < 600_000) return channelCache.channels;
  try {
    const response = await fetch(`${supabaseUrl()}/rest/v1/video_channels?select=channel_id,subject_keys`, {
      headers: { apikey: supabaseKey() },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`channels ${response.status}`);
    const rows = (await response.json()) as { channel_id: string; subject_keys: string[] }[];
    channelCache = { at: Date.now(), channels: rows.map((row) => ({ channelId: row.channel_id, subjectKeys: row.subject_keys ?? [] })) };
    return channelCache.channels;
  } catch (error) {
    console.error(error);
    return channelCache?.channels ?? [];
  }
}

const KHMER = /[\u1780-\u17FF]/;

/** The chapter list for the model, one line per chapter with its topics. */
function chapterList(chapters: ChapterInfo[]): string {
  return chapters
    .map((chapter) => {
      const topics = chapter.topics.map((topic) => `${topic.id} = ${topic.nameEn} (${topic.nameKm})`).join("; ");
      return `- ${chapter.id} = ${chapter.subjectKey} chapter ${chapter.number}: ${chapter.nameEn} (${chapter.nameKm})${topics ? ` — topics: ${topics}` : ""}`;
    })
    .join("\n");
}

// ------------------------------------------------------------- AI models --

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/** One Claude call that must answer through `tool`; returns the tool's input. */
async function askClaude<T>(
  system: string,
  content: ContentBlock[],
  tool: { name: string; description: string; input_schema: object },
  deadline: number,
): Promise<T> {
  const base = (env("ANTHROPIC_BASE_URL") || "https://api.anthropic.com").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now() - 1500)),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env("BACII_AI_MODEL") || "claude-opus-5-5",
      max_tokens: 1500,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [{ role: "user", content }],
    }),
  });
  if (!response.ok) throw new Error(`Claude ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const message = (await response.json()) as { content: { type: string; name?: string; input?: unknown }[] };
  const call = message.content.find((block) => block.type === "tool_use" && block.name === tool.name);
  if (!call?.input) throw new Error("Claude did not answer with the tool");
  return call.input as T;
}

// --------------------------------------------------------------- Gemini --

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: string[];
  required?: string[];
  minItems?: number;
  maxItems?: number;
};

/** The tools' JSON Schema in Gemini's dialect: upper-case types, `nullable` for null. */
function geminiSchema(schema: JsonSchema): Record<string, unknown> {
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const type = types.find((name) => name !== "null");
  const out: Record<string, unknown> = {};
  if (type) out.type = type.toUpperCase();
  if (types.includes("null")) out.nullable = true;
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, geminiSchema(value)]));
  }
  if (schema.items) out.items = geminiSchema(schema.items);
  if (schema.required) out.required = schema.required;
  if (schema.minItems !== undefined) out.minItems = schema.minItems;
  if (schema.maxItems !== undefined) out.maxItems = schema.maxItems;
  return out;
}

/** One Gemini call answering in the tool's shape as JSON; returns that object. */
async function askGemini<T>(
  system: string,
  content: ContentBlock[],
  tool: { name: string; description: string; input_schema: object },
  deadline: number,
  state: AIState,
): Promise<T> {
  const base = (env("GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const chosen = env("BACII_GEMINI_MODEL") || GEMINI_MODELS[0];
  const parts = content.map((block) =>
    block.type === "image"
      ? { inline_data: { mime_type: block.source.media_type, data: block.source.data } }
      : { text: block.text },
  );

  /** One request, given up in time to try another model before the deadline. */
  const call = async (model: string, withSchema: boolean): Promise<Response> => {
    const left = deadline - Date.now();
    if (left < 3000) return new Response(JSON.stringify({ error: { message: "out of time" } }), { status: 504 });
    try {
      return await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(Math.min(left - 1500, 25_000)),
        // The key goes in a header, never the URL, so it stays out of request logs.
        headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: withSchema
                  ? `${system}\n\nAnswer with JSON only: ${tool.description}`
                  : `${system}\n\nAnswer with one JSON object only, no other text, matching this JSON Schema: ${JSON.stringify(tool.input_schema)}`,
              },
            ],
          },
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            ...(withSchema ? { responseSchema: geminiSchema(tool.input_schema as JsonSchema) } : {}),
            // Reading an exercise and naming its topic needs no long reasoning:
            // without "thinking" a 2.5 model answers in seconds.
            ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
            temperature: 0.2,
          },
        }),
      });
    } catch {
      return new Response(JSON.stringify({ error: { message: `${model} did not answer in time` } }), { status: 504 });
    }
  };

  // The chosen model first, then the others: one model can be overloaded (503),
  // slow (504), out of free-tier quota (429) or not offered to this key (404)
  // while the next one answers fine.
  const models = [...new Set([state.model ?? chosen, chosen, ...GEMINI_MODELS])];
  // Replaced on the first call; models is never empty.
  let response = new Response(null, { status: 599 });
  let used = chosen;
  for (const model of models) {
    used = model;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await call(model, true);
      // A schema this API version does not accept: describe it in words instead.
      if (response.status === 400) {
        const reason = await response.clone().text();
        if (/schema|Invalid JSON payload|Unknown name/i.test(reason)) response = await call(model, false);
      }
      // Busy for a moment: wait briefly and ask once more, if there is time.
      if ((response.status !== 503 && response.status !== 500) || deadline - Date.now() < 15_000) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (response.ok || ![404, 429, 500, 503, 504].includes(response.status) || deadline - Date.now() < 4000) break;
  }
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${(await response.text()).slice(0, 300)}`);
  state.model = used;

  const result = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini returned no answer (${result.promptFeedback?.blockReason ?? candidate?.finishReason ?? "empty"})`);
  // Without a schema a model may still wrap the JSON in a code fence.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text) as T;
}

/**
 * Gemini models in the order they are tried, all on the free tier. The 2.5
 * models first: fast with thinking off and less crowded than the newest one.
 * The "-latest" aliases follow, for when Google retires the 2.5 models.
 */
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest"];

/**
 * Shared by the calls of one lookup: the model that answered the first call is
 * asked first for the second, skipping one found down a moment ago.
 */
interface AIState {
  model: string | null;
}

/** Claude when its key is set, otherwise Gemini (which has a free tier). */
const askAI = <T>(
  system: string,
  content: ContentBlock[],
  tool: { name: string; description: string; input_schema: object },
  deadline: number,
  state: AIState,
) => (env("ANTHROPIC_API_KEY") ? askClaude<T>(system, content, tool, deadline) : askGemini<T>(system, content, tool, deadline, state));

const READ_SYSTEM = `You help Cambodian Grade 12 students revise for the BacII (បាក់ឌុប), the national upper-secondary exam.
A student is stuck on an exercise and wants a YouTube video that teaches it. Read the exercise (it may be in Khmer, English or French, typed or photographed, possibly handwritten) and report it with the tool.
- subject: the BacII subject it belongs to.
- topic_en / topic_km: the specific topic, as a teacher would name it (e.g. "Integration by parts" / "អាំងតេក្រាលដោយផ្នែក").
- summary: one or two plain English sentences on what the exercise asks.
- exercise_text: a faithful transcription of the exercise, at most 600 characters, formulas in plain text.
- bacii_year / exercise_number: only if the exercise clearly is from a BacII past paper (a header, a year, or a well-known exam exercise); otherwise null. Never guess.
- search_queries: 2 YouTube searches, most specific first. The first in Khmer, worded the way Cambodian teachers title their videos (for example "កំណែវិញ្ញាសាបាក់ឌុប ២០២៣ គណិតវិទ្យា លំហាត់ទី២" for a past paper, or "របៀបដោះស្រាយ អាំងតេក្រាលដោយផ្នែក" for a topic). The second in English. Do not put the whole exercise in a query.
- chapter_id / topic_id: if a list of Meh Rean chapters is given and the exercise clearly belongs to one, its id (and the topic's id, if one fits); otherwise null. When you set them, use that chapter's or topic's Khmer name in the Khmer search.
If the input is not a school exercise at all, set is_exercise to false.`;

const READ_TOOL = {
  name: "report_exercise",
  description: "Report what the exercise is about and how to search for videos teaching it.",
  input_schema: {
    type: "object",
    properties: {
      is_exercise: { type: "boolean" },
      subject: { type: "string", enum: [...SUBJECTS] },
      topic_en: { type: "string" },
      topic_km: { type: "string" },
      summary: { type: "string" },
      exercise_text: { type: "string" },
      bacii_year: { type: ["integer", "null"] },
      exercise_number: { type: ["string", "null"] },
      search_queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
      chapter_id: { type: ["string", "null"] },
      topic_id: { type: ["string", "null"] },
    },
    required: ["is_exercise", "subject", "topic_en", "topic_km", "summary", "exercise_text", "bacii_year", "exercise_number", "search_queries", "chapter_id", "topic_id"],
  },
};

const RANK_SYSTEM = `You match YouTube videos to a BacII exercise a Cambodian Grade 12 student is stuck on.
For each candidate video, judge from its title, channel and description:
- "exact": it works through this very exercise (the same past-paper exercise, or the same question).
- "same-topic": it teaches the method this exercise needs.
- "related": same subject and nearby topic; might help.
- "unrelated": does not help with this exercise.
Give a short reason (under 15 words) a student would understand. Rank the most useful first.
Some candidates list chapters the video's own creator wrote in its description (time in seconds and title). If one of those chapters is clearly where this exercise or method is worked through, give its seconds as start_seconds; otherwise null. Never give a time that is not listed.`;

const RANK_TOOL = {
  name: "rank_videos",
  description: "Rank the candidate videos for the student.",
  input_schema: {
    type: "object",
    properties: {
      ranked: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            match: { type: "string", enum: ["exact", "same-topic", "related", "unrelated"] },
            reason: { type: "string" },
            start_seconds: { type: ["integer", "null"] },
          },
          required: ["id", "match", "reason", "start_seconds"],
        },
      },
    },
    required: ["ranked"],
  },
};

// -------------------------------------------------------------- YouTube --

const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">" };
const decode = (text: string) => text.replace(/&(amp|quot|#39|lt|gt);/g, (entity) => ENTITIES[entity] ?? entity);

async function searchYouTube(query: string, language: string): Promise<Candidate[]> {
  const base = (env("YOUTUBE_API_BASE") || "https://www.googleapis.com/youtube/v3").replace(/\/$/, "");
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "8",
    q: query,
    regionCode: "KH",
    relevanceLanguage: language,
    safeSearch: "strict",
    videoEmbeddable: "true",
    key: env("YOUTUBE_API_KEY"),
  });
  const response = await fetch(`${base}/search?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`YouTube ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json()) as {
    items?: { id?: { videoId?: string }; snippet?: Record<string, unknown> }[];
  };
  return (body.items ?? []).flatMap((item) => {
    const id = item.id?.videoId;
    const snippet = item.snippet as
      | { title?: string; channelId?: string; channelTitle?: string; description?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> }
      | undefined;
    if (!id || !/^[\w-]{11}$/.test(id) || !snippet) return [];
    return [
      {
        id,
        channelId: snippet.channelId ?? "",
        title: decode(snippet.title ?? ""),
        channel: decode(snippet.channelTitle ?? ""),
        description: decode(snippet.description ?? "").slice(0, 300),
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        publishedAt: snippet.publishedAt ?? "",
      },
    ];
  });
}

// --------------------------------------------------- Video chapters (4.4) --
// Captions can only be downloaded by a video's owner, and scraping them is
// against YouTube's terms. What is public and lawful: the chapter times a
// creator writes in the description ("3:45 Exercise 2"), from videos.list
// (1 quota unit for up to 50 videos).

export interface VideoChapter {
  seconds: number;
  title: string;
}

const TIME = String.raw`((?:\d{1,2}:)?\d{1,2}:\d{2})`;
const TIME_FIRST = new RegExp(String.raw`^\s*[\[(]?${TIME}[\])]?\s*(?:[-–—:|.)]\s*)?(.+?)\s*$`);
const TIME_LAST = new RegExp(String.raw`^\s*(.+?)\s*[-–—:|]?\s*[\[(]?${TIME}[\])]?\s*$`);

/** Chapter times from a description: at least two, in order, else none. */
export function parseVideoChapters(description: string): VideoChapter[] {
  const seen = new Set<number>();
  const chapters: VideoChapter[] = [];
  for (const line of description.split(/\r?\n/).slice(0, 200)) {
    const first = TIME_FIRST.exec(line);
    const last = first ? null : TIME_LAST.exec(line);
    const time = first?.[1] ?? last?.[2];
    const title = (first?.[2] ?? last?.[1] ?? "").replace(/^[-–—:|.\s]+|[-–—:|.\s]+$/g, "").slice(0, 100);
    if (!time || !title) continue;
    const parts = time.split(":").map(Number);
    if (parts.slice(1).some((part) => part > 59)) continue;
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    if (seen.has(seconds) || seconds > 6 * 3600) continue;
    seen.add(seconds);
    chapters.push({ seconds, title });
  }
  chapters.sort((a, b) => a.seconds - b.seconds);
  return chapters.length >= 2 ? chapters.slice(0, 40) : [];
}

const chapterCacheById = new Map<string, { at: number; chapters: VideoChapter[] }>();

/** Chapters for these videos (full descriptions from videos.list), cached per video. */
async function videoChapters(ids: string[]): Promise<Map<string, VideoChapter[]>> {
  const found = new Map<string, VideoChapter[]>();
  const missing: string[] = [];
  for (const id of ids) {
    const hit = chapterCacheById.get(id);
    if (hit && Date.now() - hit.at < 24 * 3_600_000) found.set(id, hit.chapters);
    else missing.push(id);
  }
  if (missing.length) {
    const base = (env("YOUTUBE_API_BASE") || "https://www.googleapis.com/youtube/v3").replace(/\/$/, "");
    const params = new URLSearchParams({ part: "snippet", id: missing.slice(0, 50).join(","), key: env("YOUTUBE_API_KEY") });
    const response = await fetch(`${base}/videos?${params}`, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`YouTube videos ${response.status}`);
    const body = (await response.json()) as { items?: { id?: string; snippet?: { description?: string } }[] };
    for (const item of body.items ?? []) {
      if (!item.id) continue;
      const chapters = parseVideoChapters(item.snippet?.description ?? "");
      chapterCacheById.set(item.id, { at: Date.now(), chapters });
      found.set(item.id, chapters);
    }
    while (chapterCacheById.size > 2000) chapterCacheById.delete(chapterCacheById.keys().next().value!);
  }
  return found;
}

/**
 * Searches already made, kept while this server instance stays warm. The
 * same exercise (or the same topic from different students) then costs no
 * quota. Only this server writes it, so students cannot plant results.
 */
const searchCache = new Map<string, { at: number; videos: Candidate[] }>();
const SEARCH_CACHE_MAX = 300;

async function cachedSearch(query: string, language: string): Promise<{ videos: Candidate[]; fromCache: boolean }> {
  const key = `${language}|${query.toLowerCase().replace(/\s+/g, " ").trim()}`;
  const ttl = (Number(env("BACII_SEARCH_CACHE_HOURS")) || 24) * 3_600_000;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < ttl) return { videos: hit.videos, fromCache: true };
  const videos = await searchYouTube(query, language);
  searchCache.delete(key);
  searchCache.set(key, { at: Date.now(), videos });
  // Maps keep insertion order: drop the oldest.
  while (searchCache.size > SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value!);
  return { videos, fromCache: false };
}

const youtubeSearchUrl = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

// ----------------------------------------------------- Photo to solution --

const TRANSCRIBE_SYSTEM = `You read photos of exercises for Cambodian Grade 12 (BacII) students, mostly Mathematics and Physics, often handwritten or printed in Khmer.
Transcribe the exercise exactly as written, so the student can check it before it is solved:
- text: the whole exercise in its own language (Khmer stays Khmer). Every formula in LaTeX between $...$ (inline) or $$...$$ (on its own line). Keep numbering such as 1), a), b) and line breaks. Physics units as written. At most 3000 characters. Do not solve it and do not add anything.
- unclear: short notes on anything you could not read for sure (an empty list if none).
- subject: the BacII subject.
- chapter_id / topic_id: if a list of Meh Rean chapters is given and the exercise clearly belongs to one, its id (and the topic's, if one fits); otherwise null.
If the photo is not a school exercise, set is_exercise to false and text to "".`;

const TRANSCRIBE_TOOL = {
  name: "transcribe_exercise",
  description: "Report the exercise exactly as written in the photo.",
  input_schema: {
    type: "object",
    properties: {
      is_exercise: { type: "boolean" },
      transcript: { type: "string" },
      unclear: { type: "array", items: { type: "string" }, maxItems: 10 },
      subject: { type: "string", enum: [...SUBJECTS] },
      chapter_id: { type: ["string", "null"] },
      topic_id: { type: ["string", "null"] },
    },
    required: ["is_exercise", "transcript", "unclear", "subject", "chapter_id", "topic_id"],
  },
};

const SOLVE_SYSTEM = `You write worked solutions for Cambodian Grade 12 (BacII) students, the way a careful teacher writes on the board.
- steps: 2 to 12 short steps, one idea each, every formula in LaTeX between $...$. Write in the exercise's language: Khmer if the exercise is in Khmer, otherwise English.
- answer: the final answer or answers, short.
- confidence: "high" when you are sure, "medium", or "low" (for example when the exercise looks incomplete or ambiguous).
- caveats: what the student should double-check, or "" if nothing.
Never invent missing data: if the exercise cannot be solved as given, say so in caveats, give your best partial working, and set confidence to "low".`;

const SOLVE_TOOL = {
  name: "solve_exercise",
  description: "Give a step-by-step worked solution.",
  input_schema: {
    type: "object",
    properties: {
      steps: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 },
      answer: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      caveats: { type: "string" },
    },
    required: ["steps", "answer", "confidence", "caveats"],
  },
};

const clip = (value: unknown, max: number) => String(value ?? "").slice(0, max);

async function readPhoto(
  image: { mediaType: string; data: string },
  subject: string,
  chapters: ChapterInfo[],
  hinted: ChapterInfo | undefined,
  deadline: number,
  ai: AIState,
): Promise<Response> {
  let reading: { is_exercise: boolean; transcript: string; unclear: string[]; subject: string; chapter_id: string | null; topic_id: string | null };
  try {
    reading = await askAI(
      TRANSCRIBE_SYSTEM,
      [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        {
          type: "text",
          text: [
            subject ? `The student says the subject is: ${subject}.` : "",
            hinted ? `The student was studying this chapter: ${hinted.id} (${hinted.nameEn} / ${hinted.nameKm}).` : "",
            chapters.length ? `Meh Rean's Grade 12 chapters (a provisional outline):\n${chapterList(chapters)}` : "",
            "Transcribe the exercise in the photo.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      TRANSCRIBE_TOOL,
      deadline,
      ai,
    );
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not read the photo right now. Try again.", upstreamDetail(error));
  }
  if (!reading.is_exercise || !String(reading.transcript ?? "").trim()) {
    return fail(422, "NOT_AN_EXERCISE", "That does not look like an exercise. Try a clearer photo, or type it in.");
  }
  const chapter = chapters.find((item) => item.id === reading.chapter_id) ?? null;
  const topic = chapter?.topics.find((item) => item.id === reading.topic_id) ?? null;
  return json(200, {
    transcript: {
      text: clip(reading.transcript, 3000),
      unclear: (Array.isArray(reading.unclear) ? reading.unclear : []).slice(0, 10).map((note) => clip(note, 200)),
      subject: (SUBJECTS as readonly string[]).includes(reading.subject) ? reading.subject : "other",
      chapter: chapter ? { id: chapter.id, subjectId: chapter.subjectId, number: chapter.number, nameEn: chapter.nameEn, nameKm: chapter.nameKm } : null,
      topicId: topic?.id ?? null,
    },
  });
}

async function solveExercise(text: string, subject: string, chapter: ChapterInfo | undefined, deadline: number, ai: AIState): Promise<Response> {
  let solved: { steps: string[]; answer: string; confidence: string; caveats: string };
  try {
    solved = await askAI(
      SOLVE_SYSTEM,
      [
        {
          type: "text",
          text: [
            subject ? `Subject: ${subject}.` : "",
            chapter ? `Chapter: ${chapter.nameEn} (${chapter.nameKm}).` : "",
            `The exercise, as the student checked it:\n${text}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
      SOLVE_TOOL,
      deadline,
      ai,
    );
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not write a solution right now. Try again.", upstreamDetail(error));
  }
  const steps = (Array.isArray(solved.steps) ? solved.steps : []).map((step) => clip(step, 1500)).filter((step) => step.trim()).slice(0, 12);
  if (!steps.length) return fail(502, "UPSTREAM", "Could not write a solution right now. Try again.");
  return json(200, {
    solution: {
      steps,
      answer: clip(solved.answer, 600),
      confidence: ["high", "medium", "low"].includes(solved.confidence) ? solved.confidence : "low",
      caveats: clip(solved.caveats, 600),
      provider: env("ANTHROPIC_API_KEY") ? "Claude" : "Gemini",
    },
  });
}

// ------------------------------------------------------- Video quizzes --

const MAX_TRANSCRIPT = 30_000;

const QUIZ_SYSTEM = `You write short comprehension quizzes for Cambodian Grade 12 (BacII) students who have just watched a teaching video.
Use only what the transcript says: every question must be answerable from it, and the right answer must be clearly supported by it. Do not add outside facts.
- Write 5 multiple-choice questions in the requested language, from the most important ideas and worked steps, not trivia.
- choices: 4 short options, exactly one right; wrong options should be plausible mistakes a student might make.
- answer: the index (0-3) of the right option.
- explanation: one or two sentences on why, pointing to what the video says.
Formulas in LaTeX between $...$.`;

const QUIZ_TOOL = {
  name: "make_quiz",
  description: "Write the quiz questions.",
  input_schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
            answer: { type: "integer" },
            explanation: { type: "string" },
          },
          required: ["prompt", "choices", "answer", "explanation"],
        },
      },
    },
    required: ["questions"],
  },
};

async function isAdmin(token: string): Promise<boolean> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: supabaseKey(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return response.ok && (await response.json()) === true;
}

/** Drafts quiz questions from a transcript, for an admin to review. Nothing is stored here. */
async function draftQuiz(token: string, body: Body & { transcript?: unknown; language?: unknown; title?: unknown }): Promise<Response> {
  if (!(await isAdmin(token))) return fail(403, "FORBIDDEN", "Only admins can make video quizzes.");
  const transcript = typeof body.transcript === "string" ? body.transcript.trim().slice(0, MAX_TRANSCRIPT) : "";
  if (transcript.length < 200) return fail(400, "EMPTY", "Paste the video's transcript (at least a few sentences).");
  const language = body.language === "en" ? "English" : "Khmer";
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : "";
  let drafted: { questions: { prompt: string; choices: string[]; answer: number; explanation: string }[] };
  try {
    drafted = await askAI(
      QUIZ_SYSTEM,
      [{ type: "text", text: `Language for the quiz: ${language}.\nVideo title: ${title || "(not given)"}\n\nTranscript:\n${transcript}` }],
      QUIZ_TOOL,
      Date.now() + TIME_BUDGET_MS,
      { model: null },
    );
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not draft the quiz right now. Try again.", upstreamDetail(error));
  }
  const questions = (Array.isArray(drafted.questions) ? drafted.questions : [])
    .map((item) => ({
      prompt: clip(item.prompt, 600).trim(),
      choices: (Array.isArray(item.choices) ? item.choices : []).map((choice) => clip(choice, 300).trim()).filter(Boolean).slice(0, 5),
      answer: Number.isInteger(item.answer) ? item.answer : 0,
      explanation: clip(item.explanation, 800).trim(),
    }))
    .filter((item) => item.prompt && item.choices.length >= 2 && item.answer >= 0 && item.answer < item.choices.length)
    .slice(0, 5);
  if (!questions.length) return fail(502, "UPSTREAM", "The draft had no usable questions. Try again.");
  return json(200, { questions });
}

// -------------------------------------------------------------- handler --

interface Body {
  /** "videos" (default), "read", "solve" or "quiz". */
  task?: unknown;
  text?: unknown;
  subject?: unknown;
  /** The chapter the student was studying, when they came from one (a hint). */
  chapterId?: unknown;
  image?: { mediaType?: unknown; data?: unknown } | null;
}

/** Vercel stops the function at 60s (vercel.json); finish well before that. */
const TIME_BUDGET_MS = 50_000;

export async function POST(request: Request): Promise<Response> {
  const deadline = Date.now() + TIME_BUDGET_MS;
  const ai: AIState = { model: null };
  // Names only, never values: tells the site owner which setting to add.
  const missing = [
    !env("ANTHROPIC_API_KEY") && !env("GEMINI_API_KEY") && "GEMINI_API_KEY",
    !supabaseUrl() && "VITE_SUPABASE_URL",
    !supabaseKey() && "VITE_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    return json(503, {
      error: { code: "NOT_CONFIGURED", message: "Video search is not set up on this server yet.", missing },
    });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return fail(401, "UNAUTHORIZED", "Sign in to search for videos.");

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail(400, "BAD_REQUEST", "The request was not valid JSON.");
  }

  const task = body.task === "read" || body.task === "solve" || body.task === "quiz" ? body.task : "videos";
  if (task === "quiz") return draftQuiz(token, body);
  if (task === "videos" && !env("YOUTUBE_API_KEY")) {
    return json(503, { error: { code: "NOT_CONFIGURED", message: "Video search is not set up on this server yet.", missing: ["YOUTUBE_API_KEY"] } });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  const subject = typeof body.subject === "string" && (SUBJECTS as readonly string[]).includes(body.subject) ? body.subject : "";
  let image: { mediaType: string; data: string } | null = null;
  if (body.image) {
    const { mediaType, data } = body.image;
    if (typeof mediaType !== "string" || !IMAGE_TYPES.has(mediaType) || typeof data !== "string" || !/^[A-Za-z0-9+/=]+$/.test(data)) {
      return fail(400, "BAD_IMAGE", "Send the photo as a JPEG, PNG, WebP or GIF.");
    }
    if (data.length * 0.75 > MAX_IMAGE_BYTES) return fail(413, "IMAGE_TOO_LARGE", "The photo is too large.");
    image = { mediaType, data };
  }
  if (!text && !image) return fail(400, "EMPTY", "Add a photo of the exercise or type it in.");
  if (task === "read" && !image) return fail(400, "EMPTY", "Add a photo of the exercise to read.");
  if (task === "solve" && !text) return fail(400, "EMPTY", "Type or check the exercise first.");

  const userId = await userFromToken(token);
  if (!userId) return fail(401, "UNAUTHORIZED", "Your session has expired. Sign in again.");

  const limit = Number(env("BACII_DAILY_LIMIT")) || 20;
  try {
    const taken = await takeLookup(token, limit);
    if (taken === "limit") return fail(429, "LIMIT", `You can look up ${limit} exercises a day. Try again tomorrow.`);
    if (taken === "setup") return fail(503, "NOT_CONFIGURED", "Video search needs the latest supabase/schema.sql.");
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not check your daily lookups. Try again.", upstreamDetail(error));
  }

  // 1. Read the exercise, placing it in Meh Rean's chapters when it fits one.
  const chapters = await curriculumChapters();
  const hinted = typeof body.chapterId === "string" ? chapters.find((chapter) => chapter.id === body.chapterId) : undefined;
  if (task === "read") return readPhoto(image!, subject, chapters, hinted, deadline, ai);
  if (task === "solve") return solveExercise(text, subject, hinted, deadline, ai);
  let reading: ExerciseReading;
  try {
    const content: ContentBlock[] = [];
    if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
    content.push({
      type: "text",
      text: [
        subject ? `The student says the subject is: ${subject}.` : "The student did not say which subject.",
        hinted ? `The student was studying this chapter: ${hinted.id} (${hinted.nameEn} / ${hinted.nameKm}).` : "",
        chapters.length ? `Meh Rean's Grade 12 chapters (a provisional outline):\n${chapterList(chapters)}` : "",
        text ? `The exercise, as the student typed it:\n${text}` : "The exercise is in the photo.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    // Leave time for the YouTube search after reading.
    reading = await askAI<ExerciseReading>(READ_SYSTEM, content, READ_TOOL, deadline - 8000, ai);
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not read the exercise right now. Try again.", upstreamDetail(error));
  }
  if (!reading.is_exercise) {
    return fail(422, "NOT_AN_EXERCISE", "That does not look like an exercise. Try a clearer photo, or type it in.");
  }
  // Only ids that exist, and a topic only inside its chapter.
  const chapter = chapters.find((item) => item.id === reading.chapter_id) ?? null;
  const topic = chapter?.topics.find((item) => item.id === reading.topic_id) ?? null;
  const queries = (reading.search_queries ?? []).map((query) => String(query).trim()).filter(Boolean).slice(0, 2);
  if (!queries.length) queries.push(topic?.nameKm || chapter?.nameKm || reading.topic_km || reading.topic_en);

  // 2. Search YouTube: each search costs quota, so two at most, reused when cached.
  let candidates: Candidate[] = [];
  try {
    const results = await Promise.all(queries.map((query, index) => cachedSearch(query, index === 0 ? "km" : "en")));
    const searches = results.filter((result) => !result.fromCache).length;
    if (searches) await logSearches(token, searches).catch((error) => console.error(error));
    const seen = new Set<string>();
    candidates = results.flatMap((result) => result.videos).filter((video) => !seen.has(video.id) && seen.add(video.id));
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not search YouTube right now. Try again.", upstreamDetail(error));
  }

  // Chapter times from the videos' own descriptions, when they have them.
  const chaptersOf = candidates.length ? await videoChapters(candidates.map((video) => video.id)).catch((error) => (console.error(error), new Map<string, VideoChapter[]>())) : new Map<string, VideoChapter[]>();

  // 3. Rank them against the exercise; if that fails, keep YouTube's order.
  let videos: (Candidate & { match: Match; reason: string; start: VideoChapter | null })[] = candidates.map((video) => ({ ...video, match: "related", reason: "", start: null }));
  // Ranking is a bonus: skipped when reading the exercise used up the time.
  if (candidates.length && deadline - Date.now() > 10_000) {
    try {
      const { ranked } = await askAI<{ ranked: { id: string; match: string; reason: string; start_seconds?: number | null }[] }>(
        RANK_SYSTEM,
        [
          {
            type: "text",
            text: JSON.stringify({
              exercise: {
                subject: reading.subject,
                topic: `${reading.topic_en} / ${reading.topic_km}`,
                curriculum: chapter ? { chapter: `${chapter.nameEn} / ${chapter.nameKm}`, topic: topic ? `${topic.nameEn} / ${topic.nameKm}` : null } : null,
                summary: reading.summary,
                text: reading.exercise_text,
                bacii_paper: reading.bacii_year ? { year: reading.bacii_year, exercise: reading.exercise_number } : null,
              },
              candidates: candidates.map(({ id, title, channel, description }) => ({
                id,
                title,
                channel,
                description,
                ...(chaptersOf.get(id)?.length ? { chapters: chaptersOf.get(id)!.map(({ seconds, title: name }) => ({ seconds, title: name })) } : {}),
              })),
            }),
          },
        ],
        RANK_TOOL,
        deadline,
        ai,
      );
      const byId = new Map(candidates.map((video) => [video.id, video]));
      const order: Match[] = ["exact", "same-topic", "related"];
      videos = ranked
        .filter((entry) => byId.has(entry.id) && order.includes(entry.match as Match))
        .map((entry) => ({
          ...byId.get(entry.id)!,
          match: entry.match as Match,
          reason: String(entry.reason ?? "").slice(0, 160),
          // Only a time the creator listed; the model cannot invent one.
          start: chaptersOf.get(entry.id)?.find((chapter) => chapter.seconds === entry.start_seconds) ?? null,
        }))
        .sort((a, b) => order.indexOf(a.match) - order.indexOf(b.match));
    } catch (error) {
      console.error(error);
    }
  }

  // 4. Prefer Khmer and trusted channels within each match level (roadmap 4.3).
  const trusted = await trustedChannels();
  const isTrusted = (channelId: string) =>
    trusted.some((channel) => channel.channelId === channelId && (!channel.subjectKeys.length || channel.subjectKeys.includes(reading.subject)));
  const tier: Match[] = ["exact", "same-topic", "related"];
  const labelled = videos.map((video, index) => ({
    ...video,
    language: KHMER.test(`${video.title} ${video.description}`) ? ("km" as const) : ("other" as const),
    trusted: isTrusted(video.channelId),
    index,
  }));
  labelled.sort(
    (a, b) =>
      tier.indexOf(a.match) - tier.indexOf(b.match) ||
      Number(b.trusted) - Number(a.trusted) ||
      Number(b.language === "km") - Number(a.language === "km") ||
      a.index - b.index,
  );

  return json(200, {
    exercise: {
      subject: reading.subject,
      topic: reading.topic_en,
      topicKm: reading.topic_km,
      summary: reading.summary,
      paper: reading.bacii_year ? { year: reading.bacii_year, exercise: reading.exercise_number } : null,
      chapter: chapter ? { id: chapter.id, subjectId: chapter.subjectId, number: chapter.number, nameEn: chapter.nameEn, nameKm: chapter.nameKm } : null,
      topicId: topic?.id ?? null,
    },
    queries,
    searchUrl: youtubeSearchUrl(queries[0]),
    videos: labelled.slice(0, 10).map(({ index: _index, ...video }) => video),
  });
}

/** How many lookups the student has left today, and how much YouTube quota is used. */
export async function GET(request: Request): Promise<Response> {
  if (!supabaseUrl() || !supabaseKey()) return fail(503, "NOT_CONFIGURED", "Video search is not set up on this server yet.");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token || !(await userFromToken(token))) return fail(401, "UNAUTHORIZED", "Sign in to search for videos.");
  try {
    const [used, units] = await Promise.all([countLookups(token), youtubeUnitsToday(token)]);
    if (used === null) return fail(503, "NOT_CONFIGURED", "Video search needs the latest supabase/schema.sql.");
    return json(200, {
      lookups: { used, limit: Number(env("BACII_DAILY_LIMIT")) || 20 },
      youtube: units === null ? null : { unitsUsed: units, unitsLimit: Number(env("YOUTUBE_DAILY_QUOTA")) || 10_000 },
    });
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not check your lookups. Try again.", upstreamDetail(error));
  }
}
