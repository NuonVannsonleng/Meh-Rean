#!/usr/bin/env node
/**
 * Checks for the BacII daily question and streak (roadmap task 3.3), against
 * a LOCAL Supabase only, after supabase/schema.sql and both seeds.
 *
 *   npm run test:daily
 */

import { readFileSync } from "node:fs";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("daily question checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const paperB = demo.papers.find((paper) => paper.year === 2024);
const [q1, , q3] = paperB.questions.map((question) => question.id);
if (sql(`select count(*) from public.exam_papers where id = '${paperB.id}'`) !== "1") {
  skip("daily question checks", "the demo papers are not loaded (run supabase/seed/demo-papers.sql)");
  finish();
}
const chapterOf = (id) => sql(`select chapter_id from public.questions where id = '${id}'`);
const today = sql(`select (now() at time zone 'Asia/Phnom_Penh')::date`);

const people = accounts(target, "daily");
const { anon } = people;
const first = await people.create("a");
const weak = await people.create("w");
const examining = await people.create("e");
const daily = async (client) => {
  const { data, error } = await client.rpc("daily_question");
  if (error) throw new Error(error.message);
  return data[0];
};
const streak = async (client) => (await client.rpc("daily_streak")).data[0];
const answerFor = (id) => sql(`select coalesce(s.correct_choice, s.numeric_answer::text) from public.question_solutions s where s.question_id = '${id}'`);

await check("a visitor gets no daily question", async () => {
  const { error } = await anon.rpc("daily_question");
  assert(error, "visitor got a daily question");
});

let todays;
await check("one question a day: the same one all day, markable, nothing yet to go on", async () => {
  todays = await daily(first.client);
  assert(todays?.question_id && todays.day === today && todays.from_results === false && !todays.answered_at, JSON.stringify(todays));
  const again = await daily(first.client);
  assert(again.question_id === todays.question_id, "a second call picked another question");
  const type = sql(`select type from public.questions where id = '${todays.question_id}'`);
  assert(type === "multiple-choice" || type === "numeric", `picked a ${type} question`);
  const none = await streak(first.client);
  assert(none.current_streak === 0 && none.best_streak === 0 && none.answered_today === false, JSON.stringify(none));
});

await check("answering it (right or wrong) counts for today; only the first answer is kept", async () => {
  const { data } = await first.client.rpc("record_practice_answer", { question: todays.question_id, answer: "999999" });
  assert(data === false, "expected a wrong answer");
  await first.client.rpc("record_practice_answer", { question: todays.question_id, answer: answerFor(todays.question_id) });
  const after = await daily(first.client);
  assert(after.answered_at && after.correct === false, JSON.stringify(after));
  const now = await streak(first.client);
  assert(now.current_streak === 1 && now.best_streak === 1 && now.answered_today === true, JSON.stringify(now));
});

await check("streaks: days in a row back from today; the best run is kept", async () => {
  const add = (daysAgo, answered = true) =>
    sql(
      `insert into public.daily_questions (user_id, day, question_id, chapter_id, answered_at) values ('${first.id}', '${today}'::date - ${daysAgo}, '${q1}', '${chapterOf(q1)}', ${answered ? "now()" : "null"})`,
    );
  add(1);
  add(2);
  for (const daysAgo of [5, 6, 7, 8]) add(daysAgo);
  add(9, false);
  const now = await streak(first.client);
  assert(now.current_streak === 3 && now.best_streak === 4, JSON.stringify(now));
});

await check("before today's is answered, yesterday's run still counts; a missed day starts again", async () => {
  sql(`insert into public.daily_questions (user_id, day, question_id, chapter_id, answered_at) values ('${weak.id}', '${today}'::date - 1, '${q1}', '${chapterOf(q1)}', now())`);
  const open = await streak(weak.client);
  assert(open.current_streak === 1 && open.answered_today === false, JSON.stringify(open));
  sql(`update public.daily_questions set day = day - 1 where user_id = '${weak.id}'`);
  const broken = await streak(weak.client);
  assert(broken.current_streak === 0 && broken.best_streak === 1, JSON.stringify(broken));
});

await check("results pick the weakest chapter, recorded per chapter on the server", async () => {
  // Wrong twice in q3's chapter, right in q1's.
  await weak.client.rpc("record_practice_answer", { question: q3, answer: "1" });
  await weak.client.rpc("record_practice_answer", { question: q3, answer: "2" });
  await weak.client.rpc("record_practice_answer", { question: q1, answer: "120" });
  const progress = await weak.client.from("chapter_progress").select("chapter_id, answered, correct");
  const by = Object.fromEntries(progress.data.map((row) => [row.chapter_id, row]));
  assert(by[chapterOf(q3)]?.answered === 2 && by[chapterOf(q3)].correct === 0, JSON.stringify(progress.data));
  assert(by[chapterOf(q1)]?.answered === 1 && by[chapterOf(q1)].correct === 1, JSON.stringify(progress.data));
  const pick = await daily(weak.client);
  assert(pick.chapter_id === chapterOf(q3) && pick.from_results === true, JSON.stringify(pick));
});

await check("progress and daily questions are private and written only by the server", async () => {
  const peek = await first.client.from("chapter_progress").select("chapter_id").eq("user_id", weak.id);
  assert(!peek.data?.length, "another student can see progress");
  const forge = await weak.client.from("chapter_progress").update({ correct: 99, answered: 99 }).eq("user_id", weak.id).select();
  assert(forge.error || !forge.data?.length, "progress written directly");
  const fake = await weak.client
    .from("daily_questions")
    .insert({ user_id: weak.id, day: "2020-01-01", question_id: q1, chapter_id: chapterOf(q1), answered_at: new Date().toISOString() });
  assert(fake.error, "a streak day was written directly");
});

await check("never a question from the student's running mock exam", async () => {
  const { error } = await examining.client.rpc("start_exam", { paper: paperB.id, practice_minutes: 30 });
  if (error) throw new Error(error.message);
  const pick = await daily(examining.client);
  assert(pick && !paperB.questions.some((question) => question.id === pick.question_id), `picked ${pick?.question_id} from the running exam`);
});

await people.cleanUp();
finish();
