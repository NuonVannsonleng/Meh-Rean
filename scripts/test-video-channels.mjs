#!/usr/bin/env node
/**
 * Checks for trusted video channels (roadmap task 4.3), against a LOCAL
 * Supabase only, after supabase/schema.sql.
 *
 *   npm run test:video-channels
 */

import { accounts, assert, localTarget, reporter } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("video channel checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "channels");
const { anon } = people;
const student = await people.create("s");
const admin = await people.create("a", { admin: true });
const id = `UCtest${Math.random().toString(36).slice(2, 10).padEnd(8, "x")}${"0".repeat(10)}`;
const channel = { channel_id: id, name: "Test Channel", language: "km", subject_keys: ["mathematics"] };

await check("only admins add channels", async () => {
  const visitor = await anon.from("video_channels").insert(channel);
  assert(visitor.error, "a visitor added a channel");
  const byStudent = await student.client.from("video_channels").insert(channel);
  assert(byStudent.error, "a student added a channel");
  const byAdmin = await admin.client.from("video_channels").insert(channel);
  assert(!byAdmin.error, byAdmin.error?.message);
});

await check("everyone can read the list (the video function reads it without a session)", async () => {
  const { data } = await anon.from("video_channels").select("channel_id").eq("channel_id", id);
  assert(data?.length === 1, "not readable by visitors");
});

await check("students cannot change or remove channels", async () => {
  const change = await student.client.from("video_channels").update({ name: "Hijacked" }).eq("channel_id", id).select();
  assert(!change.data?.length, "a student renamed a channel");
  const remove = await student.client.from("video_channels").delete().eq("channel_id", id).select();
  assert(!remove.data?.length, "a student removed a channel");
});

await check("channel ids, languages and sizes are checked", async () => {
  const bad = [
    { ...channel, channel_id: "not-a-channel" },
    { ...channel, channel_id: `UC${"x".repeat(21)}` },
    { ...channel, channel_id: `UC${"y".repeat(22)}`, language: "fr" },
    { ...channel, channel_id: `UC${"z".repeat(22)}`, name: " " },
  ];
  for (const row of bad) {
    const { error } = await admin.client.from("video_channels").insert(row);
    assert(error, `accepted ${JSON.stringify(row)}`);
  }
});

await check("an admin removes a channel", async () => {
  const { error } = await admin.client.from("video_channels").delete().eq("channel_id", id);
  assert(!error, error?.message);
  const { data } = await anon.from("video_channels").select("channel_id").eq("channel_id", id);
  assert(!data?.length, "still listed");
});

await people.cleanUp();
finish();
