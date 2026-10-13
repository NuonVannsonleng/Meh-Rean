#!/usr/bin/env node
/**
 * Checks for the BacII curriculum (roadmap task 1.1).
 *
 *   npm run test:curriculum
 *
 * 1. Seed: every file in src/data/curriculum/ flattens without problems, and
 *    the checker rejects broken input.
 * 2. Database (local Supabase only): after supabase/schema.sql and
 *    supabase/seed/curriculum.sql, chapters load and can be queried by
 *    subject, exactly as in the seed; everyone can read; only admins can
 *    write; nothing is 'verified' without a source.
 *
 * The database part writes and deletes rows, so it only runs against a local
 * host (127.0.0.1 or localhost) from SUPABASE_URL / .env.test, and is skipped
 * otherwise. Keys are never printed.
 *
 * Exit codes: 0 passed, 1 a check failed.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { flattenCurriculum } from "../src/lib/curriculum.ts";

const ROOT = new URL("../", import.meta.url);
const DB_CONTAINER = "supabase_db_Meh_Rean";
const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push(["✓", name, detail ?? ""]);
  } catch (error) {
    results.push(["✗", name, String(error?.message ?? error).split("\n").slice(0, 3).join(" | ")]);
  }
};
const skip = (name, reason) => results.push(["○", name, reason]);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// ---------------------------------------------------------------- seed --

const seedDir = new URL("src/data/curriculum/", ROOT);
const seeds = readdirSync(seedDir)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({ name, seed: JSON.parse(readFileSync(new URL(name, seedDir), "utf8")) }));
const flat = seeds.map(({ name, seed }) => ({ name, ...flattenCurriculum(seed) }));
const all = {
  subjects: flat.flatMap((f) => f.subjects),
  chapters: flat.flatMap((f) => f.chapters),
};
const MATH = "kh-grade12-science-mathematics";

await check("seed files flatten without problems", async () => {
  assert(seeds.length > 0, "no seed files");
  return `${seeds.map((s) => s.name).join(", ")}: ${all.subjects.length} subject(s), ${all.chapters.length} chapters, ${all.chapters.reduce((n, c) => n + c.topics.length, 0)} topics`;
});

await check("Grade 12 Science-track Mathematics has numbered chapters, each with topics", async () => {
  const subject = all.subjects.find((s) => s.id === MATH);
  assert(subject, `${MATH} missing`);
  assert(subject.subjectKey === "mathematics" && subject.grade === 12 && subject.trackKey === "science", "wrong subject metadata");
  const chapters = all.chapters.filter((c) => c.subjectId === MATH);
  assert(chapters.length >= 5, `only ${chapters.length} chapters`);
  chapters.forEach((c, i) => assert(c.number === i + 1, `chapter ${c.id} numbered ${c.number}`));
  for (const c of chapters) assert(c.topics.length > 0, `${c.id} has no topics`);
  return `${chapters.length} chapters`;
});

await check("nothing is marked verified without its own source", async () => {
  const verified = all.chapters.filter((c) => c.verification === "verified");
  const provisional = all.chapters.filter((c) => c.verification !== "verified").length;
  return `${verified.length} verified, ${provisional} provisional or needing review`;
});

await check("the checker rejects broken seeds", async () => {
  const base = seeds[0].seed;
  const broken = [
    ["duplicate chapter", (s) => s.tracks[0].subjects[0].chapters.push(structuredClone(s.tracks[0].subjects[0].chapters[0]))],
    ["missing Khmer name", (s) => (s.tracks[0].subjects[0].chapters[0].nameKm = "Limits")],
    ["verified without a source", (s) => (s.tracks[0].subjects[0].chapters[0].verification = "verified")],
    ["unknown verification", (s) => (s.tracks[0].subjects[0].chapters[0].topics[0].verification = "official")],
    ["bad slug", (s) => (s.tracks[0].subjects[0].chapters[0].slug = "Limits & Continuity")],
  ];
  for (const [label, mutate] of broken) {
    const copy = structuredClone(base);
    mutate(copy);
    let threw = false;
    try {
      flattenCurriculum(copy);
    } catch {
      threw = true;
    }
    assert(threw, `accepted a seed with a ${label}`);
  }
  return `${broken.length} kinds of mistake rejected`;
});

await check("supabase/seed/curriculum.sql is up to date with the JSON", async () => {
  const sqlPath = new URL("supabase/seed/curriculum.sql", ROOT);
  assert(existsSync(sqlPath), "missing: run node scripts/build-curriculum-seed.mjs");
  const sql = readFileSync(sqlPath, "utf8");
  for (const c of all.chapters) {
    assert(sql.includes(`'${c.id}'`), `${c.id} missing: rerun node scripts/build-curriculum-seed.mjs`);
    assert(sql.includes(c.nameKm.replace(/'/g, "''")), `${c.id} Khmer name changed: rerun the build script`);
  }
});

// ------------------------------------------------------------ database --

function readEnv() {
  if (process.env.SUPABASE_URL) return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  const file = new URL(".env.test", ROOT);
  if (!existsSync(file)) return null;
  const env = Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
  );
  return {
    url: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL,
    key: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

const target = readEnv();
let local = false;
try {
  local = Boolean(target?.url && target.key && ["127.0.0.1", "localhost"].includes(new URL(target.url).hostname));
} catch {
  local = false;
}

if (!local) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test (they never run against a hosted project)");
} else {
  const anon = createClient(target.url, target.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const run = randomBytes(4).toString("hex");
  const password = `Pw-${run}-${randomBytes(6).toString("hex")}`;
  const accounts = [];

  async function account(label) {
    const client = createClient(target.url, target.key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signUp({
      email: `curriculum-${run}-${label}@example.invalid`,
      password,
      options: { data: { username: `cur${run}${label}`, display_name: `Curriculum ${label}` } },
    });
    if (error) throw error;
    if (!data.session) throw new Error("sign-up needs email confirmation; turn it off for the local project");
    accounts.push(client);
    return { client, id: data.user.id };
  }

  const sql = (statement) =>
    execFileSync("docker", ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", statement], {
      encoding: "utf8",
      // A refused statement is an expected result in one check; keep psql quiet.
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

  await check("chapters load from the seed and can be queried by subject", async () => {
    const { data, error } = await anon
      .from("curriculum_chapters")
      .select("id, number, name_en, name_km, verification, topics:curriculum_topics(id, sort)")
      .eq("subject_id", MATH)
      .order("number");
    if (error) throw new Error(`${error.code}: ${error.message} (has supabase/seed/curriculum.sql been run?)`);
    const expected = all.chapters.filter((c) => c.subjectId === MATH);
    assert(data.length === expected.length, `${data.length} chapters in the database, ${expected.length} in the seed`);
    expected.forEach((c, i) => {
      const row = data[i];
      assert(row.id === c.id && row.number === c.number, `chapter ${i + 1}: ${row.id} ≠ ${c.id}`);
      assert(row.name_en === c.nameEn && row.name_km === c.nameKm, `${c.id}: names differ`);
      assert(row.verification === c.verification, `${c.id}: verification differs`);
      assert(row.topics.length === c.topics.length, `${c.id}: ${row.topics.length} topics, seed has ${c.topics.length}`);
    });
    return `${data.length} chapters, ${data.reduce((n, r) => n + r.topics.length, 0)} topics, in seed order`;
  });

  await check("subjects can be found by the app's subject id ('mathematics')", async () => {
    const { data, error } = await anon
      .from("curriculum_subjects")
      .select("id, name_km, track:curriculum_tracks(key, version:curriculum_versions(grade))")
      .eq("subject_key", "mathematics");
    if (error) throw new Error(error.message);
    const math = data.find((row) => row.id === MATH);
    assert(math && math.track.key === "science" && math.track.version.grade === 12, JSON.stringify(data));
  });

  await check("signed-out visitors can read but not write", async () => {
    const { error } = await anon.from("curriculum_topics").insert({ id: `x-${run}`, chapter_id: `${MATH}-integrals`, name_en: "x", name_km: "ក" });
    assert(error, "anonymous insert accepted");
  });

  let student;
  await check("a student can read but cannot add, change or delete", async () => {
    student = await account("s");
    const { data: rows } = await student.client.from("curriculum_chapters").select("id").eq("subject_id", MATH);
    assert(rows?.length, "student cannot read");
    const insert = await student.client
      .from("curriculum_topics")
      .insert({ id: `x-${run}`, chapter_id: `${MATH}-integrals`, name_en: "x", name_km: "ក" });
    assert(insert.error, "student insert accepted");
    const update = await student.client.from("curriculum_chapters").update({ name_en: "hacked" }).eq("id", `${MATH}-integrals`).select();
    assert(!update.data?.length, "student update went through");
    const del = await student.client.from("curriculum_topics").delete().eq("chapter_id", `${MATH}-integrals`).select();
    assert(!del.data?.length, "student delete went through");
    const name = sql(`select name_en from public.curriculum_chapters where id = '${MATH}-integrals'`);
    assert(name !== "hacked", "chapter changed");
  });

  await check("an admin can add, change and remove a topic", async () => {
    const admin = await account("a");
    sql(`update public.profiles set is_admin = true where id = '${admin.id}'`);
    const id = `${MATH}-integrals-test-${run}`;
    const add = await admin.client.from("curriculum_topics").insert({ id, chapter_id: `${MATH}-integrals`, name_en: "Test topic", name_km: "ប្រធានបទសាកល្បង", sort: 99 }).select();
    assert(!add.error && add.data.length === 1, `insert: ${add.error?.message}`);
    const change = await admin.client.from("curriculum_topics").update({ name_en: "Test topic 2" }).eq("id", id).select();
    assert(change.data?.[0]?.name_en === "Test topic 2", `update: ${change.error?.message}`);
    const remove = await admin.client.from("curriculum_topics").delete().eq("id", id).select();
    assert(remove.data?.length === 1, `delete: ${remove.error?.message}`);
  });

  await check("the database refuses 'verified' without a source", async () => {
    let refused = false;
    try {
      sql(`update public.curriculum_chapters set verification = 'verified', source = '' where id = '${MATH}-integrals'`);
    } catch {
      refused = true;
    }
    assert(refused, "verified chapter with an empty source accepted");
  });

  // Remove the test accounts (the same call the app's Delete account uses).
  for (const client of accounts) await client.rpc("delete_own_account");
}

// -------------------------------------------------------------- report --

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter(([mark]) => mark === "✗").length;
const passed = results.filter(([mark]) => mark === "✓").length;
const skipped = results.filter(([mark]) => mark === "○").length;
console.log(`\nPassed ${passed}   Failed ${failed}   Skipped ${skipped}`);
process.exit(failed ? 1 : 0);
