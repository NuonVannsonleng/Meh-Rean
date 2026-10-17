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
import { expandLinks, prerequisitesOf } from "../src/lib/conceptGraph.ts";
import { needsWork } from "../src/lib/mastery.ts";
import { rankCandidates, reasonSignature, recommend } from "../src/lib/recommend.ts";
import { reasonText } from "../src/lib/recommendText.ts";
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
const everywhere = Object.fromEntries(topics.map((topic) => [topic.id, { questions: 1, videos: [], notes: [] }]));
const input = (extra = {}) => ({ topics, links, mastery: [], reviews: [], examDate: null, labelAfter: 3, now: NOW, resources: everywhere, ...extra });
const find = (list, topic) => list.find((item) => item.topicId === T(topic));

await check("the rules file has a version, a limit and a weight for every kind", async () => {
  assert(Number.isInteger(rules.version) && rules.limit > 0 && rules.maxPerChapter > 0 && rules.snoozeDays > 0, "version, limit, snooze");
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

await check("each recommendation says what to do: reviews, else practice, else a video, else a note", async () => {
  const resources = {
    ...everywhere,
    [T("limits-continuity-limits")]: { questions: 2, videos: [{ id: "abc123def45", title: "Limits" }], notes: [{ id: "n1", title: "Limit notes" }] },
    [T("limits-continuity-indeterminate-forms")]: { questions: 0, videos: [{ id: "zzz123def45", title: "Forms" }], notes: [] },
    [T("derivatives-rules")]: { questions: 0, videos: [], notes: [{ id: "n2", title: "Rules" }] },
  };
  const mastery = [m("limits-continuity-limits", 80), m("limits-continuity-indeterminate-forms", 20), m("derivatives-rules", 20)];
  const list = recommend(input({ mastery, resources, reviews: [{ topicId: T("limits-continuity-limits"), nextReviewAt: daysAgo(2) }] }), rules);
  const limits = find(list, "limits-continuity-limits");
  assert(limits.action.type === "review" && limits.action.due === 1, JSON.stringify(limits.action));
  assert(limits.also.map((a) => a.type).join() === "video,note", JSON.stringify(limits.also));
  assert(find(list, "limits-continuity-indeterminate-forms").action.type === "video", "no video action");
  assert(find(list, "derivatives-rules").action.type === "note", "no note action");
});

await check("a topic with nothing to learn it with is left out, and does not take a place", async () => {
  const empty = { questions: 0, videos: [], notes: [] };
  const resources = { ...everywhere, [T("limits-continuity-limits")]: empty, [T("probability-counting")]: empty };
  const list = recommend(input({ resources }), rules);
  assert(!find(list, "limits-continuity-limits") && !find(list, "probability-counting"), list.map((i) => short(i.topicId)).join());
  assert(list.length === rules.limit, `${list.length} recommendations`);
  // Reviews need no other resource.
  const reviewOnly = recommend(input({ resources: { ...resources }, reviews: [{ topicId: T("limits-continuity-limits"), nextReviewAt: daysAgo(1) }] }), rules);
  assert(find(reviewOnly, "limits-continuity-limits")?.action.type === "review", "a due review was left out");
  assert(recommend(input({ resources: {} }), rules).length === 0, "recommended with nothing at all");
});

await check("every reason reads as a sentence in English and in Khmer", async () => {
  const reasons = [
    { code: "reviews-due", count: 2, overdueDays: 3 },
    { code: "reviews-due", count: 1, overdueDays: 0 },
    { code: "weak", label: "developing", score: 31 },
    { code: "needed-for", topicId: T("integrals-by-parts") },
    { code: "few-answers", needed: 1 },
    { code: "not-practised", days: 20 },
    { code: "start-here" },
    { code: "next-in-order" },
    { code: "exam-soon", days: 30 },
  ];
  const nameOf = (id) => `«${short(id)}»`;
  for (const reason of reasons) {
    const en = reasonText(reason, "en", nameOf);
    const km = reasonText(reason, "km", nameOf);
    assert(/^[A-Z0-9«].*\.$/.test(en) && !/undefined|NaN/.test(en), `English for ${reason.code}: ${en}`);
    assert(/[\u1780-\u17FF]/.test(km) && km.endsWith("។") && !/undefined|NaN/.test(km), `Khmer for ${reason.code}: ${km}`);
  }
  assert(reasonText(reasons[3], "en", nameOf).includes("«integrals-by-parts»") && reasonText(reasons[3], "km", nameOf).includes("«integrals-by-parts»"), "topic name missing");
  assert(reasonText(reasons[0], "en", nameOf) === "2 mistakes are due for review (3 days overdue)." && reasonText(reasons[1], "en", nameOf) === "1 mistake is due for review.", "review wording");
});

await check("'Not now' sets a suggestion aside until it expires or its reason changes; another takes its place", async () => {
  const mastery = [m("integrals-antiderivatives", 80), m("integrals-by-parts", 30)];
  const first = recommend(input({ mastery }), rules);
  const top = first[0];
  const snoozed = [{ topicId: top.topicId, signature: reasonSignature(top), until: daysAgo(-3) }];
  const later = recommend(input({ mastery, snoozed }), rules);
  assert(!find(later, short(top.topicId)) && later.length === first.length, `still there: ${later.map((i) => short(i.topicId)).join()}`);
  const expired = recommend(input({ mastery, snoozed: [{ ...snoozed[0], until: daysAgo(1) }] }), rules);
  assert(expired[0].topicId === top.topicId, "did not come back after expiring");
  // A worse estimate is a new reason: it comes back straight away.
  const worse = recommend(input({ mastery: [m("integrals-antiderivatives", 80), m("integrals-by-parts", 10)], snoozed }), rules);
  assert(find(worse, short(top.topicId)), "a new reason did not bring it back");
  // Time passing alone (days since practice) does not change the signature.
  const refresh = rankCandidates(input({ mastery: [m("conics-parabola", 80, { lastAt: daysAgo(20) })] }), rules);
  const refreshLater = rankCandidates(input({ mastery: [m("conics-parabola", 80, { lastAt: daysAgo(25) })] }), rules);
  assert(reasonSignature(find(refresh, "conics-parabola")) === reasonSignature(find(refreshLater, "conics-parabola")), "time alone changed the signature");
});

await check("quality: 300 random students — every list keeps the rules", async () => {
  // A small seeded generator so a failure can be reproduced.
  let seed = 20261017;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const problems = [];
  const kinds = new Set();
  for (let student = 0; student < 300; student++) {
    const mastery = topics.filter(() => random() < 0.4).map((topic) => m(short(topic.id), Math.floor(random() * 101), { evidence: Math.floor(random() * 10), lastAt: daysAgo(Math.floor(random() * 40)) }));
    const reviews = Array.from({ length: Math.floor(random() * 6) }, () => ({ topicId: pick(topics).id, nextReviewAt: daysAgo(Math.floor(random() * 20) - 5) }));
    const resources = Object.fromEntries(topics.map((topic) => [topic.id, { questions: random() < 0.6 ? 1 + Math.floor(random() * 4) : 0, videos: random() < 0.2 ? [{ id: "vid12345678", title: "v" }] : [], notes: random() < 0.1 ? [{ id: "n", title: "n" }] : [] }]));
    const examDate = random() < 0.5 ? new Date(NOW.getTime() + Math.floor(random() * 200 - 20) * 86_400_000).toISOString().slice(0, 10) : null;
    const base = input({ mastery, reviews, resources, examDate });
    const first = recommend(base, rules);
    const snoozed = first.length && random() < 0.5 ? [{ topicId: first[0].topicId, signature: reasonSignature(first[0]), until: daysAgo(-2) }] : [];
    const list = snoozed.length ? recommend({ ...base, snoozed }, rules) : first;
    const fail = (why) => problems.push(`student ${student}: ${why}`);
    if (JSON.stringify(recommend({ ...base, snoozed }, rules)) !== JSON.stringify(list)) fail("not deterministic");
    if (list.length > rules.limit) fail("too many");
    if (new Set(list.map((item) => item.topicId)).size !== list.length) fail("a topic twice");
    const chapters = list.map((item) => topics.find((topic) => topic.id === item.topicId).chapterId);
    if (chapters.some((c) => chapters.filter((x) => x === c).length > rules.maxPerChapter)) fail("too many from one chapter");
    list.forEach((item, index) => {
      if (!(item.score > 0 && Number.isFinite(item.score))) fail(`score ${item.score}`);
      if (index && item.score > list[index - 1].score) fail("not sorted");
      if (!item.reasons.length) fail("no reason");
      const res = resources[item.topicId];
      const due = reviews.filter((r) => r.topicId === item.topicId && Date.parse(r.nextReviewAt) <= NOW.getTime()).length;
      const a = item.action;
      if (a.type === "review" ? a.due !== due || !due : a.type === "practise" ? a.questions !== res.questions || !res.questions : a.type === "video" ? !res.videos.length : !res.notes.length) fail(`bad action ${a.type}`);
      if (item.kind === "next") {
        const known = new Map(mastery.map((x) => [x.topicId, x]));
        if (known.get(item.topicId)?.evidence) fail("'next' for a topic already practised");
        if (prerequisitesOf(item.topicId, links).some((p) => p.distance === 1 && needsWork(known.get(p.topicId)?.label ?? "unknown"))) fail("'next' before its prerequisites");
      }
      if (snoozed.some((sn) => sn.topicId === item.topicId && sn.signature === reasonSignature(item))) fail("a set-aside suggestion came back unchanged");
    });
    for (const item of list) kinds.add(item.kind);
  }
  assert(!problems.length, `${problems.length} problems; first: ${problems.slice(0, 3).join(" | ")}`);
  assert(kinds.size === Object.keys(rules.weights).length, `only these kinds came up: ${[...kinds]}`);
});

finish();
