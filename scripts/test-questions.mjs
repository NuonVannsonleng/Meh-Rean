#!/usr/bin/env node
/**
 * Checks for the BacII question schema (roadmap task 1.2).
 *
 *   npm run test:questions
 *
 * Against a LOCAL Supabase only (SUPABASE_URL or .env.test), after
 * supabase/schema.sql and supabase/seed/curriculum.sql. It writes questions
 * as a throwaway admin and removes everything it made.
 */

import { isCorrect, QUESTION_SELECT, toQuestion } from "../src/lib/questions.ts";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const target = localTarget();
const MATH = "kh-grade12-science-mathematics";
const INTEGRALS = `${MATH}-integrals`;
const BY_PARTS = `${INTEGRALS}-by-parts`;
const LIMITS_TOPIC = `${MATH}-limits-continuity-limits`;

if (!target) {
  skip("question checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "questions");
const { anon, run } = people;
const admin = await people.create("a", { admin: true });
const student = await people.create("s");
const made = [];
const db = admin.client;

/** Expects an insert or update to be refused; returns the error code. */
async function refused(promise, label) {
  const { error, data } = await promise;
  assert(error, `${label}: accepted (${JSON.stringify(data)})`);
  return error.code;
}

const mcq = (extra = {}) => ({
  chapter_id: INTEGRALS,
  topic_id: BY_PARTS,
  type: "multiple-choice",
  content: "គណនា $I = \\int_0^1 x e^x \\, dx$",
  choices: [
    { id: "a", content: "$0$" },
    { id: "b", content: "$1$" },
    { id: "c", content: "$e$" },
    { id: "d", content: "$e - 1$" },
  ],
  difficulty: 2,
  language: "km",
  origin: "demo",
  source: "",
  ...extra,
});

async function insertQuestion(row) {
  const { data, error } = await db.from("questions").insert(row).select().single();
  if (error) throw new Error(`${error.code}: ${error.message}`);
  made.push(data.id);
  return data;
}

// The curriculum seed must be loaded for the chapters these use.
const seeded = sql(`select count(*) from public.curriculum_chapters where id = '${INTEGRALS}'`);
if (seeded !== "1") {
  skip("question checks", "the curriculum seed is not loaded (run supabase/seed/curriculum.sql)");
  await people.cleanUp();
  finish();
}

let question;
await check("an admin files a multiple-choice question with a solution", async () => {
  question = await insertQuestion(mcq());
  const { error } = await db.from("question_solutions").insert({
    question_id: question.id,
    answer: "$1$",
    correct_choice: "b",
    steps: [
      { content: "ដាក់ $u = x$, $dv = e^x dx$" },
      { content: "$I = [x e^x]_0^1 - \\int_0^1 e^x dx = e - (e - 1) = 1$" },
    ],
    origin: "demo",
  });
  if (error) throw new Error(`${error.code}: ${error.message}`);
});

await check("anyone can read it, and the app's mapper reads every column", async () => {
  const { data, error } = await anon.from("questions").select(QUESTION_SELECT).eq("id", question.id).single();
  if (error) throw new Error(error.message);
  const q = toQuestion(data);
  for (const [key, value] of Object.entries(q)) assert(value !== undefined, `Question.${key} is undefined (column missing?)`);
  assert(q.solution, "solution not embedded");
  for (const [key, value] of Object.entries(q.solution)) assert(value !== undefined, `QuestionSolution.${key} is undefined`);
  assert(q.subjectId === MATH && q.choices.length === 4 && q.solution.steps.length === 2, JSON.stringify(q));
  assert(isCorrect(q, q.solution, "b") === true && isCorrect(q, q.solution, "a") === false, "isCorrect wrong for multiple choice");
  return `${Object.keys(q).length} fields, solution with ${q.solution.steps.length} steps`;
});

await check("the subject always comes from the chapter, never the client", async () => {
  const subject = `test-subject-${run}`;
  const chapter = `test-chapter-${run}`;
  sql(`insert into public.curriculum_subjects (id, track_id, subject_key, name_en, name_km) values ('${subject}', 'kh-grade12-science', 'test-${run}', 'Test', 'សាកល្បង')`);
  sql(`insert into public.curriculum_chapters (id, subject_id, number, name_en, name_km) values ('${chapter}', '${subject}', 1, 'Test', 'សាកល្បង')`);
  try {
    const q = await insertQuestion(mcq({ chapter_id: chapter, topic_id: null, subject_id: MATH }));
    assert(q.subject_id === subject, `stored subject ${q.subject_id}`);
    await refused(db.from("questions").update({ subject_id: MATH }).eq("id", q.id).select().single().then((r) => (r.data?.subject_id === MATH ? { data: r.data } : { error: { code: "kept" } })), "subject change");
    await db.from("questions").delete().eq("id", q.id);
  } finally {
    sql(`delete from public.curriculum_chapters where id = '${chapter}'`);
    sql(`delete from public.curriculum_subjects where id = '${subject}'`);
  }
});

await check("a topic must belong to the question's chapter", async () =>
  refused(db.from("questions").insert(mcq({ topic_id: LIMITS_TOPIC })).select(), "topic from another chapter"),
);

await check("choices: 2–8 for multiple choice, unique short ids, none on other types", async () => {
  await refused(db.from("questions").insert(mcq({ choices: [{ id: "a", content: "1" }] })).select(), "one choice");
  await refused(db.from("questions").insert(mcq({ choices: [{ id: "a", content: "1" }, { id: "a", content: "2" }] })).select(), "duplicate ids");
  await refused(db.from("questions").insert(mcq({ choices: [{ id: "A long id", content: "1" }, { id: "b", content: "2" }] })).select(), "bad id");
  await refused(db.from("questions").insert(mcq({ choices: [{ id: "a", content: " " }, { id: "b", content: "2" }] })).select(), "empty choice");
  await refused(db.from("questions").insert(mcq({ type: "open" })).select(), "choices on an open question");
});

await check("a multiple-choice answer must be one of the choices, and stays one", async () => {
  const q = await insertQuestion(mcq());
  await refused(db.from("question_solutions").insert({ question_id: q.id, answer: "x", correct_choice: "z", origin: "demo" }).select(), "unknown choice");
  await refused(db.from("question_solutions").insert({ question_id: q.id, answer: "x", origin: "demo" }).select(), "no choice");
  const ok = await db.from("question_solutions").insert({ question_id: q.id, answer: "$e-1$", correct_choice: "d", origin: "demo" });
  assert(!ok.error, ok.error?.message);
  await refused(
    db.from("questions").update({ choices: [{ id: "a", content: "1" }, { id: "b", content: "2" }] }).eq("id", q.id).select(),
    "removing the right choice",
  );
});

await check("numeric answers: required, marked within the tolerance", async () => {
  const q = await insertQuestion({ chapter_id: INTEGRALS, type: "numeric", content: "Find $\\int_0^2 x\\,dx$.", origin: "demo", language: "en" });
  await refused(db.from("question_solutions").insert({ question_id: q.id, answer: "2", origin: "demo" }).select(), "numeric without a number");
  const { data, error } = await db
    .from("question_solutions")
    .insert({ question_id: q.id, answer: "$2$", numeric_answer: 2, numeric_tolerance: 0.01, correct_choice: "a", origin: "demo" })
    .select()
    .single();
  assert(!error, error?.message);
  assert(data.correct_choice === null, "a choice was kept on a numeric solution");
  const mapped = toQuestion({ ...q, solution: data });
  assert(isCorrect(mapped, mapped.solution, "2.005") === true, "2.005 should count");
  assert(isCorrect(mapped, mapped.solution, "2,0") === true, "a decimal comma should count");
  assert(isCorrect(mapped, mapped.solution, "2.1") === false, "2.1 should not count");
  assert(isCorrect(mapped, mapped.solution, "") === false, "an empty answer should not count");
});

await check("nothing is verified without a source; demo content is never verified", async () => {
  await refused(db.from("questions").insert(mcq({ origin: "teacher", verification: "verified" })).select(), "verified, no source");
  await refused(db.from("questions").insert(mcq({ origin: "demo", verification: "verified", source: "x" })).select(), "verified demo");
  const q = await insertQuestion(mcq());
  await refused(
    db.from("question_solutions").insert({ question_id: q.id, answer: "1", correct_choice: "b", origin: "ai-generated", verification: "verified" }).select(),
    "verified AI solution without a source",
  );
});

await check("an official past paper needs a year and a source", async () => {
  await refused(db.from("questions").insert(mcq({ origin: "official-past-paper", source: "MoEYS" })).select(), "no year");
  await refused(db.from("questions").insert(mcq({ origin: "official-past-paper", year: 2023 })).select(), "no source");
  const q = await insertQuestion(mcq({ origin: "official-past-paper", year: 2023, source: "Test source" }));
  assert(q.year === 2023, "year not stored");
});

await check("creator, verifier and dates come from the session, not the client", async () => {
  const q = await insertQuestion(mcq({ origin: "teacher", source: "Teacher test", created_by: student.id, created_at: "2001-01-01T00:00:00Z" }));
  assert(q.created_by === admin.id, `created_by ${q.created_by}`);
  assert(!q.created_at.startsWith("2001"), "created_at taken from the client");
  const { data } = await db
    .from("questions")
    .update({ verification: "verified", verified_by: student.id, verified_at: "2001-01-01T00:00:00Z", created_by: student.id })
    .eq("id", q.id)
    .select()
    .single();
  assert(data.verified_by === admin.id, `verified_by ${data.verified_by}`);
  assert(data.verified_at && !data.verified_at.startsWith("2001"), "verified_at taken from the client");
  assert(data.created_by === admin.id && data.created_at === q.created_at, "creator or date changed on update");
  assert(data.updated_at >= q.updated_at, "updated_at not refreshed");
  const back = await db.from("questions").update({ verification: "needs-review" }).eq("id", q.id).select().single();
  assert(back.data.verified_by === null && back.data.verified_at === null, "verifier kept after un-verifying");
});

await check("images must be https links; choices and steps have size limits", async () => {
  const image = (url) => [{ path: "x.png", url, alt: "graph" }];
  await refused(db.from("questions").insert(mcq({ images: image("javascript:alert(1)") })).select(), "javascript: image");
  await refused(db.from("questions").insert(mcq({ images: image("data:text/html,<b>x</b>") })).select(), "data: image");
  await refused(db.from("questions").insert(mcq({ images: image("http://example.com/a.png") })).select(), "http image");
  await refused(db.from("questions").insert(mcq({ images: [{ url: "https://example.com/a.png", alt: "x".repeat(301) }] })).select(), "long alt");
  await insertQuestion(mcq({ images: image("https://example.com/graph.png") }));
  const long = mcq();
  long.choices[0] = { id: "a", content: "x".repeat(2001) };
  await refused(db.from("questions").insert(long).select(), "2001-character choice");
  const q = await insertQuestion(mcq());
  await refused(
    db.from("question_solutions").insert({ question_id: q.id, answer: "1", correct_choice: "b", origin: "demo", steps: [{ content: "x".repeat(5001) }] }).select(),
    "5001-character step",
  );
});

await check("a question's type cannot change once it has a solution", async () =>
  refused(db.from("questions").update({ type: "open", choices: [] }).eq("id", question.id).select(), "type change"),
);

await check("editing verified content sends it back for review", async () => {
  const q = await insertQuestion(mcq({ origin: "teacher", source: "Teacher test", verification: "verified" }));
  assert(q.verification === "verified", "not verified to begin with");
  const tidy = await db.from("questions").update({ difficulty: 3 }).eq("id", q.id).select().single();
  assert(tidy.data.verification === "verified", "a difficulty change should not need review");
  const edit = await db.from("questions").update({ content: "Changed text" }).eq("id", q.id).select().single();
  assert(edit.data.verification === "needs-review" && edit.data.verified_by === null, `after editing: ${edit.data.verification}`);
  const sol = await db
    .from("question_solutions")
    .insert({ question_id: q.id, answer: "1", correct_choice: "b", origin: "teacher", source: "Teacher test", verification: "verified" })
    .select()
    .single();
  assert(sol.data?.verification === "verified", sol.error?.message);
  const changed = await db.from("question_solutions").update({ correct_choice: "c" }).eq("question_id", q.id).select().single();
  assert(changed.data.verification === "needs-review", `solution after editing: ${changed.data.verification}`);
});

await check("a chapter or topic with questions cannot move to another subject or chapter", async () => {
  let blocked = false;
  try {
    sql(`update public.curriculum_topics set chapter_id = '${MATH}-limits-continuity' where id = '${BY_PARTS}'`);
  } catch {
    blocked = true;
  }
  assert(blocked, "topic with questions was moved");
});

await check("students and visitors can read but not write", async () => {
  const read = await student.client.from("questions").select("id, solution:question_solutions(answer)").eq("id", question.id).single();
  assert(read.data?.solution, "student cannot read the question and its solution");
  await refused(student.client.from("questions").insert(mcq()).select(), "student insert");
  await refused(anon.from("questions").insert(mcq()).select(), "visitor insert");
  const update = await student.client.from("questions").update({ content: "hacked" }).eq("id", question.id).select();
  assert(!update.data?.length, "student update went through");
  const solution = await student.client.from("question_solutions").update({ correct_choice: "a" }).eq("question_id", question.id).select();
  assert(!solution.data?.length, "student changed the answer key");
  const del = await student.client.from("questions").delete().eq("id", question.id).select();
  assert(!del.data?.length, "student delete went through");
});

await check("a chapter with questions cannot be deleted; deleting a question removes its solution", async () => {
  let blocked = false;
  try {
    sql(`delete from public.curriculum_chapters where id = '${INTEGRALS}'`);
  } catch {
    blocked = true;
  }
  assert(blocked, "chapter with questions was deleted");
  await db.from("questions").delete().eq("id", question.id);
  made.splice(made.indexOf(question.id), 1);
  assert(sql(`select count(*) from public.question_solutions where question_id = '${question.id}'`) === "0", "solution left behind");
});

// Clean up everything this run made.
if (made.length) await db.from("questions").delete().in("id", made);
await people.cleanUp();
const left = sql(`select count(*) from public.questions where id in (${made.map((id) => `'${id}'`).join(",") || "null"})`);
if (left !== "0") console.log(`warning: ${left} test question(s) left behind`);
finish();
