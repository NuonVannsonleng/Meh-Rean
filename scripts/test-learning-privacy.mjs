#!/usr/bin/env node
/**
 * Student data isolation across every table that holds personal learning
 * data (Learning OS 1.5), against a LOCAL Supabase only. One student creates
 * real data through the normal paths; another student, an admin and a
 * visitor then try to read, change and delete it.
 *
 *   npm run test:learning-privacy
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("privacy checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}
const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const paperA = demo.papers.find((paper) => paper.year === 2023);
const paperB = demo.papers.find((paper) => paper.year === 2024);
const [q1, , q3] = paperB.questions;
if (sql(`select count(*) from public.questions where id = '${q1.id}'`) !== "1") {
  skip("privacy checks", "the demo papers are not loaded");
  finish();
}

const people = accounts(target, "privacy");
const { anon } = people;
const owner = await people.create("s");
const peer = await people.create("p");
const admin = await people.create("a", { admin: true });
const me = owner.client;

// The owner's real activity, through the normal paths.
await me.rpc("record_practice_answer", { question: q3.id, answer: "11", request: randomUUID() });
await me.rpc("daily_question");
const exam = (await me.rpc("start_exam", { paper: paperA.id, practice_minutes: 30 })).data[0].attempt_id;
await me.rpc("save_exam_answer", { attempt: exam, question: paperA.questions[0].id, answer: "a" });
const examDate = sql("select ((now() at time zone 'Asia/Phnom_Penh')::date + 60)::text");
await me.from("study_plans").upsert({ user_id: owner.id, subject_id: "kh-grade12-science-mathematics", exam_date: examDate, hours_per_day: 2, days_per_week: 5, target_grade: "C", weak_chapter_ids: [], weeks: [] });
await me.from("video_progress").upsert({ user_id: owner.id, video_id: "abcdefghijk", title: "A lesson", status: "watched" });
await me.from("learning_profiles").upsert({ user_id: owner.id, target_grade: "B", session_minutes: 30 });
await me.from("youtube_search_log").insert({ searches: 1 });
await me.from("bacii_video_lookups").insert({});

const TABLES = [
  ["mistakes", "user_id"],
  ["chapter_progress", "user_id"],
  ["daily_questions", "user_id"],
  ["exam_attempts", "user_id"],
  ["study_plans", "user_id"],
  ["video_progress", "user_id"],
  ["learning_events", "user_id"],
  ["learning_profiles", "user_id"],
  ["youtube_search_log", "user_id"],
  ["bacii_video_lookups", "user_id"],
];

await check("the owner can see their own data in every table (so the checks below mean something)", async () => {
  const empty = [];
  for (const [table, column] of TABLES) {
    const { data, error } = await me.from(table).select(column).eq(column, owner.id);
    if (error || !data?.length) empty.push(`${table}${error ? ` (${error.message})` : ""}`);
  }
  const answers = await me.from("exam_answers").select("attempt_id").eq("attempt_id", exam);
  if (!answers.data?.length) empty.push("exam_answers");
  assert(!empty.length, `no own rows in: ${empty.join(", ")}`);
});

for (const [who, client] of [
  ["another student", peer.client],
  ["an admin", admin.client],
  ["a visitor", anon],
]) {
  await check(`${who} cannot read the owner's private learning data`, async () => {
    const leaked = [];
    for (const [table, column] of TABLES) {
      const { data } = await client.from(table).select(column).eq(column, owner.id);
      if (data?.length) leaked.push(table);
    }
    const answers = await client.from("exam_answers").select("attempt_id").eq("attempt_id", exam);
    if (answers.data?.length) leaked.push("exam_answers");
    assert(!leaked.length, `readable: ${leaked.join(", ")}`);
  });
}

await check("another student cannot change or delete any of it", async () => {
  const touched = [];
  for (const [table, column] of TABLES) {
    const updated = await peer.client.from(table).update({ [column]: peer.id }).eq(column, owner.id).select();
    if (updated.data?.length) touched.push(`${table} (update)`);
    const removed = await peer.client.from(table).delete().eq(column, owner.id).select();
    if (removed.data?.length) touched.push(`${table} (delete)`);
  }
  assert(!touched.length, touched.join(", "));
  const still = await me.from("learning_events").select("id").eq("user_id", owner.id);
  assert(still.data?.length, "the owner's events are gone");
});

await check("nobody can write rows in someone else's name", async () => {
  const forged = [];
  const attempts = [
    ["learning_profiles", { user_id: owner.id, target_grade: "F" }],
    ["video_progress", { user_id: owner.id, video_id: "zzzzzzzzzzz", title: "x", status: "watched" }],
    ["study_plans", { user_id: owner.id, subject_id: "kh-grade12-science-mathematics", exam_date: examDate, hours_per_day: 1, days_per_week: 1, target_grade: "F", weak_chapter_ids: [], weeks: [] }],
    ["youtube_search_log", { user_id: owner.id, searches: 1 }],
    ["bacii_video_lookups", { user_id: owner.id }],
    ["learning_events", { user_id: owner.id, event_type: "question_attempted", idempotency_key: "forged" }],
    ["mistakes", { user_id: owner.id, question_id: q1.id, source: "practice" }],
    ["chapter_progress", { user_id: owner.id, chapter_id: q1.chapterId, answered: 99, correct: 99 }],
  ];
  for (const [table, row] of attempts) if (!(await peer.client.from(table).insert(row)).error) forged.push(table);
  assert(!forged.length, `wrote as the owner into: ${forged.join(", ")}`);
});

await check("a request id the owner used cannot be replayed by someone else to read the owner's result", async () => {
  const request = randomUUID();
  await me.rpc("record_practice_answer", { question: q1.id, answer: "120", request });
  const replay = await peer.client.rpc("record_practice_answer", { question: q1.id, answer: "0", request });
  // The key is per student: the peer gets their own marking (wrong), not the owner's "right".
  assert(replay.data === false, `replay returned ${replay.data}`);
});

await people.cleanUp();
finish();
