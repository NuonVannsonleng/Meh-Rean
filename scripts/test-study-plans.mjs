#!/usr/bin/env node
/**
 * Checks for saved study plans (roadmap task 3.4), against a LOCAL Supabase
 * only, after supabase/schema.sql and the curriculum seed.
 *
 *   npm run test:study-plans
 */

import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("study plan checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}
const subject = "kh-grade12-science-mathematics";
if (sql(`select count(*) from public.curriculum_subjects where id = '${subject}'`) !== "1") {
  skip("study plan checks", "the curriculum is not loaded (run supabase/seed/curriculum.sql)");
  finish();
}

const people = accounts(target, "plans");
const { anon } = people;
const student = await people.create("s");
const other = await people.create("o");
const me = student.client;
const inDays = (days) => sql(`select ((now() at time zone 'Asia/Phnom_Penh')::date + ${days})::text`);
const weeks = [{ start: "2026-10-12", studyDays: 5, items: [{ id: "p1", kind: "chapter", chapterId: `${subject}-limits`, hours: 2, done: false }] }];
const plan = (changes = {}) => ({
  user_id: student.id,
  subject_id: subject,
  exam_date: inDays(60),
  hours_per_day: 2,
  days_per_week: 6,
  target_grade: "B",
  weak_chapter_ids: [`${subject}-limits`],
  weeks,
  ...changes,
});
const mine = async () => (await me.from("study_plans").select("*").eq("user_id", student.id).maybeSingle()).data;

await check("a visitor cannot read or write plans", async () => {
  const write = await anon.from("study_plans").insert(plan());
  assert(write.error, "visitor saved a plan");
});

await check("a student saves, reads and replaces their own plan", async () => {
  const saved = await me.from("study_plans").upsert(plan()).select().single();
  if (saved.error) throw new Error(saved.error.message);
  const first = await mine();
  assert(first.weeks[0].items[0].hours === 2 && Number(first.hours_per_day) === 2, JSON.stringify(first));
  const ticked = structuredClone(weeks);
  ticked[0].items[0].done = true;
  const again = await me.from("study_plans").upsert(plan({ weeks: ticked, created_at: "2000-01-01T00:00:00Z" })).select().single();
  if (again.error) throw new Error(again.error.message);
  const second = await mine();
  assert(second.weeks[0].items[0].done === true, "done mark not saved");
  assert(second.created_at === first.created_at && second.updated_at >= first.updated_at, "dates not set by the server");
});

await check("plans are private", async () => {
  const peek = await other.client.from("study_plans").select("user_id").eq("user_id", student.id);
  assert(!peek.data?.length, "another student can read this plan");
  const change = await other.client.from("study_plans").update({ target_grade: "F" }).eq("user_id", student.id).select();
  assert(!change.data?.length && (await mine()).target_grade === "B", "another student changed this plan");
  const remove = await other.client.from("study_plans").delete().eq("user_id", student.id).select();
  assert(!remove.data?.length && (await mine()), "another student deleted this plan");
  const forged = await other.client.from("study_plans").insert(plan({ user_id: student.id }));
  assert(forged.error, "wrote a plan for someone else");
});

await check("settings are checked: exam date ahead (within 400 days), hours, days, grade, size", async () => {
  const bad = [
    { exam_date: inDays(0) },
    { exam_date: inDays(401) },
    { hours_per_day: 20 },
    { days_per_week: 8 },
    { target_grade: "Z" },
    { weeks: { not: "a list" } },
    { weeks: [{ start: "2026-10-12", items: [], filler: "x".repeat(210_000) }] },
  ];
  const accepted = [];
  for (const change of bad) {
    const { error } = await other.client.from("study_plans").upsert(plan({ user_id: other.id, ...change }));
    if (!error) accepted.push(Object.keys(change)[0]);
  }
  assert(!accepted.length, `accepted: ${accepted.join(", ")}`);
});

await check("once the exam date has passed, the plan can still be ticked off", async () => {
  // Test setup only: skip the trigger to put the exam date in the past.
  sql(`set session_replication_role = replica; update public.study_plans set exam_date = (now() at time zone 'Asia/Phnom_Penh')::date - 3 where user_id = '${student.id}'`);
  const current = await mine();
  const { error } = await me.from("study_plans").update({ weeks }).eq("user_id", student.id);
  assert(!error, error?.message);
  const moved = await me.from("study_plans").update({ exam_date: inDays(-1) }).eq("user_id", student.id);
  assert(moved.error && (await mine()).exam_date === current.exam_date, "moved the exam date into the past");
});

await check("a student can delete their plan", async () => {
  const { error } = await me.from("study_plans").delete().eq("user_id", student.id);
  assert(!error && !(await mine()), "not deleted");
});

await people.cleanUp();
finish();
