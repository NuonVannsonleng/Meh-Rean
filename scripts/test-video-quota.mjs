#!/usr/bin/env node
/**
 * Checks for the YouTube quota count (roadmap task 4.1), against a LOCAL
 * Supabase only, after supabase/schema.sql.
 *
 *   npm run test:video-quota
 */

import { accounts, assert, localTarget, reporter } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("video quota checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "quota");
const { anon } = people;
const student = await people.create("s");
const other = await people.create("o");
const units = async (client) => (await client.rpc("youtube_units_today")).data;

await check("visitors can neither log searches nor read the quota", async () => {
  const log = await anon.from("youtube_search_log").insert({ searches: 1 });
  assert(log.error, "visitor logged a search");
  const read = await anon.rpc("youtube_units_today");
  assert(read.error, "visitor read the quota");
});

await check("a student logs 1–2 searches per lookup, as themselves, now", async () => {
  const before = await units(student.client);
  const ok = await student.client.from("youtube_search_log").insert({ searches: 2 });
  assert(!ok.error, ok.error?.message);
  assert((await units(student.client)) === before + 200, "quota did not grow by 200 units");
  const many = await student.client.from("youtube_search_log").insert({ searches: 50 });
  assert(many.error, "50 searches accepted in one row");
  const forged = await student.client.from("youtube_search_log").insert({ searches: 1, user_id: other.id });
  assert(forged.error, "logged a search as someone else");
  const backdated = await student.client.from("youtube_search_log").insert({ searches: 1, created_at: "2020-01-01T00:00:00Z" });
  assert(backdated.error, "backdated a search");
});

await check("the total is shared; the rows are private and cannot be removed", async () => {
  assert((await units(other.client)) === (await units(student.client)), "students see different totals");
  const peek = await other.client.from("youtube_search_log").select("id").eq("user_id", student.id);
  assert(!peek.data?.length, "another student can see these rows");
  const remove = await student.client.from("youtube_search_log").delete().eq("user_id", student.id).select();
  assert(remove.error || !remove.data?.length, "deleted a search to lower the count");
});

await people.cleanUp();
finish();
