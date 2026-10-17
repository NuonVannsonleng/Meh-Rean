#!/usr/bin/env node
/**
 * Checks for learning history deletion (Learning OS 7.3), against a LOCAL
 * Supabase only: a student deletes their own events, some or all, estimates
 * follow, and nobody else's data is touched.
 *
 *   npm run test:learning-history
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("learning history checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}
const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const byEnd = (end) => demo.papers.flatMap((p) => p.questions).find((q) => q.id.endsWith(end));
const counting = byEnd("2401"); // numeric, 120
const equation = byEnd("2403"); // numeric, 12
if (sql(`select count(*) from public.questions where id = '${counting.id}'`) !== "1" || sql("select count(*) from pg_proc where proname = 'delete_my_learning_events'") !== "1") {
  skip("learning history checks", "run supabase/setup-all.sql first");
  finish();
}

const people = accounts(target, "history");
const me = await people.create("s");
const other = await people.create("o");
const answer = (who, question, text) => who.client.rpc("record_practice_answer", { question: question.id, answer: text, request: randomUUID() });
const count = (who, table) => sql(`select count(*) from public.${table} where user_id = '${who.id}'`);

await answer(me, counting, "120");
await answer(me, equation, "1");
await answer(other, counting, "120");

await check("students cannot delete events directly", async () => {
  const { data } = await me.client.from("learning_events").delete().eq("user_id", me.id).select();
  assert(!data?.length && count(me, "learning_events") === "2", "deleted through the table");
});

await check("deleting one entry removes only it, and its topic's estimate follows", async () => {
  const id = sql(`select id from public.learning_events where user_id = '${me.id}' and resource_id = '${equation.id}'`);
  assert(count(me, "topic_mastery") === "2", "estimates before");
  const { data, error } = await me.client.rpc("delete_my_learning_events", { ids: [id] });
  assert(!error && data === 1, error?.message ?? `removed ${data}`);
  assert(count(me, "learning_events") === "1" && count(me, "topic_mastery") === "1", `${count(me, "learning_events")} events, ${count(me, "topic_mastery")} estimates`);
  assert(sql(`select count(*) from public.topic_mastery where user_id = '${me.id}' and topic_id = '${equation.topicId}'`) === "0", "the estimate stayed");
});

await check("another student's ids delete nothing; a visitor cannot call it; too many ids are refused", async () => {
  const theirs = sql(`select id from public.learning_events where user_id = '${other.id}' limit 1`);
  const { data } = await me.client.rpc("delete_my_learning_events", { ids: [theirs] });
  assert(data === 0 && count(other, "learning_events") === "1", "deleted another student's event");
  assert((await people.anon.rpc("delete_my_learning_events", {})).error, "a visitor deleted");
  assert((await me.client.rpc("delete_my_learning_events", { ids: Array.from({ length: 1001 }, (_, i) => String(i)) })).error, "1001 ids accepted");
});

await check("deleting everything leaves no events and no estimates, and nobody else's are touched", async () => {
  await answer(me, equation, "12");
  const { data, error } = await me.client.rpc("delete_my_learning_events", {});
  assert(!error && data === 2, error?.message ?? `removed ${data}`);
  assert(count(me, "learning_events") === "0" && count(me, "topic_mastery") === "0", "something left");
  assert(count(other, "learning_events") === "1" && count(other, "topic_mastery") === "1", "another student's data changed");
  // The notebook is not part of the learning history.
  assert(count(me, "mistakes") === "1", "the notebook was emptied");
});

await people.cleanUp();
finish();
