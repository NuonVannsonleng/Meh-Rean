/**
 * POST /api/bacii-videos — "Stuck on an exercise?" for BacII (Grade 12) students.
 *
 * Takes an exercise as a photo and/or text, has Claude read it (subject, topic,
 * which BacII paper it is from if it can tell), searches YouTube for teaching
 * videos in Khmer and English, then has Claude rank them so a video that works
 * the very same exercise comes first.
 *
 * Runs as a Vercel Function, so the keys stay on the server. Environment:
 *   ANTHROPIC_API_KEY    required, from console.anthropic.com
 *   YOUTUBE_API_KEY      required, YouTube Data API v3 key from Google Cloud
 *   BACII_AI_MODEL       optional, default claude-opus-5-5
 *   BACII_DAILY_LIMIT    optional, lookups per student per day, default 20
 *   VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY), which
 *   the app already has: used to check who is asking and to count lookups.
 *
 * Only signed-in students can use it, each up to the daily limit, so the keys
 * cannot be spent by anyone on the internet. Lookups are counted in
 * public.bacii_video_lookups (supabase/schema.sql) with the student's own
 * session, under row level security: no service key is needed.
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
}

interface Candidate {
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

const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } });

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
async function takeLookup(token: string, limit: number): Promise<"ok" | "limit" | "setup"> {
  const headers = { apikey: supabaseKey(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = await fetch(
    `${supabaseUrl()}/rest/v1/bacii_video_lookups?select=id&created_at=gte.${encodeURIComponent(since)}`,
    { method: "HEAD", headers: { ...headers, Prefer: "count=exact" } },
  );
  if (count.status === 404) return "setup";
  if (!count.ok) throw new Error(`lookup count failed: ${count.status}`);
  const used = Number(count.headers.get("content-range")?.split("/")[1] ?? "0");
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

// --------------------------------------------------------------- Claude --

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/** One Claude call that must answer through `tool`; returns the tool's input. */
async function askClaude<T>(system: string, content: ContentBlock[], tool: { name: string; description: string; input_schema: object }): Promise<T> {
  const base = (env("ANTHROPIC_BASE_URL") || "https://api.anthropic.com").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
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

const READ_SYSTEM = `You help Cambodian Grade 12 students revise for the BacII (បាក់ឌុប), the national upper-secondary exam.
A student is stuck on an exercise and wants a YouTube video that teaches it. Read the exercise (it may be in Khmer, English or French, typed or photographed, possibly handwritten) and report it with the tool.
- subject: the BacII subject it belongs to.
- topic_en / topic_km: the specific topic, as a teacher would name it (e.g. "Integration by parts" / "អាំងតេក្រាលដោយផ្នែក").
- summary: one or two plain English sentences on what the exercise asks.
- exercise_text: a faithful transcription of the exercise, at most 600 characters, formulas in plain text.
- bacii_year / exercise_number: only if the exercise clearly is from a BacII past paper (a header, a year, or a well-known exam exercise); otherwise null. Never guess.
- search_queries: 2 YouTube searches, most specific first. The first in Khmer, worded the way Cambodian teachers title their videos (for example "កំណែវិញ្ញាសាបាក់ឌុប ២០២៣ គណិតវិទ្យា លំហាត់ទី២" for a past paper, or "របៀបដោះស្រាយ អាំងតេក្រាលដោយផ្នែក" for a topic). The second in English. Do not put the whole exercise in a query.
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
    },
    required: ["is_exercise", "subject", "topic_en", "topic_km", "summary", "exercise_text", "bacii_year", "exercise_number", "search_queries"],
  },
};

const RANK_SYSTEM = `You match YouTube videos to a BacII exercise a Cambodian Grade 12 student is stuck on.
For each candidate video, judge from its title, channel and description:
- "exact": it works through this very exercise (the same past-paper exercise, or the same question).
- "same-topic": it teaches the method this exercise needs.
- "related": same subject and nearby topic; might help.
- "unrelated": does not help with this exercise.
Give a short reason (under 15 words) a student would understand. Rank the most useful first.`;

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
          },
          required: ["id", "match", "reason"],
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
  const response = await fetch(`${base}/search?${params}`);
  if (!response.ok) throw new Error(`YouTube ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = (await response.json()) as {
    items?: { id?: { videoId?: string }; snippet?: Record<string, unknown> }[];
  };
  return (body.items ?? []).flatMap((item) => {
    const id = item.id?.videoId;
    const snippet = item.snippet as
      | { title?: string; channelTitle?: string; description?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> }
      | undefined;
    if (!id || !/^[\w-]{11}$/.test(id) || !snippet) return [];
    return [
      {
        id,
        title: decode(snippet.title ?? ""),
        channel: decode(snippet.channelTitle ?? ""),
        description: decode(snippet.description ?? "").slice(0, 300),
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        publishedAt: snippet.publishedAt ?? "",
      },
    ];
  });
}

const youtubeSearchUrl = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

// -------------------------------------------------------------- handler --

interface Body {
  text?: unknown;
  subject?: unknown;
  image?: { mediaType?: unknown; data?: unknown } | null;
}

export async function POST(request: Request): Promise<Response> {
  // Names only, never values: tells the site owner which setting to add.
  const missing = [
    !env("ANTHROPIC_API_KEY") && "ANTHROPIC_API_KEY",
    !env("YOUTUBE_API_KEY") && "YOUTUBE_API_KEY",
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

  const userId = await userFromToken(token);
  if (!userId) return fail(401, "UNAUTHORIZED", "Your session has expired. Sign in again.");

  const limit = Number(env("BACII_DAILY_LIMIT")) || 20;
  try {
    const taken = await takeLookup(token, limit);
    if (taken === "limit") return fail(429, "LIMIT", `You can look up ${limit} exercises a day. Try again tomorrow.`);
    if (taken === "setup") return fail(503, "NOT_CONFIGURED", "Video search needs the latest supabase/schema.sql.");
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not check your daily lookups. Try again.");
  }

  // 1. Read the exercise.
  let reading: ExerciseReading;
  try {
    const content: ContentBlock[] = [];
    if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
    content.push({
      type: "text",
      text: [
        subject ? `The student says the subject is: ${subject}.` : "The student did not say which subject.",
        text ? `The exercise, as the student typed it:\n${text}` : "The exercise is in the photo.",
      ].join("\n\n"),
    });
    reading = await askClaude<ExerciseReading>(READ_SYSTEM, content, READ_TOOL);
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not read the exercise right now. Try again.");
  }
  if (!reading.is_exercise) {
    return fail(422, "NOT_AN_EXERCISE", "That does not look like an exercise. Try a clearer photo, or type it in.");
  }
  const queries = (reading.search_queries ?? []).map((query) => String(query).trim()).filter(Boolean).slice(0, 2);
  if (!queries.length) queries.push(reading.topic_km || reading.topic_en);

  // 2. Search YouTube: each search costs quota, so two at most.
  let candidates: Candidate[] = [];
  try {
    const results = await Promise.all(queries.map((query, index) => searchYouTube(query, index === 0 ? "km" : "en")));
    const seen = new Set<string>();
    candidates = results.flat().filter((video) => !seen.has(video.id) && seen.add(video.id));
  } catch (error) {
    console.error(error);
    return fail(502, "UPSTREAM", "Could not search YouTube right now. Try again.");
  }

  // 3. Rank them against the exercise; if that fails, keep YouTube's order.
  let videos: (Candidate & { match: Match; reason: string })[] = candidates.map((video) => ({ ...video, match: "related", reason: "" }));
  if (candidates.length) {
    try {
      const { ranked } = await askClaude<{ ranked: { id: string; match: string; reason: string }[] }>(
        RANK_SYSTEM,
        [
          {
            type: "text",
            text: JSON.stringify({
              exercise: {
                subject: reading.subject,
                topic: `${reading.topic_en} / ${reading.topic_km}`,
                summary: reading.summary,
                text: reading.exercise_text,
                bacii_paper: reading.bacii_year ? { year: reading.bacii_year, exercise: reading.exercise_number } : null,
              },
              candidates: candidates.map(({ id, title, channel, description }) => ({ id, title, channel, description })),
            }),
          },
        ],
        RANK_TOOL,
      );
      const byId = new Map(candidates.map((video) => [video.id, video]));
      const order: Match[] = ["exact", "same-topic", "related"];
      videos = ranked
        .filter((entry) => byId.has(entry.id) && order.includes(entry.match as Match))
        .map((entry) => ({ ...byId.get(entry.id)!, match: entry.match as Match, reason: String(entry.reason ?? "").slice(0, 160) }))
        .sort((a, b) => order.indexOf(a.match) - order.indexOf(b.match));
    } catch (error) {
      console.error(error);
    }
  }

  return json(200, {
    exercise: {
      subject: reading.subject,
      topic: reading.topic_en,
      topicKm: reading.topic_km,
      summary: reading.summary,
      paper: reading.bacii_year ? { year: reading.bacii_year, exercise: reading.exercise_number } : null,
    },
    queries,
    searchUrl: youtubeSearchUrl(queries[0]),
    videos: videos.slice(0, 10),
  });
}
