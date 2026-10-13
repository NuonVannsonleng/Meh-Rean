#!/usr/bin/env node
/**
 * Checks for watched videos (roadmap task 4.7), against a LOCAL Supabase
 * only, after supabase/schema.sql and the curriculum seed.
 *
 *   npm run test:video-progress
 */

import { accounts, assert, localTarget, reporter } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("video progress checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "watched");
const { anon } = people;
const student = await people.create("s");
const other = await people.create("o");
const me = student.client;
const row = { video_id: "abcdefghijk", title: "Integration by parts", channel: "Teacher", status: "needs-revision", chapter_id: "kh-grade12-science-mathematics-integrals" };
const mine = async () => (await me.from("video_progress").select("*").eq("video_id", row.video_id).maybeSingle()).data;

await check("a visitor cannot keep video marks", async () => {
  assert((await anon.from("video_progress").insert(row)).error, "a visitor saved a mark");
});

await check("a student marks a video and changes the mark", async () => {
  const saved = await me.from("video_progress").upsert({ ...row, user_id: student.id });
  assert(!saved.error, saved.error?.message);
  const changed = await me.from("video_progress").upsert({ ...row, user_id: student.id, status: "understood" });
  assert(!changed.error && (await mine()).status === "understood", "mark not changed");
});

await check("marks are private and only the owner's", async () => {
  const peek = await other.client.from("video_progress").select("video_id").eq("user_id", student.id);
  assert(!peek.data?.length, "another student can see the marks");
  const forged = await other.client.from("video_progress").insert({ ...row, user_id: student.id });
  assert(forged.error, "saved a mark for someone else");
  const change = await other.client.from("video_progress").update({ status: "watched" }).eq("user_id", student.id).select();
  assert(!change.data?.length && (await mine()).status === "understood", "another student changed a mark");
});

await check("video ids, statuses and chapters are checked", async () => {
  const bad = [
    { ...row, user_id: student.id, video_id: "short" },
    { ...row, user_id: student.id, video_id: "zyxwvutsrqp", status: "loved" },
    { ...row, user_id: student.id, video_id: "zyxwvutsrqo", chapter_id: "no-such-chapter" },
    { ...row, user_id: student.id, video_id: "zyxwvutsrqn", title: "" },
  ];
  for (const item of bad) assert((await me.from("video_progress").insert(item)).error, `accepted ${JSON.stringify(item)}`);
});

await check("a student removes a mark", async () => {
  const { error } = await me.from("video_progress").delete().eq("video_id", row.video_id);
  assert(!error && !(await mine()), "not removed");
});

await people.cleanUp();
finish();
