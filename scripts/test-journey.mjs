#!/usr/bin/env node
/**
 * Unit checks for the learning journey (Learning OS 6): src/lib/journey.ts
 * with src/data/learning/journey-rules.json, on the real curriculum and
 * topic links. No database.
 *
 *   npm run test:journey
 */

import { readFileSync } from "node:fs";
import { expandLinks } from "../src/lib/conceptGraph.ts";
import { flattenCurriculum } from "../src/lib/curriculum.ts";
import { buildJourney } from "../src/lib/journey.ts";
import { assert, reporter } from "./lib/local-supabase.mjs";

const { check, finish } = reporter();
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const rules = read("../src/data/learning/journey-rules.json");
const curriculum = flattenCurriculum(read("../src/data/curriculum/kh-grade12.json"));
const topics = curriculum.chapters.flatMap((chapter) => chapter.topics.map((topic) => ({ id: topic.id, chapterId: chapter.id })));
const links = expandLinks(read("../src/data/curriculum-links/kh-grade12-math.json"));
const T = (short) => `kh-grade12-science-mathematics-${short}`;
const NOW = new Date("2026-10-17T05:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const LABELS = [["needs-foundation", 0], ["developing", 25], ["practising", 50], ["strong", 75], ["consistently-strong", 90]];
const m = (topic, score, evidence = 5) => ({ topicId: T(topic), score, evidence, correct: 0, lastAt: daysAgo(1), confidence: 0.5, confidenceLevel: "medium", label: evidence < 3 ? "unknown" : [...LABELS].reverse().find(([, from]) => score >= from)[0], version: 2 });
const journey = (extra = {}) => buildJourney({ topics, links, mastery: [], reviews: [], recommended: [], now: NOW, ...extra }, rules);
const topicOf = (j, short) => j.chapters.flatMap((c) => c.topics).find((t) => t.topicId === T(short));

await check("every topic appears once, in curriculum order, grouped by chapter", async () => {
  const j = journey();
  const ids = j.chapters.flatMap((c) => c.topics.map((t) => t.topicId));
  assert(ids.join() === topics.map((t) => t.id).join() && j.total === topics.length, "order or count");
  assert(j.chapters.length === curriculum.chapters.length, "chapters");
});

await check("a new student: starting points are ready, the rest is for later — and says what it builds on", async () => {
  const j = journey();
  assert(topicOf(j, "limits-continuity-limits").state === "ready", "a starting point");
  const byParts = topicOf(j, "integrals-by-parts");
  assert(byParts.state === "later" && byParts.buildsOn.join() === T("integrals-antiderivatives"), JSON.stringify(byParts));
  assert(j.counts.ready + j.counts.later === topics.length && j.counts.done === 0, JSON.stringify(j.counts));
});

await check("states: strong is done, practised is in progress, Study next tops are next (at most 3, never done ones)", async () => {
  const mastery = [m("limits-continuity-limits", 85), m("limits-continuity-continuity", 40), m("derivatives-rules", 95, 8)];
  const recommended = [T("derivatives-rules"), T("conics-ellipse"), T("limits-continuity-continuity"), T("probability-counting"), T("vectors-space-dot-product")];
  const j = journey({ mastery, recommended });
  assert(topicOf(j, "limits-continuity-limits").state === "done" && topicOf(j, "derivatives-rules").state === "done", "done");
  assert(topicOf(j, "conics-ellipse").state === "next" && topicOf(j, "limits-continuity-continuity").state === "next" && topicOf(j, "probability-counting").state === "next", "next");
  assert(topicOf(j, "vectors-space-dot-product").state !== "next" && j.counts.next === rules.nextCount, `${j.counts.next} next`);
  const progress = journey({ mastery });
  assert(topicOf(progress, "limits-continuity-continuity").state === "in-progress", "in progress");
  // Once its prerequisite is done, a topic is no longer for later.
  assert(topicOf(progress, "limits-continuity-indeterminate-forms").state === "ready", topicOf(progress, "limits-continuity-indeterminate-forms").state);
});

await check("due reviews are counted per topic and in all; future ones are not", async () => {
  const reviews = [
    { topicId: T("conics-ellipse"), nextReviewAt: daysAgo(1) },
    { topicId: T("conics-ellipse"), nextReviewAt: daysAgo(3) },
    { topicId: T("integrals-area"), nextReviewAt: daysAgo(-2) },
    { topicId: null, nextReviewAt: daysAgo(1) },
  ];
  const j = journey({ reviews });
  assert(topicOf(j, "conics-ellipse").reviewsDue === 2 && topicOf(j, "integrals-area").reviewsDue === 0 && j.reviewsDue === 2, `${j.reviewsDue}`);
});

await check("milestones: first answer, topics practised and strong, a whole chapter, reviews all done", async () => {
  const none = journey();
  assert(none.milestones.every((ms) => !ms.reached), "a milestone without any answers");
  assert(!none.milestones.some((ms) => ms.kind === "no-reviews-due"), "'no reviews due' before any mistake");
  const chapter = curriculum.chapters.find((c) => c.topics.length === 4);
  const mastery = [...chapter.topics.map((t) => ({ ...m("x", 80), topicId: t.id })), m("conics-ellipse", 30, 2)];
  const j = journey({ mastery, reviews: [{ topicId: T("conics-ellipse"), nextReviewAt: daysAgo(-1) }] });
  const get = (id) => j.milestones.find((ms) => ms.id === id);
  assert(get("first-answer").reached && get("practised-5").reached && !get("practised-10").reached && get("practised-10").count === 5, JSON.stringify(get("practised-10")));
  assert(get("strong-1").reached && !get("strong-5").reached && get("strong-5").count === 4, JSON.stringify(get("strong-5")));
  assert(get(`chapter-${chapter.id}`).reached && !get(`chapter-${curriculum.chapters.find((c) => c.id !== chapter.id).id}`).reached, "chapter milestone");
  assert(get("no-reviews-due").reached, "reviews all done");
  assert(!j.milestones.some((ms) => ms.kind === "topics-practised" && ms.target > topics.length), "a target above the course size");
});

await check("never locked: every topic, whatever its state, is in the journey with its id (the page links each one)", async () => {
  const j = journey({ mastery: [m("integrals-by-parts", 5)] });
  const states = new Set(j.chapters.flatMap((c) => c.topics.map((t) => t.state)));
  assert(states.has("later") && states.has("in-progress") && j.chapters.flatMap((c) => c.topics).length === topics.length, [...states].join());
});

finish();
