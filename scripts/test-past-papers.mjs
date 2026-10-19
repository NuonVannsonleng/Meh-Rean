#!/usr/bin/env node
/**
 * Checks for the real BacII past papers (src/data/past-papers/).
 *
 *   npm run test:past-papers
 *
 * Data part: every paper builds, has its printed length (matching the BacII
 * paper lengths in src/data/bacii/exam-timings.json), adds up to its points,
 * stays official but unchecked, and names the copies it was typed from; the
 * generated SQL is up to date. Database part (LOCAL Supabase only, after
 * supabase/setup-all.sql): anyone can read the papers in order, they carry no
 * answer keys, and an official paper refuses anything but its own year's
 * official questions.
 */

import { readFileSync, readdirSync } from "node:fs";
import { flattenCurriculum } from "../src/lib/curriculum.ts";
import { buildPastPapers } from "../src/lib/papers.ts";
import { splitMath } from "../src/lib/mathText.ts";
import katex from "katex";
import { accounts, assert, localTarget, reporter } from "./lib/local-supabase.mjs";

const ROOT = new URL("../", import.meta.url);
const { check, skip, finish } = reporter();
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");

const chapters = readdirSync(new URL("src/data/curriculum/", ROOT))
  .filter((name) => name.endsWith(".json"))
  .flatMap((name) => flattenCurriculum(JSON.parse(read(`src/data/curriculum/${name}`))).chapters);
const seeds = readdirSync(new URL("src/data/past-papers/", ROOT))
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({ name, seed: JSON.parse(read(`src/data/past-papers/${name}`)) }));
const papers = seeds.flatMap(({ seed }) => buildPastPapers(seed, chapters));
const timings = JSON.parse(read("src/data/bacii/exam-timings.json"));

const ALL_SITTINGS = "2014f,2014s,2015,2016,2017,2018,2019,2021,2022,2023,2024,2025";
await check("science- and social-track mathematics: every sitting from 2014 to 2025 (none in 2020), each built and in order", async () => {
  for (const subjectId of ["kh-grade12-science-mathematics", "kh-grade12-social-mathematics"]) {
    const sittings = papers
      .filter((paper) => paper.subjectId === subjectId)
      .map((paper) => `${paper.year}${/first|second/.exec(paper.titleEn)?.[0]?.[0] ?? ""}`)
      .sort();
    assert(sittings.join() === ALL_SITTINGS, `${subjectId}: ${sittings.join()}`);
  }
  assert(new Set(papers.map((paper) => paper.id)).size === papers.length, "duplicate paper ids");
  const questionIds = papers.flatMap((paper) => paper.questions.map((entry) => entry.question.id));
  assert(new Set(questionIds).size === questionIds.length && questionIds.every((id) => /^bacc[0-9]{4}-[0-9]{4}-4[0-2]00-8000-0{10}[0-9]{2}$/.test(id)), "question ids");
  // Other subjects: only sittings that happened (none in 2020), one paper per sitting.
  for (const { seed } of seeds) {
    const keys = seed.papers.map((paper) => `${paper.year}${paper.session ? `-${paper.session}` : ""}`);
    assert(new Set(keys).size === keys.length && keys.every((key) => /^(2014-[12]|2015|2016|2017|2018|2019|2021|2022|2023|2024|2025)$/.test(key)), `${seed.subjectId}: ${keys.join()}`);
  }
  return `${seeds.length} subjects, ${papers.length} papers, ${questionIds.length} exercises`;
});

await check("each paper keeps its printed length, which matches the BacII paper lengths; points add up to the paper's total", async () => {
  for (const { seed } of seeds) {
    const [, trackId, subjectKey] = /^kh-grade12-(science|social)-(.+)$/.exec(seed.subjectId);
    const subjectId = subjectKey === "english" || subjectKey === "french" ? "foreign-language" : subjectKey;
    const timing = timings.tracks.find((track) => track.id === trackId).subjects.find((subject) => subject.id === subjectId);
    for (const paper of seed.papers) {
      assert(paper.minutes === timing.minutes, `${seed.subjectId} ${paper.year}: ${paper.minutes} minutes, the timer says ${timing.minutes}`);
      assert(paper.points === timing.points, `${seed.subjectId} ${paper.year}: ${paper.points} points, the timer says ${timing.points}`);
    }
  }
  for (const paper of papers) {
    assert(paper.durationMinutes && /រយៈពេល/.test(paper.durationSource), `${paper.id}: printed length`);
    const seed = seeds.find((item) => item.seed.subjectId === paper.subjectId).seed;
    const printed = seed.papers.find((item) => item.year === paper.year && (item.session ?? 0) === Number(paper.id.slice(15, 16))).points;
    assert(paper.totalPoints === null || paper.totalPoints === printed, `${paper.id}: ${paper.totalPoints} points, ${printed} printed`);
  }
});

await check("real papers stay official but unchecked, with open questions, no answer key, every formula readable, and their copies named", async () => {
  for (const paper of papers) {
    assert(paper.origin === "official" && paper.verification === "needs-review", `${paper.id}: origin or verification`);
    assert(/Typed by Meh Rean from/.test(paper.source) && /Not yet checked/.test(paper.source) && paper.source.length <= 500, `${paper.id}: source`);
    for (const { question } of paper.questions) {
      assert(question.origin === "official-past-paper" && question.verification === "needs-review" && question.year === paper.year, `${question.id}: origin`);
      assert(question.type === "open" && question.solution === null && question.source === paper.source, `${question.id}: type or answer key`);
      const language = paper.subjectId.endsWith("-english") ? "en" : paper.subjectId.endsWith("-french") ? "fr" : "km";
      assert(question.language === language, `${question.id}: language ${question.language}, expected ${language}`);
      for (const segment of splitMath(question.content).filter((part) => part.kind === "math")) {
        try {
          katex.renderToString(segment.value, { throwOnError: true, strict: "ignore", displayMode: segment.display });
        } catch (error) {
          throw new Error(`${question.id}: ${String(error.message).split("\n")[0]}`);
        }
      }
    }
  }
});

await check("the builder refuses a paper whose points do not add up, an unknown chapter or copy, and a bad date", async () => {
  const base = seeds[0].seed;
  const broken = [
    ["points", (seed) => (seed.papers[0].questions[0].points += 1)],
    ["chapter", (seed) => (seed.papers[0].questions[0].chapter = "no-such-chapter")],
    ["copy", (seed) => (seed.papers[0].copies = ["nobody"])],
    ["date", (seed) => (seed.papers[0].date = "1999-01-01")],
    ["duplicate", (seed) => seed.papers.push(structuredClone(seed.papers[0]))],
  ];
  for (const [name, breakIt] of broken) {
    const copy = structuredClone(base);
    breakIt(copy);
    let threw = false;
    try {
      buildPastPapers(copy, chapters);
    } catch {
      threw = true;
    }
    assert(threw, `accepted a broken ${name}`);
  }
});

await check("supabase/seed/past-papers.sql and setup-all.sql are up to date with the JSON", async () => {
  const seed = read("supabase/seed/past-papers.sql");
  const setup = read("supabase/setup-all.sql");
  for (const paper of papers) {
    assert(seed.includes(`'${paper.id}'`), `${paper.id} missing: run npm run build:past-papers-seed`);
    for (const { question } of paper.questions) {
      const text = question.content.replace(/'/g, "''");
      assert(seed.includes(text), `${question.id} changed: run npm run build:past-papers-seed`);
      assert(setup.includes(text), `${question.id}: run npm run build:setup-sql`);
    }
  }
});

const target = localTarget();
if (!target) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}

const people = accounts(target, "pastpapers");
const { anon } = people;
const admin = await people.create("a", { admin: true });
const sample = papers.find((paper) => paper.id === "bacc1010-2019-4000-8000-000000000000");

await check("anyone can read a real paper with its questions in order, its printed length, and no answer key", async () => {
  const { data, error } = await anon
    .from("exam_papers")
    .select("id, year, origin, verification, duration_minutes, entries:exam_paper_questions(position, points, question:questions(id, type, origin, content))")
    .eq("id", sample.id)
    .maybeSingle();
  if (error || !data) throw new Error(`${error?.message ?? "missing"} (has supabase/setup-all.sql been run?)`);
  assert(data.origin === "official" && data.verification === "needs-review" && data.duration_minutes === 150, JSON.stringify({ ...data, entries: undefined }));
  const ordered = [...data.entries].sort((a, b) => a.position - b.position);
  assert(JSON.stringify(ordered.map((entry) => entry.question.id)) === JSON.stringify(sample.questions.map((entry) => entry.question.id)), "order");
  assert(ordered.reduce((sum, entry) => sum + Number(entry.points), 0) === 125, "points");
  assert(ordered.every((entry) => entry.question.type === "open" && entry.question.origin === "official-past-paper"), "types");
  const keys = await anon.from("question_solutions").select("question_id").in("question_id", ordered.map((entry) => entry.question.id));
  assert(!keys.data?.length, "an answer key exists");
});

await check("an official paper refuses a question from another year or a demo question, even from an admin", async () => {
  const other = papers.find((paper) => paper.id === "bacc1010-2018-4000-8000-000000000000").questions[0].question.id;
  const demo = "6d1f0a00-0000-4000-8000-000000002201";
  for (const question of [other, demo]) {
    const { error } = await admin.client.from("exam_paper_questions").insert({ paper_id: sample.id, question_id: question, position: 99, points: 1 });
    assert(error, `${question} was added to the 2019 paper`);
  }
  const student = await people.create("s");
  const { error } = await student.client.from("exam_papers").update({ title_en: "changed" }).eq("id", sample.id).select();
  const after = await anon.from("exam_papers").select("title_en").eq("id", sample.id).single();
  assert(after.data.title_en === sample.titleEn, `a student renamed the paper (${error?.message ?? "no error"})`);
});

await people.cleanUp();
finish();
