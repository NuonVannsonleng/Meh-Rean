#!/usr/bin/env node
/**
 * Checks for learning events (Learning OS 1.3), against a LOCAL Supabase only,
 * after supabase/setup-all.sql. Events are written by the database from real
 * actions, once each; students read only their own and cannot write any.
 *
 *   npm run test:learning-events
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("learning event checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}
const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const paperB = demo.papers.find((paper) => paper.year === 2024);
const [q1, q2, q3] = paperB.questions;
if (sql(`select count(*) from public.questions where id = '${q1.id}'`) !== "1") {
  skip("learning event checks", "the demo papers are not loaded");
  finish();
}

const people = accounts(target, "events");
const { anon } = people;
const me = await people.create("s");
const other = await people.create("o");
const events = async () => (await me.client.from("learning_events").select("*").order("id")).data ?? [];
const answer = (question, text, request) => me.client.rpc("record_practice_answer", { question, answer: text, request });

await check("a practice answer is one event, with its topic and chapter; a retry is not counted again", async () => {
  const request = randomUUID();
  const first = await answer(q3.id, "11", request);
  assert(first.data === false, `marked ${first.data ?? first.error?.message}`);
  const retry = await answer(q3.id, "12", request);
  assert(retry.data === false, "a retry with the same request got a different result");
  const list = await events();
  assert(list.length === 1, `${list.length} events`);
  const [event] = list;
  assert(event.event_type === "question_attempted" && event.data.correct === false && event.data.source === "practice", JSON.stringify(event));
  assert(event.topic_id === q3.topicId && event.chapter_id === q3.chapterId, `topic ${event.topic_id}`);
  const mistake = await me.client.from("mistakes").select("times_wrong").eq("question_id", q3.id).single();
  assert(mistake.data.times_wrong === 1, `the retry counted a second mistake (${mistake.data.times_wrong})`);
});

await check("answering a question already in the notebook is a review", async () => {
  await answer(q3.id, "12", randomUUID());
  const last = (await events()).at(-1);
  assert(last.event_type === "mistake_reviewed" && last.data.correct === true, JSON.stringify(last));
});

await check("today's question is marked as such", async () => {
  const today = sql("select (now() at time zone 'Asia/Phnom_Penh')::date");
  sql(`insert into public.daily_questions (user_id, day, question_id, chapter_id) values ('${me.id}', '${today}', '${q1.id}', '${q1.chapterId}') on conflict do nothing`);
  await answer(q1.id, "120", randomUUID());
  const last = (await events()).at(-1);
  assert(last.data.source === "daily" && last.data.correct === true, JSON.stringify(last.data));
});

await check("handing in a mock exam: one event per marked answer and one for the exam; never twice", async () => {
  const before = (await events()).length;
  const { data } = await me.client.rpc("start_exam", { paper: paperB.id, practice_minutes: 30 });
  const attempt = data[0].attempt_id;
  await me.client.rpc("save_exam_answer", { attempt, question: q1.id, answer: "120" });
  await me.client.rpc("save_exam_answer", { attempt, question: q2.id, answer: "b" });
  await me.client.rpc("submit_exam", { attempt });
  await me.client.rpc("submit_exam", { attempt });
  const added = (await events()).slice(before);
  const exam = added.filter((event) => event.event_type === "mock_exam_completed");
  const answers = added.filter((event) => event.event_type === "question_attempted" && event.data.source === "exam");
  // Paper B: three markable questions (one is a worked problem, not marked).
  assert(exam.length === 1 && exam[0].resource_id === paperB.id && exam[0].data.max_score > 0, JSON.stringify(exam));
  assert(answers.length === 3, `${answers.length} exam answer events`);
});

await check("video marks and ticked plan items are recorded as self-reported", async () => {
  const video = { user_id: me.id, video_id: "abcdefghijk", title: "A lesson", status: "watched" };
  await me.client.from("video_progress").upsert(video);
  await me.client.from("video_progress").upsert({ ...video, status: "understood" });
  await me.client.from("video_progress").upsert({ ...video, status: "understood" });
  const marks = (await events()).filter((event) => event.resource_type === "video");
  assert(marks.map((event) => event.event_type).join() === "video_watched,video_marked_understood", marks.map((event) => event.event_type).join());
  assert(marks.every((event) => event.data.self_reported === true), "not marked self-reported");

  const exam_date = sql("select ((now() at time zone 'Asia/Phnom_Penh')::date + 60)::text");
  const plan = (done) => ({
    user_id: me.id, subject_id: "kh-grade12-science-mathematics", exam_date, hours_per_day: 2, days_per_week: 5, target_grade: "C", weak_chapter_ids: [],
    weeks: [{ start: "2026-10-12", studyDays: 5, items: [{ id: "p1", kind: "chapter", chapterId: q1.chapterId, hours: 2, done }] }],
  });
  await me.client.from("study_plans").upsert(plan(false));
  await me.client.from("study_plans").upsert(plan(true));
  await me.client.from("study_plans").upsert(plan(true));
  const ticks = (await events()).filter((event) => event.event_type === "study_task_completed");
  assert(ticks.length === 1 && ticks[0].data.self_reported === true, `${ticks.length} plan events`);
});

await check("events are private and only the database writes them", async () => {
  const peek = await other.client.from("learning_events").select("id").eq("user_id", me.id);
  assert(!peek.data?.length, "another student can read these events");
  assert(!(await anon.from("learning_events").select("id").limit(1)).data?.length, "a visitor can read events");
  const forged = await me.client.from("learning_events").insert({ user_id: me.id, event_type: "question_attempted", idempotency_key: "forged", data: { correct: true } });
  assert(forged.error, "a student wrote an event");
  const [first] = await events();
  const edited = await me.client.from("learning_events").update({ data: { correct: true } }).eq("id", first.id).select();
  assert(edited.error || !edited.data?.length, "a student edited an event");
  const removed = await me.client.from("learning_events").delete().eq("id", first.id).select();
  assert(removed.error || !removed.data?.length, "a student deleted an event");
  assert((await me.client.rpc("record_learning_event", { who: me.id, kind: "question_attempted", res_type: null, res_id: null, payload: {}, idem: "x" })).error, "the internal writer is callable");
});

await people.cleanUp();
finish();
