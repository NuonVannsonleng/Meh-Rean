#!/usr/bin/env node
/**
 * The whole video lookup (api/bacii-videos.ts), with a stand-in Gemini and
 * YouTube on a local port and a real local Supabase for sign-in, lookups and
 * admins' topic videos. Checks what is searched (Khmer first, never the
 * question's sentence), what comes first, admins' videos, Shorts, and the
 * order when the ranking model fails. It does not judge real AI answers.
 *
 * Usage: npm run test:video-finder   (local Supabase only)
 */
import { createServer } from "node:http";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("video finder", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

// ---- stand-in Gemini and YouTube ---------------------------------------------
const seen = { searches: [], rankInputs: [] };
let reading = null;
let ranking = null;
let rankStatus = 200;
let library = {};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname.startsWith("/v1beta/models/")) {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    const system = body.systemInstruction.parts[0].text;
    if (system.startsWith("You match YouTube videos")) {
      seen.rankInputs.push(JSON.parse(body.contents[0].parts[0].text));
      if (rankStatus !== 200) return send(rankStatus, { error: { message: "stand-in failure" } });
      return send(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ ranked: ranking }) }] } }] });
    }
    return send(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(reading) }] } }] });
  }
  if (url.pathname === "/search") {
    const q = url.searchParams.get("q");
    seen.searches.push({ q, language: url.searchParams.get("relevanceLanguage") });
    const items = Object.entries(library)
      .filter(([, video]) => video.inSearch)
      .map(([id, video]) => ({ id: { videoId: id }, snippet: { title: video.title, channelId: "UC" + id, channelTitle: video.channel ?? "A teacher", description: (video.description ?? "").slice(0, 100), publishedAt: "2024-01-01T00:00:00Z" } }));
    return send(200, { items });
  }
  if (url.pathname === "/videos") {
    const ids = url.searchParams.get("id").split(",");
    const items = ids
      .filter((id) => library[id])
      .map((id) => ({
        id,
        snippet: { title: library[id].title, channelId: "UC" + id, channelTitle: library[id].channel ?? "A teacher", description: library[id].description ?? "", tags: library[id].tags ?? [] },
        contentDetails: { duration: library[id].duration ?? "PT15M" },
      }));
    return send(200, { items });
  }
  send(404, {});
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
Object.assign(process.env, {
  GEMINI_API_KEY: "stand-in",
  GEMINI_BASE_URL: base,
  YOUTUBE_API_KEY: "stand-in",
  YOUTUBE_API_BASE: base,
  VITE_SUPABASE_URL: target.url,
  VITE_SUPABASE_PUBLISHABLE_KEY: target.key,
});
delete process.env.ANTHROPIC_API_KEY;
const { POST } = await import("../api/bacii-videos.ts");

const people = accounts(target, "finder");
const student = await people.create("s");
const token = (await student.client.auth.getSession()).data.session.access_token;
const lookup = async (body) => {
  const response = await POST(new Request("http://localhost/api/bacii-videos", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
  const json = await response.json();
  if (response.status !== 200) throw new Error(`${response.status}: ${JSON.stringify(json)}`);
  return json;
};
const KHMER = /[ក-៿]/;
const baseReading = { is_exercise: true, summary: "", bacii_year: null, exercise_number: null, chapter_id: null, topic_id: null };

// ---- 1. A Khmer literature essay --------------------------------------------------
await check("an essay: Khmer searches from the key terms only; the matching Khmer lesson first; the Short dropped", async () => {
  seen.searches.length = 0;
  reading = {
    ...baseReading,
    subject: "khmer-literature",
    question_type: "essay",
    topic_en: "Tum Teav",
    topic_km: "រឿងទុំទាវ",
    key_terms_km: ["ទុំទាវ", "ភាពស្មោះត្រង់"],
    key_terms_en: ["Tum Teav"],
    exercise_text: "ចូរពន្យល់ពីភាពស្មោះត្រង់ក្នុងស្នេហារបស់ទុំ និងទាវ ក្នុងរឿង «ទុំទាវ»។",
    search_queries: ["ចូរពន្យល់ពីភាពស្មោះត្រង់ក្នុងស្នេហារបស់ទុំ និងទាវ ក្នុងរឿង", "Tum Teav essay explained"],
  };
  library = {
    lessonKhmer: { title: "ពន្យល់រឿង ទុំទាវ ភាពស្មោះត្រង់ អក្សរសាស្ត្រខ្មែរ ថ្នាក់ទី១២", inSearch: true, duration: "PT18M" },
    englishTalk: { title: "Cambodian folk tales overview", inSearch: true },
    shortClip01: { title: "ទុំទាវ #shorts", inSearch: true, duration: "PT40S" },
  };
  ranking = [
    { id: "englishTalk", match: "related", reason: "Background on the folk tale.", start_seconds: null },
    { id: "lessonKhmer", match: "same-topic", reason: "Explains Tum Teav's faithfulness.", start_seconds: null },
    { id: "shortClip01", match: "unrelated", reason: "Too short.", start_seconds: null },
  ];
  const result = await lookup({ text: reading.exercise_text, subject: "khmer-literature" });
  assert(seen.searches.length === 2 && seen.searches.every((item) => item.language === "km" && KHMER.test(item.q)), JSON.stringify(seen.searches));
  assert(!seen.searches.some((item) => item.q.startsWith("ចូរ")), "searched the question's sentence");
  assert(result.videos[0].id === "lessonKhmer", result.videos.map((video) => video.id).join(","));
  assert(!result.videos.some((video) => video.id === "shortClip01"), "the Short is listed");
  assert(result.exercise.questionType === "essay" && result.exercise.keyTerms.km.includes("ទុំទាវ"), JSON.stringify(result.exercise.keyTerms));
  assert(result.exercise.text.includes("ទុំ"), "no exercise text for question matching");
  assert(result.videos[0].durationSeconds === 1080, String(result.videos[0].durationSeconds));
  return seen.searches.map((item) => item.q).join(" | ");
});

// ---- 2. A maths past-paper exercise with an admin's video -----------------------
const topicId = "kh-grade12-science-mathematics-integrals-by-parts";
const chapterId = sql(`select chapter_id from public.curriculum_topics where id = '${topicId}'`);
sql(`delete from public.resource_topics where resource_id = 'checkedVid1'`);
sql(`insert into public.resource_topics (resource_type, resource_id, topic_id, title) values ('video', 'checkedVid1', '${topicId}', 'Integration by parts, step by step')`);

await check("a past paper: two Khmer searches and one English; the same exercise first, then the admins' video", async () => {
  seen.searches.length = 0;
  seen.rankInputs.length = 0;
  reading = {
    ...baseReading,
    subject: "mathematics",
    question_type: "calculation",
    topic_en: "Integration by parts",
    topic_km: "អាំងតេក្រាលដោយផ្នែក",
    key_terms_km: ["អាំងតេក្រាលដោយផ្នែក"],
    key_terms_en: ["integration by parts"],
    exercise_text: "គណនា I = ∫ x e^x dx ពី 0 ដល់ 1",
    bacii_year: 2023,
    exercise_number: "2",
    chapter_id: chapterId,
    topic_id: topicId,
    search_queries: ["កំណែវិញ្ញាសាបាក់ឌុប ២០២៣ គណិតវិទ្យា លំហាត់ទី២", "integration by parts BacII"],
  };
  library = {
    samePaper01: { title: "កំណែវិញ្ញាសាបាក់ឌុប ២០២៣ គណិតវិទ្យា លំហាត់ទី២", inSearch: true },
    otherYear01: { title: "កំណែវិញ្ញាសាបាក់ឌុប ២០២១ គណិតវិទ្យា លំហាត់ទី២", inSearch: true },
    checkedVid1: { title: "Integration by parts, step by step", inSearch: false, duration: "PT22M" },
  };
  // The model forgets the admins' video: it must still be listed.
  ranking = [
    { id: "samePaper01", match: "exact", reason: "Works this very exercise.", start_seconds: null },
    { id: "otherYear01", match: "related", reason: "Another year's paper.", start_seconds: null },
  ];
  const result = await lookup({ text: reading.exercise_text, subject: "mathematics" });
  assert(seen.searches.map((item) => item.language).join(",") === "km,km,en", JSON.stringify(seen.searches));
  assert(seen.rankInputs[0].candidates.some((video) => video.id === "checkedVid1" && video.checked), "the admins' video was not offered to the model");
  const order = result.videos.map((video) => `${video.id}:${video.match}`).join(",");
  assert(order === "samePaper01:exact,checkedVid1:same-topic,otherYear01:related", order);
  assert(result.videos[1].checked === true, "not marked as checked");
  return order;
});

// ---- 3. The ranking model fails ----------------------------------------------------
await check("when ranking fails: ordered by what the titles share with the exercise; Shorts left out", async () => {
  rankStatus = 400;
  reading = {
    ...baseReading,
    subject: "history",
    question_type: "short-answer",
    topic_en: "The fall of Angkor",
    topic_km: "ការដួលរលំនៃអង្គរ",
    key_terms_km: ["អង្គរ", "ការដួលរលំ"],
    key_terms_en: ["Angkor"],
    exercise_text: "តើមូលហេតុអ្វីខ្លះដែលនាំឲ្យអង្គរដួលរលំ?",
    search_queries: ["ប្រវត្តិវិទ្យា ថ្នាក់ទី១២ ការដួលរលំនៃអង្គរ"],
  };
  library = {
    noTerms0001: { title: "Grade 12 history revision", inSearch: true },
    bothTerms01: { title: "ប្រវត្តិវិទ្យា ការដួលរលំនៃអង្គរ", inSearch: true },
    oneTerm0001: { title: "អង្គរ សម័យមហានគរ", inSearch: true },
    shortOne001: { title: "អង្គរ ការដួលរលំ", inSearch: true, duration: "PT30S" },
  };
  const result = await lookup({ text: reading.exercise_text, subject: "history" });
  rankStatus = 200;
  const ids = result.videos.map((video) => video.id);
  assert(ids[0] === "bothTerms01" && ids[1] === "oneTerm0001", ids.join(","));
  assert(!ids.includes("shortOne001") && !ids.includes("noTerms0001"), ids.join(","));
  return ids.join(",");
});

sql(`delete from public.resource_topics where resource_id = 'checkedVid1'`);
await people.cleanUp();
server.close();
finish();
