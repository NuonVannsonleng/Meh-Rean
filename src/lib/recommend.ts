// What to study next (Learning OS 4.1–4.4): candidates from the student's
// due reviews, weak topics, weak prerequisites and the study order, scored by
// the weights in src/data/learning/recommendation-rules.json. Deterministic;
// every recommendation carries the reasons it was chosen.

import { prerequisitesOf, studyOrder, type ConceptLinkInput } from "./conceptGraph.ts";
import { needsWork, type MasteryLabel, type TopicMastery } from "./mastery.ts";

export type RecommendationKind = "review" | "prerequisite" | "weak" | "continue" | "refresh" | "next";

export interface RecommendationRules {
  version: number;
  limit: number;
  maxPerChapter: number;
  weights: Record<RecommendationKind, number>;
  reviewsForFullUrgency: number;
  overdueDaysForFullUrgency: number;
  refreshAfterDays: number;
  examSoonDays: number;
  examBoost: number;
  practisedTodayFactor: number;
  /** How long "Not now" sets a suggestion aside. */
  snoozeDays: number;
}

export type RecommendationReason =
  | { code: "reviews-due"; count: number; overdueDays: number }
  | { code: "weak"; label: MasteryLabel; score: number }
  | { code: "needed-for"; topicId: string }
  | { code: "few-answers"; needed: number }
  | { code: "not-practised"; days: number }
  | { code: "start-here" }
  | { code: "next-in-order" }
  | { code: "exam-soon"; days: number };

export interface Recommendation {
  topicId: string;
  kind: RecommendationKind;
  score: number;
  /** The main reason first. */
  reasons: RecommendationReason[];
}

/** What is there to learn a topic with: practice questions, checked videos, linked notes. */
export interface TopicResources {
  questions: number;
  videos: { id: string; title: string }[];
  notes: { id: string; title: string }[];
}

export type RecommendationAction =
  | { type: "review"; due: number }
  | { type: "practise"; questions: number }
  | { type: "video"; id: string; title: string }
  | { type: "note"; id: string; title: string };

export interface RecommendationWithAction extends Recommendation {
  /** The main thing to do. */
  action: RecommendationAction;
  /** A video and a note to go with it, when there are any. */
  also: RecommendationAction[];
}

export interface RecommendationInput {
  /** Topics in curriculum order, with their chapter. */
  topics: { id: string; chapterId: string }[];
  links: ConceptLinkInput[];
  mastery: TopicMastery[];
  /** Notebook entries still being reviewed. */
  reviews: { topicId: string | null; nextReviewAt: string | null }[];
  examDate: string | null;
  /** Answers before a topic gets a label (mastery rules). */
  labelAfter: number;
  /** Suggestions the student set aside ("Not now"): skipped until `until`, unless their reason changes. */
  snoozed?: { topicId: string; signature: string; until: string }[];
  now?: Date;
}

const DAY = 86_400_000;
const cambodiaDay = (time: number) => new Date(time + 7 * 3_600_000).toISOString().slice(0, 10);
const round = (value: number) => Math.round(value * 1000) / 1000;

/** Every candidate topic with its best kind and all its reasons, highest score first (not yet limited). */
export function rankCandidates(input: RecommendationInput, rules: RecommendationRules): Recommendation[] {
  const now = (input.now ?? new Date()).getTime();
  const known = new Set(input.topics.map((topic) => topic.id));
  const masteryOf = new Map(input.mastery.map((item) => [item.topicId, item]));
  const labelOf = (id: string): MasteryLabel => masteryOf.get(id)?.label ?? "unknown";
  const weakness = (id: string) => {
    const item = masteryOf.get(id);
    return item && item.label !== "unknown" && item.score !== null ? (100 - item.score) / 100 : 0.5;
  };
  const direct = (id: string) => prerequisitesOf(id, input.links).filter((item) => item.distance === 1 && known.has(item.topicId));
  const isWeak = (id: string) => labelOf(id) === "needs-foundation" || labelOf(id) === "developing";

  const examDays = input.examDate ? Math.ceil((Date.parse(`${input.examDate}T00:00:00+07:00`) - now) / DAY) : null;
  const examFactor = examDays !== null && examDays >= 0 && examDays <= rules.examSoonDays ? 1 + rules.examBoost * (1 - examDays / rules.examSoonDays) : 1;
  const examReason: RecommendationReason[] = examFactor > 1 ? [{ code: "exam-soon", days: examDays! }] : [];

  const candidates: Recommendation[] = [];
  const add = (topicId: string, kind: RecommendationKind, strength: number, reasons: RecommendationReason[]) => {
    if (strength > 0) candidates.push({ topicId, kind, score: rules.weights[kind] * strength, reasons });
  };

  // Due reviews: more and longer overdue means more urgent.
  const due = new Map<string, { count: number; oldest: number }>();
  for (const review of input.reviews) {
    if (!review.topicId || !known.has(review.topicId) || !review.nextReviewAt || Date.parse(review.nextReviewAt) > now) continue;
    const entry = due.get(review.topicId) ?? { count: 0, oldest: now };
    entry.count += 1;
    entry.oldest = Math.min(entry.oldest, Date.parse(review.nextReviewAt));
    due.set(review.topicId, entry);
  }
  for (const [topicId, { count, oldest }] of due) {
    const overdueDays = Math.floor((now - oldest) / DAY);
    const urgency = Math.min(1, count / rules.reviewsForFullUrgency) + 0.5 * Math.min(1, overdueDays / rules.overdueDaysForFullUrgency);
    add(topicId, "review", urgency * examFactor, [{ code: "reviews-due", count, overdueDays }, ...examReason]);
  }

  for (const { id } of input.topics) {
    const item = masteryOf.get(id);
    const label = labelOf(id);
    if (isWeak(id)) {
      // A weak topic whose own prerequisites need work waits for them a little.
      const before = direct(id);
      const ready = before.length ? before.filter((p) => !needsWork(labelOf(p.topicId))).length / before.length : 1;
      add(id, "weak", weakness(id) * (0.5 + 0.5 * ready) * examFactor, [{ code: "weak", label, score: item!.score! }, ...examReason]);
      for (const p of before.filter((p) => needsWork(labelOf(p.topicId)))) {
        add(p.topicId, "prerequisite", weakness(id) * (0.5 + 0.5 * weakness(p.topicId)) * examFactor, [{ code: "needed-for", topicId: id }, ...examReason]);
      }
    } else if (label === "unknown" && item && item.evidence > 0) {
      add(id, "continue", Math.min(1, item.evidence / input.labelAfter), [{ code: "few-answers", needed: Math.max(1, input.labelAfter - item.evidence) }]);
    } else if (label !== "unknown" && item?.lastAt) {
      const days = Math.floor((now - Date.parse(item.lastAt)) / DAY);
      if (days >= rules.refreshAfterDays) add(id, "refresh", Math.min(1, days / (2 * rules.refreshAfterDays)), [{ code: "not-practised", days }]);
    }
  }

  // New topics in study order whose prerequisites are in place: the first ones count most.
  const ready = studyOrder(
    input.topics.map((topic) => topic.id),
    input.links,
  ).filter((id) => !masteryOf.get(id)?.evidence && direct(id).every((p) => !needsWork(labelOf(p.topicId))));
  ready.forEach((id, index) => add(id, "next", 1 / (1 + index), [{ code: direct(id).length ? "next-in-order" : "start-here" }]));

  // One recommendation per topic: its strongest kind, with every reason (no repeats).
  const today = cambodiaDay(now);
  const byTopic = new Map<string, Recommendation>();
  for (const candidate of candidates) {
    const seen = byTopic.get(candidate.topicId);
    if (!seen) byTopic.set(candidate.topicId, { ...candidate, reasons: [...candidate.reasons] });
    else {
      const [main, other] = candidate.score > seen.score ? [candidate, seen] : [seen, candidate];
      const reasons = [...main.reasons, ...other.reasons].filter((reason, index, all) => all.findIndex((r) => JSON.stringify(r) === JSON.stringify(reason)) === index);
      byTopic.set(candidate.topicId, { ...main, score: Math.max(seen.score, candidate.score), reasons });
    }
  }
  const order = new Map(input.topics.map((topic, index) => [topic.id, index]));
  return [...byTopic.values()]
    .map((item) => {
      // Practised today: rest it, unless reviews are due.
      const lastAt = masteryOf.get(item.topicId)?.lastAt;
      const rested = !due.has(item.topicId) && lastAt && cambodiaDay(Date.parse(lastAt)) === today;
      return { ...item, score: round(rested ? item.score * rules.practisedTodayFactor : item.score) };
    })
    .sort((a, b) => b.score - a.score || order.get(a.topicId)! - order.get(b.topicId)!);
}

/**
 * What a recommendation is about, coarsely: when this changes (a new review
 * due, a different label, another topic it is needed for), a suggestion the
 * student set aside comes back early. Scores and day counts are left out so
 * that time passing alone does not bring it back.
 */
export function reasonSignature(item: Recommendation): string {
  const main = item.reasons[0];
  const detail = main.code === "reviews-due" ? main.count : main.code === "weak" ? main.label : main.code === "needed-for" ? main.topicId : "";
  return `${item.kind}:${main.code}:${detail}`;
}

/**
 * What to do for one recommendation (4.3): due reviews first, then practice
 * questions, else a checked video, else a linked note; null when the topic
 * has nothing to learn it with yet, so it is left out.
 */
export function actionFor(item: Recommendation, resources: TopicResources | undefined): { action: RecommendationAction; also: RecommendationAction[] } | null {
  const due = item.reasons.find((reason) => reason.code === "reviews-due");
  const video = resources?.videos[0];
  const note = resources?.notes[0];
  const options: RecommendationAction[] = [
    ...(due && due.code === "reviews-due" ? [{ type: "review" as const, due: due.count }] : []),
    ...(resources && resources.questions > 0 ? [{ type: "practise" as const, questions: resources.questions }] : []),
    ...(video ? [{ type: "video" as const, ...video }] : []),
    ...(note ? [{ type: "note" as const, ...note }] : []),
  ];
  if (!options.length) return null;
  const [action, ...rest] = options;
  return { action, also: rest.filter((option) => option.type === "video" || option.type === "note") };
}

/**
 * The top recommendations with something to do for each: at most `limit`, at
 * most `maxPerChapter` from one chapter so the list stays varied. Topics with
 * nothing to learn them with are skipped and do not take a place.
 */
export function recommend(input: RecommendationInput & { resources: Record<string, TopicResources> }, rules: RecommendationRules): RecommendationWithAction[] {
  const chapterOf = new Map(input.topics.map((topic) => [topic.id, topic.chapterId]));
  const perChapter = new Map<string, number>();
  const picked: RecommendationWithAction[] = [];
  const now = (input.now ?? new Date()).getTime();
  const resting = new Set((input.snoozed ?? []).filter((item) => Date.parse(item.until) > now).map((item) => `${item.topicId}|${item.signature}`));
  for (const item of rankCandidates(input, rules)) {
    if (resting.has(`${item.topicId}|${reasonSignature(item)}`)) continue;
    const chapter = chapterOf.get(item.topicId)!;
    if ((perChapter.get(chapter) ?? 0) >= rules.maxPerChapter) continue;
    const todo = actionFor(item, input.resources[item.topicId]);
    if (!todo) continue;
    perChapter.set(chapter, (perChapter.get(chapter) ?? 0) + 1);
    picked.push({ ...item, ...todo });
    if (picked.length >= rules.limit) break;
  }
  return picked;
}
