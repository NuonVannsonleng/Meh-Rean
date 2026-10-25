#!/usr/bin/env node
/**
 * "Meh Rean" as a school is only for the team's own accounts: only an admin
 * (or the SQL editor) may give it, on a profile or a note. Local Supabase only.
 *
 * Usage: npm run test:reserved-school
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
if (!target) {
  skip("reserved school", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const MEH_REAN = { school: "Meh Rean", school_domain: "meh-rean.vercel.app" };
const people = accounts(target, "school");
const student = await people.create("s");
const admin = await people.create("a", { admin: true });
const schoolOf = (id) => sql(`select school || '|' || coalesce(school_domain, '') from public.profiles where id = '${id}'`);

await check("signing up with Meh Rean as the school does not keep it", async () => {
  const client = createClient(target.url, target.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = randomBytes(4).toString("hex");
  const { data, error } = await client.auth.signUp({
    email: `school-${run}-j@example.invalid`,
    password: `Pw-${run}-${randomBytes(6).toString("hex")}`,
    options: { data: { username: `school${run}j`, display_name: "Joiner", ...MEH_REAN } },
  });
  if (error) throw error;
  try {
    assert(schoolOf(data.user.id) === "|", `profile school is ${schoolOf(data.user.id)}`);
  } finally {
    await client.rpc("delete_own_account");
  }
});

await check("a student cannot set Meh Rean as their own school", async () => {
  const byName = await student.client.from("profiles").update({ school: "Meh Rean" }).eq("id", student.id);
  const byDomain = await student.client.from("profiles").update({ school: "My school", school_domain: "meh-rean.vercel.app" }).eq("id", student.id);
  const spaced = await student.client.from("profiles").update({ school: " meh-rean " }).eq("id", student.id);
  assert(byName.error && byDomain.error && spaced.error, "an update went through");
  assert(!schoolOf(student.id).toLowerCase().includes("meh"), `profile school is ${schoolOf(student.id)}`);
});

await check("a student cannot file a note under Meh Rean", async () => {
  const insert = await student.client.from("posts").insert({ author_id: student.id, title: "Mine", body: "x", subject: "other", level: "self-study", ...MEH_REAN });
  assert(insert.error, "the note was saved");
});

await check("a student can still choose any other school", async () => {
  const update = await student.client.from("profiles").update({ school: "Royal University of Phnom Penh", school_domain: "rupp.edu.kh" }).eq("id", student.id);
  assert(!update.error, update.error?.message);
});

await check("an admin can give Meh Rean to another account, and to their own notes", async () => {
  const update = await admin.client.from("profiles").update(MEH_REAN).eq("id", student.id);
  assert(!update.error, update.error?.message);
  assert(schoolOf(student.id) === "Meh Rean|meh-rean.vercel.app", `profile school is ${schoolOf(student.id)}`);
  const note = await admin.client.from("posts").insert({ author_id: admin.id, title: "Team note", body: "x", subject: "other", level: "self-study", ...MEH_REAN });
  assert(!note.error, note.error?.message);
});

await check("once given, the account can still edit the rest of its profile", async () => {
  const update = await student.client.from("profiles").update({ bio: "Run by the team" }).eq("id", student.id);
  assert(!update.error, update.error?.message);
  assert(schoolOf(student.id) === "Meh Rean|meh-rean.vercel.app", "the school changed");
});

await check("the SQL editor can set it", async () => {
  sql(`update public.profiles set school = 'Meh Rean', school_domain = 'meh-rean.vercel.app' where id = '${admin.id}'`);
  assert(schoolOf(admin.id) === "Meh Rean|meh-rean.vercel.app", "not set");
});

await people.cleanUp();
finish();
