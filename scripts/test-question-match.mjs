#!/usr/bin/env node
/**
 * Unit checks for src/lib/questionMatch.ts (roadmap task 4.5) against the
 * demo question bank: a photographed or retyped exercise should find its
 * question, and nothing else should look like a match.
 *
 *   npm run test:question-match
 */

import { readFileSync } from "node:fs";
import { matchQuestions, normalizeForMatch, similarity } from "../src/lib/questionMatch.ts";

const results = [];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, actual, expected) {
  results.push(same(actual, expected) ? ["✓", name] : ["✗", name, `got ${JSON.stringify(actual)}`]);
}

const demo = JSON.parse(readFileSync(new URL("../src/data/demo/kh-grade12-math-papers.json", import.meta.url), "utf8"));
const questions = demo.papers.flatMap((paper) =>
  paper.questions.map((question) => ({ ...question, choices: question.choices ?? [] })),
);
const best = (text, chapterId = null) => matchQuestions(text, questions, chapterId)[0]?.question.id ?? null;

check("LaTeX is reduced to its symbols", normalizeForMatch("Find $\\frac{1}{2}\\,x^2$ and \\(\\sqrt{x}\\)."), "find 1/2 x^2 and sqrt x");
check("the same text is a perfect match", similarity("abc def ghi", "abc def ghi"), 1);
check("unrelated text scores low", similarity("ចូរគណនាលីមីត", "Balance the chemical equation Fe + O2") < 0.2, true);

let found = 0;
for (const question of questions) {
  // As a reader might return it: spacing and markup changed, a small slip.
  const retyped = question.content.replace(/\s+/g, "  ").replace(/\$/g, " $ ").replace(/\\left|\\right/g, "");
  if (best(retyped) === question.id) found += 1;
}
check(`every demo question finds itself when retyped (${questions.length})`, found, questions.length);

const sample = questions[0];
const halfway = sample.content.slice(0, Math.ceil(sample.content.length * 0.7));
check("most of an exercise (70%) still finds it", best(halfway), sample.id);
check("something not in the bank finds nothing", matchQuestions("Explain the causes of the First World War in 200 words.", questions), []);
check("too short to judge finds nothing", matchQuestions("x", questions), []);
check("at most three matches, best first", (() => {
  const list = matchQuestions(sample.content, questions);
  return list.length <= 3 && list.every((m, i) => i === 0 || list[i - 1].score >= m.score);
})(), true);

for (const [mark, name, detail] of results) console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
const failed = results.filter((r) => r[0] === "✗").length;
console.log(`\nPassed ${results.length - failed}   Failed ${failed}`);
process.exit(failed ? 1 : 0);
