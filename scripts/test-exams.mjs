#!/usr/bin/env node
/**
 * Checks for BacII mock exams (roadmap task 2.4), against a LOCAL Supabase
 * only, after supabase/schema.sql and both seeds. Starting, saving, marking
 * and timing are all decided by the database; this tries to get around them.
 *
 *   npm run test:exams
 */

import { readFileSync } from "node:fs";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("exam checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const paperB = demo.papers.find((paper) => paper.year === 2024);
const paperA = demo.papers.find((paper) => paper.year === 2023);
const [q1, q2, q3, q4] = paperB.questions.map((question) => question.id);
if (sql(`select count(*) from public.exam_papers where id = '${paperB.id}'`) !== "1") {
  skip("exam checks", "the demo papers are not loaded (run supabase/seed/demo-papers.sql)");
  finish();
}

const people = accounts(target, "exams");
const { anon, run } = people;
const student = await people.create("s");
const other = await people.create("o");
const admin = await people.create("a", { admin: true });
const me = student.client;
let attempt;

await check("a visitor cannot start an exam", async () => {
  const { error } = await anon.rpc("start_exam", { paper: paperB.id, practice_minutes: 60 });
  assert(error, "visitor started an exam");
});

await check("practice time must be 5–600 minutes", async () => {
  const { error } = await me.rpc("start_exam", { paper: paperB.id, practice_minutes: 3 });
  assert(error, "3 minutes accepted");
});

await check("start: a deadline from the server; starting again resumes the same attempt", async () => {
  const { data, error } = await me.rpc("start_exam", { paper: paperB.id, practice_minutes: 60 });
  if (error) throw new Error(error.message);
  attempt = data[0];
  const minutes = (Date.parse(attempt.deadline_at) - Date.parse(attempt.server_now)) / 60_000;
  assert(Math.abs(minutes - 60) < 0.1, `deadline ${minutes} minutes away`);
  const again = await me.rpc("start_exam", { paper: paperB.id, practice_minutes: 120 });
  assert(again.data[0].attempt_id === attempt.attempt_id, "a second attempt was started");
  const row = await me.from("exam_attempts").select("timing, duration_minutes, status").eq("id", attempt.attempt_id).single();
  assert(row.data.timing === "practice" && row.data.duration_minutes === 60 && row.data.status === "in-progress", JSON.stringify(row.data));
});

await check("during the attempt the paper's answers are hidden from this student only", async () => {
  const mine = await me.from("question_solutions").select("question_id").in("question_id", [q1, q2, q3, q4]);
  assert(mine.data.length === 0, `${mine.data.length} solutions visible during the exam`);
  const otherPaper = await me.from("question_solutions").select("question_id").eq("question_id", paperA.questions[0].id);
  assert(otherPaper.data.length === 1, "another paper's solution was hidden too");
  const someoneElse = await other.client.from("question_solutions").select("question_id").in("question_id", [q1, q2, q3, q4]);
  assert(someoneElse.data.length === 4, "hidden from another student too");
  const visitor = await anon.from("question_solutions").select("question_id").in("question_id", [q1, q2, q3, q4]);
  assert(visitor.data.length === 4, "hidden from visitors");
});

await check("answers save while the attempt runs", async () => {
  for (const [question, answer] of [
    [q1, "120"],
    [q2, "a"],
    [q3, "11"],
    [q4, "f(-1) = 2 and f(1) = -2"],
  ]) {
    const { error } = await me.rpc("save_exam_answer", { attempt: attempt.attempt_id, question, answer });
    if (error) throw new Error(`${question}: ${error.message}`);
  }
  const changed = await me.rpc("save_exam_answer", { attempt: attempt.attempt_id, question: q1, answer: "120" });
  assert(!changed.error, "saving twice failed");
});

await check("nobody can save to someone else's attempt, or a question from another paper", async () => {
  const foreign = await other.client.rpc("save_exam_answer", { attempt: attempt.attempt_id, question: q1, answer: "1" });
  assert(foreign.error, "another student saved into this attempt");
  const offPaper = await me.rpc("save_exam_answer", { attempt: attempt.attempt_id, question: paperA.questions[0].id, answer: "c" });
  assert(offPaper.error, "a question from another paper was accepted");
});

await check("scores and answers cannot be written directly", async () => {
  const score = await me.from("exam_attempts").update({ score: 999, status: "submitted" }).eq("id", attempt.attempt_id).select();
  assert(score.error || !score.data?.length, "score written directly");
  const answer = await me.from("exam_answers").insert({ attempt_id: attempt.attempt_id, question_id: q3, answer: "12", is_correct: true, points_awarded: 10 });
  assert(answer.error, "answer row written directly");
  const peek = await other.client.from("exam_attempts").select("id").eq("id", attempt.attempt_id);
  assert(!peek.data?.length, "another student can see this attempt");
});

await check("submitting marks it on the server: right, wrong, and a worked problem left for a person", async () => {
  const { error } = await me.rpc("submit_exam", { attempt: attempt.attempt_id });
  if (error) throw new Error(error.message);
  const row = await me.from("exam_attempts").select("status, score, max_score, unmarked").eq("id", attempt.attempt_id).single();
  const { status, score, max_score: max, unmarked } = row.data;
  assert(status === "submitted" && Number(score) === 20 && Number(max) === 30 && unmarked === 1, JSON.stringify(row.data));
  const answers = await me.from("exam_answers").select("question_id, is_correct, points_awarded").eq("attempt_id", attempt.attempt_id);
  const by = Object.fromEntries(answers.data.map((a) => [a.question_id, a]));
  assert(by[q1].is_correct === true && by[q2].is_correct === true && by[q3].is_correct === false && by[q4].is_correct === null, JSON.stringify(by));
  return `${score}/${max}, ${unmarked} for a person to mark`;
});

await check("after submitting: answers are visible again and the attempt is closed", async () => {
  const visible = await me.from("question_solutions").select("question_id").in("question_id", [q1, q2, q3, q4]);
  assert(visible.data.length === 4, "solutions still hidden");
  const late = await me.rpc("save_exam_answer", { attempt: attempt.attempt_id, question: q3, answer: "12" });
  assert(late.error, "changed an answer after submitting");
  const again = await me.rpc("submit_exam", { attempt: attempt.attempt_id });
  const row = await me.from("exam_attempts").select("score").eq("id", attempt.attempt_id).single();
  assert(!again.error && Number(row.data.score) === 20, "submitting twice changed the score");
});

await check("when time runs out, saving is refused and the attempt is marked as timed out", async () => {
  const { data } = await me.rpc("start_exam", { paper: paperA.id, practice_minutes: 5 });
  const id = data[0].attempt_id;
  await me.rpc("save_exam_answer", { attempt: id, question: paperA.questions[0].id, answer: "c" });
  sql(`update public.exam_attempts set deadline_at = now() - interval '1 second', started_at = now() - interval '6 minutes' where id = '${id}'`);
  const late = await me.rpc("save_exam_answer", { attempt: id, question: paperA.questions[1].id, answer: "0" });
  assert(late.data === "time-up", `late save: ${late.data ?? late.error?.message}`);
  const row = await me.from("exam_attempts").select("status, score, max_score").eq("id", id).single();
  assert(row.data.status === "timed-out", `status ${row.data.status}`);
  assert(Number(row.data.score) === 10 && Number(row.data.max_score) === 30, `scored ${row.data.score}/${row.data.max_score}`);
});

await check("two starts at once open only one attempt; an admin's own exam never hides answers from them", async () => {
  const [first, second] = await Promise.all([
    admin.client.rpc("start_exam", { paper: paperB.id, practice_minutes: 30 }),
    admin.client.rpc("start_exam", { paper: paperB.id, practice_minutes: 30 }),
  ]);
  const open = await admin.client.from("exam_attempts").select("id").eq("paper_id", paperB.id).eq("status", "in-progress");
  assert(open.data.length === 1, `${open.data.length} running attempts`);
  assert(!first.error || !second.error, "both starts failed");
  const key = await admin.client.from("question_solutions").select("question_id").in("question_id", [q1, q2, q3, q4]);
  assert(key.data.length === 4, `admin sees ${key.data.length} of 4 solutions`);
  await admin.client.rpc("submit_exam", { attempt: open.data[0].id });
});

await check("an official paper's sourced duration overrides the practice time", async () => {
  const q = await admin.client
    .from("questions")
    .insert({ chapter_id: "kh-grade12-science-mathematics-integrals", type: "open", content: `Official ${run}`, origin: "official-past-paper", year: 2023, source: "Test" })
    .select()
    .single();
  const p = await admin.client
    .from("exam_papers")
    .insert({ subject_id: "kh-grade12-science-mathematics", year: 2023, title_en: `Official ${run}`, title_km: "សាកល្បង", origin: "official", source: "Test", duration_minutes: 90, duration_source: "Test rule" })
    .select()
    .single();
  try {
    await admin.client.from("exam_paper_questions").insert({ paper_id: p.data.id, question_id: q.data.id, position: 1 });
    const { data, error } = await me.rpc("start_exam", { paper: p.data.id, practice_minutes: 10 });
    if (error) throw new Error(error.message);
    const row = await me.from("exam_attempts").select("timing, duration_minutes").eq("id", data[0].attempt_id).single();
    assert(row.data.timing === "official" && row.data.duration_minutes === 90, JSON.stringify(row.data));
  } finally {
    await admin.client.from("exam_papers").delete().eq("id", p.data.id);
    await admin.client.from("questions").delete().eq("id", q.data.id);
  }
});

await people.cleanUp();
finish();
