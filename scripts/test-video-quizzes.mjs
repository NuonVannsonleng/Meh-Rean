#!/usr/bin/env node
/**
 * Checks for video quizzes (roadmap task 4.6), against a LOCAL Supabase only,
 * after supabase/schema.sql.
 *
 *   npm run test:video-quizzes
 */

import { accounts, assert, localTarget, reporter } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("video quiz checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "quizzes");
const { anon } = people;
const student = await people.create("s");
const admin = await people.create("a", { admin: true });
const videoId = `qz${Math.random().toString(36).slice(2, 11).padEnd(9, "x")}`.slice(0, 11);
const question = { prompt: "What is $u$?", choices: ["$x$", "$e^x$", "$1$", "$0$"], answer: 0, explanation: "The video picks $u = x$." };
const quiz = { video_id: videoId, title: "Integration by parts", language: "km", questions: [question], source: "Shared by the channel owner, 2026-10-13", ai_generated: true, reviewed: true };

await check("only admins save quizzes", async () => {
  assert((await anon.from("video_quizzes").insert(quiz)).error, "a visitor saved a quiz");
  assert((await student.client.from("video_quizzes").insert(quiz)).error, "a student saved a quiz");
  const saved = await admin.client.from("video_quizzes").insert(quiz);
  assert(!saved.error, saved.error?.message);
});

await check("everyone can read quizzes; students cannot change or remove them", async () => {
  const { data } = await anon.from("video_quizzes").select("video_id, questions").eq("video_id", videoId);
  assert(data?.length === 1 && data[0].questions[0].answer === 0, "not readable");
  const change = await student.client.from("video_quizzes").update({ reviewed: false }).eq("video_id", videoId).select();
  assert(!change.data?.length, "a student changed a quiz");
  const remove = await student.client.from("video_quizzes").delete().eq("video_id", videoId).select();
  assert(!remove.data?.length, "a student removed a quiz");
});

await check("the database refuses malformed quizzes", async () => {
  const other = (n) => `zz${n}${"y".repeat(8)}`;
  const bad = [
    { ...quiz, video_id: "not a video" },
    { ...quiz, video_id: other(1), source: "x" },
    { ...quiz, video_id: other(2), questions: [] },
    { ...quiz, video_id: other(3), questions: [{ ...question, answer: 4 }] },
    { ...quiz, video_id: other(4), questions: [{ ...question, choices: ["only one"] }] },
    { ...quiz, video_id: other(5), questions: [{ ...question, prompt: " " }] },
    { ...quiz, video_id: other(6), questions: Array.from({ length: 11 }, () => question) },
    { ...quiz, video_id: other(7), questions: [{ ...question, choices: ["a", 5] }] },
  ];
  const accepted = [];
  for (const row of bad) if (!(await admin.client.from("video_quizzes").insert(row)).error) accepted.push(row.video_id);
  assert(!accepted.length, `accepted ${accepted.join(", ")}`);
});

await check("an admin removes a quiz", async () => {
  const { error } = await admin.client.from("video_quizzes").delete().eq("video_id", videoId);
  assert(!error, error?.message);
});

await people.cleanUp();
finish();
