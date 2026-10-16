#!/usr/bin/env node
/**
 * Checks for videos and notes linked to topics (Learning OS 1.2), against a
 * LOCAL Supabase only, after supabase/setup-all.sql.
 *
 *   npm run test:resource-topics
 */

import { randomUUID } from "node:crypto";
import { accounts, assert, localTarget, reporter } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("resource link checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "reslink");
const { anon } = people;
const author = await people.create("w");
const other = await people.create("o");
const admin = await people.create("a", { admin: true });
const topic = "kh-grade12-science-mathematics-integrals-by-parts";
const noteId = randomUUID();

const made = await author.client.from("posts").insert({ id: noteId, author_id: author.id, title: "Integration by parts notes", body: "test", subject: "mathematics", level: "high-school", tags: [] });
if (made.error) throw new Error(`could not create a note: ${made.error.message}`);
const note = { resource_type: "note", resource_id: noteId, topic_id: topic };
let noteLink;

await check("a note's author links it to a topic; nobody else can", async () => {
  assert((await other.client.from("resource_topics").insert(note)).error, "another student linked someone's note");
  assert((await anon.from("resource_topics").insert(note)).error, "a visitor linked a note");
  const saved = await author.client.from("resource_topics").insert(note).select("id, added_by").single();
  if (saved.error) throw new Error(saved.error.message);
  noteLink = saved.data.id;
  assert(saved.data.added_by === author.id, "added_by not set by the server");
  assert((await author.client.from("resource_topics").insert(note)).error, "the same link was added twice");
});

await check("everyone reads links; only the author or an admin removes them", async () => {
  const { data } = await anon.from("resource_topics").select("id").eq("resource_id", noteId);
  assert(data?.length === 1, "visitors cannot read the link");
  const removed = await other.client.from("resource_topics").delete().eq("id", noteLink).select();
  assert(!removed.data?.length, "another student removed the link");
  assert(!(await author.client.from("resource_topics").delete().eq("id", noteLink)).error, "the author could not remove it");
});

await check("videos: admins only, with a real-looking id and a title", async () => {
  const video = { resource_type: "video", resource_id: "abcdefghijk", topic_id: topic, title: "Integration by parts, step by step" };
  assert((await author.client.from("resource_topics").insert(video)).error, "a student linked a video");
  const saved = await admin.client.from("resource_topics").insert(video).select("id").single();
  if (saved.error) throw new Error(saved.error.message);
  assert((await admin.client.from("resource_topics").insert({ ...video, resource_id: "bad id" })).error, "a bad video id was accepted");
  assert((await admin.client.from("resource_topics").insert({ ...video, resource_id: "abcdefghijl", title: " " })).error, "a video without a title was accepted");
  assert((await admin.client.from("resource_topics").insert({ ...note, resource_id: randomUUID() })).error, "a link to a missing note was accepted");
  assert((await admin.client.from("resource_topics").update({ topic_id: "kh-grade12-science-mathematics-conics-parabola" }).eq("id", saved.data.id).select()).data?.length !== 1, "a link was changed in place");
  await admin.client.from("resource_topics").delete().eq("id", saved.data.id);
});

await author.client.from("posts").delete().eq("id", noteId);
await people.cleanUp();
finish();
