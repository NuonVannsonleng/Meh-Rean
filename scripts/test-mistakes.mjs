#!/usr/bin/env node
/**
 * Checks for the BacII mistake notebook (roadmap task 3.1), against a LOCAL
 * Supabase only, after supabase/schema.sql and both seeds. Practice answers
 * and mock exams are marked on the server, which alone writes the notebook.
 *
 *   npm run test:mistakes
 */

import { readFileSync } from "node:fs";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("mistake checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const paperB = demo.papers.find((paper) => paper.year === 2024);
const [q1, q2, q3, q4] = paperB.questions.map((question) => question.id);
if (sql(`select count(*) from public.exam_papers where id = '${paperB.id}'`) !== "1") {
  skip("mistake checks", "the demo papers are not loaded (run supabase/seed/demo-papers.sql)");
  finish();
}

const people = accounts(target, "mistakes");
const { anon } = people;
const student = await people.create("s");
const other = await people.create("o");
const me = student.client;
const record = (question, answer, client = me) => client.rpc("record_practice_answer", { question, answer });
const entry = async (question) => (await me.from("mistakes").select("*").eq("question_id", question).maybeSingle()).data;

await check("a visitor cannot record answers", async () => {
  const { error } = await record(q1, "1", anon);
  assert(error, "visitor recorded an answer");
});

await check("a wrong practice answer goes into the notebook; again counts twice", async () => {
  const first = await record(q3, "11");
  assert(first.data === false, `marked ${first.data ?? first.error?.message}`);
  const row = await entry(q3);
  assert(row && row.source === "practice" && row.times_wrong === 1 && row.last_answer === "11" && !row.fixed_at, JSON.stringify(row));
  await record(q3, "10,5");
  const again = await entry(q3);
  assert(again.times_wrong === 2 && again.last_answer === "10,5", JSON.stringify(again));
});

await check("the right answer marks it fixed; wrong again reopens it", async () => {
  const right = await record(q3, " 12 ");
  assert(right.data === true, `marked ${right.data}`);
  assert((await entry(q3)).fixed_at, "not marked fixed");
  await record(q3, "13");
  const reopened = await entry(q3);
  assert(!reopened.fixed_at && reopened.times_wrong === 3, JSON.stringify(reopened));
});

await check("a right first answer adds nothing; worked problems are not marked", async () => {
  const right = await record(q2, "a");
  assert(right.data === true && !(await entry(q2)), "a right answer was recorded as a mistake");
  const open = await record(q4, "f has a maximum at -1");
  assert(open.data === null && !(await entry(q4)), `worked problem marked ${open.data}`);
  const blank = await record(q1, "   ");
  assert(blank.error, "a blank practice answer was accepted");
});

await check("the notebook is private and written only by the server", async () => {
  const peek = await other.client.from("mistakes").select("question_id").eq("user_id", student.id);
  assert(!peek.data?.length, "another student can see this notebook");
  const insert = await me.from("mistakes").insert({ user_id: student.id, question_id: q1, source: "practice" });
  assert(insert.error, "inserted directly");
  const update = await me.from("mistakes").update({ fixed_at: new Date().toISOString() }).eq("question_id", q3).select();
  assert(update.error || !update.data?.length, "updated directly");
  const theirs = await other.client.from("mistakes").delete().eq("user_id", student.id).select();
  assert(!theirs.data?.length && (await entry(q3)), "another student removed this entry");
});

await check("during a mock exam its questions cannot be checked in practice", async () => {
  const { data, error } = await me.rpc("start_exam", { paper: paperB.id, practice_minutes: 30 });
  if (error) throw new Error(error.message);
  globalThis.attemptId = data[0].attempt_id;
  const probe = await record(q1, "120");
  assert(probe.error, "answer checked mid-exam");
});

await check("handing in: wrong and blank answers go in, right ones fix earlier mistakes", async () => {
  const id = globalThis.attemptId;
  await me.rpc("save_exam_answer", { attempt: id, question: q1, answer: "100" });
  await me.rpc("save_exam_answer", { attempt: id, question: q3, answer: "12" });
  await me.rpc("save_exam_answer", { attempt: id, question: q4, answer: "working" });
  const { error } = await me.rpc("submit_exam", { attempt: id });
  if (error) throw new Error(error.message);
  const wrong = await entry(q1);
  assert(wrong && wrong.source === "exam" && wrong.attempt_id === id && wrong.last_answer === "100", JSON.stringify(wrong));
  const blank = await entry(q2);
  assert(blank && blank.last_answer === "" && blank.source === "exam", JSON.stringify(blank));
  assert((await entry(q3)).fixed_at, "a right exam answer did not fix the earlier mistake");
  assert(!(await entry(q4)), "a worked problem went into the notebook");
  // Handing in again changes nothing.
  await me.rpc("submit_exam", { attempt: id });
  assert((await entry(q1)).times_wrong === 1, "counted twice");
});

await check("a student can remove their own entry", async () => {
  const { error } = await me.from("mistakes").delete().eq("question_id", q2);
  assert(!error && !(await entry(q2)), "not removed");
});

await people.cleanUp();
finish();
