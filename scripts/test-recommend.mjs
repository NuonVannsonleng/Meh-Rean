#!/usr/bin/env node
/**
 * Unit checks for what to study next (Learning OS 4): src/lib/recommend.ts
 * with src/data/learning/recommendation-rules.json, on the real curriculum
 * and topic links. No database.
 *
 *   npm run test:recommend
 */

import { readFileSync } from "node:fs";
import { flattenCurriculum } from "../src/lib/curriculum.ts";
import { expandLinks } from "../src/lib/conceptGraph.ts";
import { rankCandidates, recommend } from "../src/lib/recommend.ts";
import { assert, reporter } from "./lib/local-supabase.mjs";

const { check, finish } = reporter();
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const rules = read("../src/data/learning/recommendation-rules.json");
const curriculum = flattenCurriculum(read("../src/data/curriculum/kh-grade12.json"));
const topics = curriculum.chapters.flatMap((chapter) => chapter.topics.map((topic) => ({ id: topic.id, chapterId: chapter.id })));
const links = expandLinks(read("../src/data/curriculum-links/kh-grade12-math.json"));
const T = (short) => `kh-grade12-science-mathematics-${short}`;
const short = (id) => id.replace(T(""), "");
const NOW = new Date("2026-10-17T05:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const LABELS = [["needs-foundation", 0], ["developing", 25], ["practising", 50], ["strong", 75], ["consistently-strong", 90]];
const m = (topic, score, { evidence = 5, lastAt = daysAgo(1) } = {}) => ({
  topicId: T(topic),
  score,
  evidence,
  correct: 0,
  lastAt,
  confidence: 0.5,
  confidenceLevel: "medium",
  label: evidence < 3 ? "unknown" : [...LABELS].reverse().find(([, from]) => score >= from)[0],
  version: 2,
});
const input = (extra = {}) => ({ topics, links, mastery: [], reviews: [], examDate: null, labelAfter: 3, now: NOW, ...extra });
const find = (list, topic) => list.find((item) => item.topicId === T(topic));

await check("the rules file has a version, a limit and a weight for every kind", async () => {
  assert(Number.isInteger(rules.version) && rules.limit > 0 && rules.maxPerChapter > 0, "version, limit");
  for (const kind of ["review", "prerequisite", "weak", "continue", "refresh", "next"]) assert(rules.weights[kind] > 0, `weight ${kind}`);
});

await check("a new student is pointed at starting points in curriculum order, at most 2 per chapter", async () => {
  const list = recommend(input(), rules);
  assert(list.length === rules.limit, `${list.length} recommendations`);
  assert(short(list[0].topicId) === "limits-continuity-limits" && list[0].reasons[0].code === "start-here", JSON.stringify(list[0]));
  assert(list.every((item) => item.kind === "next"), "kinds");
  const chapters = list.map((item) => topics.find((topic) => topic.id === item.topicId).chapterId);
  assert(Math.max(...chapters.map((c) => chapters.filter((x) => x === c).length)) <= rules.maxPerChapter, "too many from one chapter");
  // Every suggested new topic has its prerequisites in place: none at all for a new student.
  assert(list.every((item) => !links.some((link) => link.kind === "prerequisite" && link.toTopic === item.topicId)), list.map((i) => short(i.topicId)).join());
});

await check("due reviews rank high; more and older ones are more urgent; future ones do not count", async () => {
  const list = recommend(
    input({
      mastery: [m("probability-counting", 20)],
      reviews: [
        { topicId: T("conics-ellipse"), nextReviewAt: daysAgo(7) },
        { topicId: T("integrals-area"), nextReviewAt: daysAgo(10) },
        { topicId: T("integrals-area"), nextReviewAt: daysAgo(2) },
        { topicId: T("vectors-space-dot-product"), nextReviewAt: daysAgo(-3) },
      ],
    }),
    rules,
  );
  assert(short(list[0].topicId) === "integrals-area" && list[0].kind === "review", short(list[0].topicId));
  assert(list[0].reasons[0].code === "reviews-due" && list[0].reasons[0].count === 2 && list[0].reasons[0].overdueDays === 10, JSON.stringify(list[0].reasons[0]));
  assert(short(list[1].topicId) === "conics-ellipse", short(list[1].topicId));
  assert(!find(list, "vectors-space-dot-product") || find(list, "vectors-space-dot-product").kind !== "review", "a review not yet due");
});

await check("a weak topic's weak prerequisite is suggested first, saying what it is needed for", async () => {
  const list = rankCandidates(input({ mastery: [m("integrals-by-parts", 30)] }), rules);
  const before = find(list, "integrals-antiderivatives");
  const weak = find(list, "integrals-by-parts");
  assert(before.kind === "prerequisite" && before.reasons[0].code === "needed-for" && before.reasons[0].topicId === T("integrals-by-parts"), JSON.stringify(before));
  assert(before.score > weak.score, `${before.score} vs ${weak.score}`);
  assert(weak.kind === "weak" && weak.reasons[0].code === "weak" && weak.reasons[0].score === 30, JSON.stringify(weak));
});

await check("a weak topic with its prerequisites in place is suggested at full weight; the weaker, the higher", async () => {
  const ready = [m("integrals-antiderivatives", 80)];
  const list = rankCandidates(input({ mastery: [...ready, m("integrals-by-parts", 30), m("probability-counting", 10)] }), rules);
  assert(find(list, "integrals-by-parts").score === 1.4, `${find(list, "integrals-by-parts").score}`);
  assert(find(list, "probability-counting").score > find(list, "integrals-by-parts").score, "weaker topic ranked lower");
});

await check("a topic with too few answers for an estimate asks for more; a long-unpractised one asks for a refresh", async () => {
  const list = rankCandidates(input({ mastery: [m("conics-ellipse", 60, { evidence: 2 }), m("conics-parabola", 80, { lastAt: daysAgo(20) }), m("conics-hyperbola", 80, { lastAt: daysAgo(3) })] }), rules);
  const more = find(list, "conics-ellipse");
  assert(more.kind === "continue" && more.reasons[0].needed === 1 && more.score === 1, JSON.stringify(more));
  const refresh = find(list, "conics-parabola");
  assert(refresh.kind === "refresh" && refresh.reasons[0].days === 20, JSON.stringify(refresh));
  assert(!find(list, "conics-hyperbola"), "a recently practised strong topic was suggested");
});

await check("an exam within 60 days boosts weak topics and says so; a far or past exam does not", async () => {
  const weak = [m("integrals-antiderivatives", 80), m("integrals-by-parts", 30)];
  const base = find(rankCandidates(input({ mastery: weak }), rules), "integrals-by-parts");
  const soon = find(rankCandidates(input({ mastery: weak, examDate: "2026-11-16" }), rules), "integrals-by-parts");
  const far = find(rankCandidates(input({ mastery: weak, examDate: "2027-06-01" }), rules), "integrals-by-parts");
  const past = find(rankCandidates(input({ mastery: weak, examDate: "2026-10-01" }), rules), "integrals-by-parts");
  assert(soon.score > base.score && soon.reasons.some((r) => r.code === "exam-soon" && r.days === 30), JSON.stringify(soon));
  assert(far.score === base.score && past.score === base.score && !far.reasons.some((r) => r.code === "exam-soon"), "far or past exam changed it");
});

await check("a topic practised today rests (half score) unless reviews are due", async () => {
  const today = new Date(NOW.getTime() - 3_600_000).toISOString();
  const weak = [m("integrals-antiderivatives", 80), m("integrals-by-parts", 30, { lastAt: today })];
  assert(find(rankCandidates(input({ mastery: weak }), rules), "integrals-by-parts").score === 0.7, "not rested");
  const reviewed = find(rankCandidates(input({ mastery: weak, reviews: [{ topicId: T("integrals-by-parts"), nextReviewAt: daysAgo(1) }] }), rules), "integrals-by-parts");
  assert(reviewed.score === 1.4 && reviewed.reasons.some((r) => r.code === "reviews-due"), JSON.stringify(reviewed));
});

await check("each topic once, with all its reasons; deterministic whatever the input order", async () => {
  const mastery = [m("derivatives-rules", 20), m("integrals-antiderivatives", 20), m("integrals-by-parts", 10)];
  const reviews = [{ topicId: T("derivatives-rules"), nextReviewAt: daysAgo(4) }];
  const list = rankCandidates(input({ mastery, reviews }), rules);
  assert(new Set(list.map((item) => item.topicId)).size === list.length, "a topic twice");
  const both = find(list, "integrals-antiderivatives");
  assert(both.reasons.some((r) => r.code === "weak") && both.reasons.some((r) => r.code === "needed-for"), JSON.stringify(both.reasons));
  const again = rankCandidates(input({ mastery: [...mastery].reverse(), reviews, topics }), rules);
  assert(JSON.stringify(again) === JSON.stringify(list), "order changed the result");
});

await check("unknown topics are ignored; the list never exceeds the limit", async () => {
  const list = recommend(input({ mastery: [{ ...m("conics-ellipse", 10), topicId: "nope" }], reviews: [{ topicId: "nope", nextReviewAt: daysAgo(3) }, { topicId: null, nextReviewAt: daysAgo(3) }] }), rules);
  assert(!list.some((item) => item.topicId === "nope") && list.length <= rules.limit, JSON.stringify(list.map((i) => i.topicId)));
});

finish();
