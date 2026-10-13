#!/usr/bin/env node
/**
 * Checks for the BacII past paper bank (roadmap task 2.1).
 *
 *   npm run test:papers
 *
 * Seed part: the demo papers build from src/data/demo/ and the generated SQL
 * is up to date. Database part (LOCAL Supabase only, after schema.sql and
 * both seeds): papers load with their questions in order, and the rules that
 * keep demo content from passing as official hold.
 */

import { readFileSync, readdirSync } from "node:fs";
import { flattenCurriculum } from "../src/lib/curriculum.ts";
import { buildDemoPapers } from "../src/lib/papers.ts";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const ROOT = new URL("../", import.meta.url);
const { check, skip, finish } = reporter();
const MATH = "kh-grade12-science-mathematics";

const chapters = readdirSync(new URL("src/data/curriculum/", ROOT))
  .filter((name) => name.endsWith(".json"))
  .flatMap((name) => flattenCurriculum(JSON.parse(readFileSync(new URL(`src/data/curriculum/${name}`, ROOT), "utf8"))).chapters);
const demo = readdirSync(new URL("src/data/demo/", ROOT))
  .filter((name) => name.endsWith(".json"))
  .flatMap((name) => buildDemoPapers(JSON.parse(readFileSync(new URL(`src/data/demo/${name}`, ROOT), "utf8")), chapters));

await check("the demo papers build and are all marked demo and unchecked", async () => {
  assert(demo.length >= 3, `${demo.length} papers`);
  for (const paper of demo) {
    assert(paper.origin === "demo" && paper.verification !== "verified", `${paper.id} not demo`);
    assert(/demo/i.test(paper.titleEn) && /not the real/i.test(paper.titleEn), `${paper.id}: title must say it is demo, not real`);
    for (const { question } of paper.questions) assert(question.origin === "demo" && question.solution.origin === "demo", `${question.id} not demo`);
  }
  return demo.map((paper) => `${paper.year}: ${paper.questionCount} questions`).join(", ");
});

await check("supabase/seed/demo-papers.sql is up to date with the JSON", async () => {
  const seed = readFileSync(new URL("supabase/seed/demo-papers.sql", ROOT), "utf8");
  for (const paper of demo) {
    assert(seed.includes(`'${paper.id}'`), `${paper.id} missing: rerun node scripts/build-demo-seed.mjs`);
    for (const { question } of paper.questions) {
      assert(seed.includes(question.content.replace(/'/g, "''")), `${question.id} changed: rerun node scripts/build-demo-seed.mjs`);
    }
  }
});

const target = localTarget();
if (!target) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "papers");
const { anon, run } = people;
const admin = await people.create("a", { admin: true });
const student = await people.create("s");
const db = admin.client;
const madePapers = [];
const madeQuestions = [];

await check("anyone can browse the demo papers by subject and year, questions in order", async () => {
  const { data, error } = await anon
    .from("exam_papers")
    .select("id, year, origin, entries:exam_paper_questions(position, question:questions(id, content))")
    .eq("subject_id", MATH)
    .order("year");
  if (error) throw new Error(`${error.message} (has supabase/seed/demo-papers.sql been run?)`);
  for (const paper of demo) {
    const row = data.find((item) => item.id === paper.id);
    assert(row && row.year === paper.year && row.origin === "demo", `${paper.year} paper missing`);
    const ordered = [...row.entries].sort((a, b) => a.position - b.position).map((entry) => entry.question.id);
    assert(JSON.stringify(ordered) === JSON.stringify(paper.questions.map((q) => q.question.id)), `${paper.year}: questions out of order`);
  }
  const byYear = await anon.from("exam_papers").select("id").eq("subject_id", MATH).eq("year", 2024);
  assert(byYear.data.some((row) => row.id === demo.find((p) => p.year === 2024).id), "year filter");
});

await check("questions filter by subject, chapter and topic in the database (task 2.3)", async () => {
  const demoQuestions = demo.flatMap((p) => p.questions.map((entry) => entry.question));
  const ids = (rows) => rows.map((row) => row.id).sort().join();
  const expect = (filter) => ids(demoQuestions.filter(filter));
  const bySubject = await anon.from("questions").select("id").eq("subject_id", MATH).eq("origin", "demo");
  assert(ids(bySubject.data) === expect(() => true), "subject filter");
  const chapter = `${MATH}-integrals`;
  const byChapter = await anon.from("questions").select("id").eq("chapter_id", chapter).eq("origin", "demo");
  assert(ids(byChapter.data) === expect((q) => q.chapterId === chapter), "chapter filter");
  const topic = `${chapter}-area`;
  const byTopic = await anon.from("questions").select("id").eq("topic_id", topic).eq("origin", "demo");
  assert(ids(byTopic.data) === expect((q) => q.topicId === topic) && byTopic.data.length === 1, "topic filter");
  return `${bySubject.data.length} / ${byChapter.data.length} / ${byTopic.data.length}`;
});

async function paper(row) {
  const { data, error } = await db.from("exam_papers").insert({ subject_id: MATH, year: 2023, title_en: `Test ${run}`, title_km: "សាកល្បង", ...row }).select().single();
  if (error) throw new Error(`${error.code}: ${error.message}`);
  madePapers.push(data.id);
  return data;
}

async function question(row) {
  const { data, error } = await db
    .from("questions")
    .insert({ chapter_id: `${MATH}-integrals`, type: "open", content: `Test ${run}`, origin: "demo", ...row })
    .select()
    .single();
  if (error) throw new Error(`${error.code}: ${error.message}`);
  madeQuestions.push(data.id);
  return data;
}

await check("an official paper needs a source; a demo paper is never verified", async () => {
  const noSource = await db.from("exam_papers").insert({ subject_id: MATH, year: 2023, title_en: "x", title_km: "ក", origin: "official" }).select();
  assert(noSource.error, "official paper without a source accepted");
  const verifiedDemo = await db
    .from("exam_papers")
    .insert({ subject_id: MATH, year: 2023, title_en: "x", title_km: "ក", origin: "demo", verification: "verified", source: "x" })
    .select();
  assert(verifiedDemo.error, "verified demo paper accepted");
});

await check("an official paper only takes official past-paper questions from its own year", async () => {
  const official = await paper({ origin: "official", source: `Test source ${run}` });
  const demoQuestion = await question({});
  const wrongYear = await question({ origin: "official-past-paper", year: 2022, source: "Test" });
  const right = await question({ origin: "official-past-paper", year: 2023, source: "Test" });
  const a = await db.from("exam_paper_questions").insert({ paper_id: official.id, question_id: demoQuestion.id, position: 1 });
  assert(a.error, "demo question accepted on an official paper");
  const b = await db.from("exam_paper_questions").insert({ paper_id: official.id, question_id: wrongYear.id, position: 1 });
  assert(b.error, "question from another year accepted");
  const c = await db.from("exam_paper_questions").insert({ paper_id: official.id, question_id: right.id, position: 1, points: 5 });
  assert(!c.error, c.error?.message);
  const change = await db.from("exam_papers").update({ year: 2024 }).eq("id", official.id).select();
  assert(change.error, "paper year changed while it holds questions");
  const toDemo = await db.from("exam_papers").update({ origin: "demo" }).eq("id", official.id).select();
  assert(toDemo.error, "paper origin changed while it holds questions");
});

await check("a paper's questions must be from its subject", async () => {
  const subject = `test-subject-${run}`;
  const chapter = `test-chapter-${run}`;
  sql(`insert into public.curriculum_subjects (id, track_id, subject_key, name_en, name_km) values ('${subject}', 'kh-grade12-science', 'test-${run}', 'Test', 'សាកល្បង')`);
  sql(`insert into public.curriculum_chapters (id, subject_id, number, name_en, name_km) values ('${chapter}', '${subject}', 1, 'Test', 'សាកល្បង')`);
  try {
    const other = await question({ chapter_id: chapter });
    const demoPaper = await paper({ origin: "demo" });
    const wrong = await db.from("exam_paper_questions").insert({ paper_id: demoPaper.id, question_id: other.id, position: 1 });
    assert(wrong.error, "question from another subject accepted");
    await db.from("questions").delete().eq("id", other.id);
  } finally {
    sql(`delete from public.questions where chapter_id = '${chapter}'`);
    sql(`delete from public.curriculum_chapters where id = '${chapter}'`);
    sql(`delete from public.curriculum_subjects where id = '${subject}'`);
  }
});

await check("students and visitors can read papers but not change them", async () => {
  const insert = await student.client.from("exam_papers").insert({ subject_id: MATH, year: 2023, title_en: "x", title_km: "ក", origin: "demo" }).select();
  assert(insert.error, "student created a paper");
  const target2023 = demo.find((p) => p.year === 2023);
  const update = await student.client.from("exam_papers").update({ title_en: "hacked" }).eq("id", target2023.id).select();
  assert(!update.data?.length, "student renamed a paper");
  const unlink = await student.client.from("exam_paper_questions").delete().eq("paper_id", target2023.id).select();
  assert(!unlink.data?.length, "student removed questions from a paper");
  const visitor = await anon.from("exam_paper_questions").insert({ paper_id: target2023.id, question_id: target2023.questions[0].question.id, position: 99 });
  assert(visitor.error, "visitor added to a paper");
});

if (madePapers.length) await db.from("exam_papers").delete().in("id", madePapers);
if (madeQuestions.length) await db.from("questions").delete().in("id", madeQuestions);
await people.cleanUp();
finish();
