// The learning journey (Learning OS 6.1): the course as the student's own
// path — what is done, in progress, next, ready and for later — with due
// reviews, prerequisites still to work on and milestones. Worked out from
// current data each time; nothing is ever locked: "later" only says what a
// topic builds on.

import { prerequisitesOf, type ConceptLinkInput } from "./conceptGraph.ts";
import { needsWork, type MasteryLabel, type TopicMastery } from "./mastery.ts";

export interface JourneyRules {
  version: number;
  /** Labels that count a topic as done. */
  doneLabels: MasteryLabel[];
  /** How many Study next topics are marked "next". */
  nextCount: number;
  /** Topics practised at which a milestone is reached. */
  topicMilestones: number[];
  /** Topics done (strong) at which a milestone is reached. */
  strongMilestones: number[];
}

export type JourneyState = "done" | "in-progress" | "next" | "ready" | "later";

export interface JourneyTopic {
  topicId: string;
  state: JourneyState;
  label: MasteryLabel;
  score: number | null;
  reviewsDue: number;
  /** Direct prerequisites that still need work (shown, never enforced). */
  buildsOn: string[];
}

export interface JourneyChapter {
  chapterId: string;
  topics: JourneyTopic[];
  practised: number;
  done: number;
}

export type Milestone =
  | { id: string; kind: "first-answer"; reached: boolean }
  | { id: string; kind: "topics-practised"; target: number; count: number; reached: boolean }
  | { id: string; kind: "topics-strong"; target: number; count: number; reached: boolean }
  | { id: string; kind: "chapter-practised"; chapterId: string; reached: boolean }
  | { id: string; kind: "no-reviews-due"; reached: boolean };

export interface Journey {
  chapters: JourneyChapter[];
  counts: Record<JourneyState, number>;
  reviewsDue: number;
  milestones: Milestone[];
  total: number;
}

export function buildJourney(
  input: {
    topics: { id: string; chapterId: string }[];
    links: ConceptLinkInput[];
    mastery: TopicMastery[];
    reviews: { topicId: string | null; nextReviewAt: string | null }[];
    /** Study next order (src/lib/recommend.ts). */
    recommended: string[];
    now?: Date;
  },
  rules: JourneyRules,
): Journey {
  const now = (input.now ?? new Date()).getTime();
  const known = new Set(input.topics.map((topic) => topic.id));
  const masteryOf = new Map(input.mastery.map((item) => [item.topicId, item]));
  const labelOf = (id: string): MasteryLabel => masteryOf.get(id)?.label ?? "unknown";
  const due = new Map<string, number>();
  for (const review of input.reviews) {
    if (review.topicId && known.has(review.topicId) && review.nextReviewAt && Date.parse(review.nextReviewAt) <= now) due.set(review.topicId, (due.get(review.topicId) ?? 0) + 1);
  }
  const next = new Set(input.recommended.filter((id) => known.has(id) && !rules.doneLabels.includes(labelOf(id))).slice(0, rules.nextCount));

  const stateOf = (id: string, buildsOn: string[]): JourneyState => {
    if (rules.doneLabels.includes(labelOf(id))) return "done";
    if (next.has(id)) return "next";
    if (masteryOf.get(id)?.evidence) return "in-progress";
    return buildsOn.length ? "later" : "ready";
  };

  const chapterIds = [...new Set(input.topics.map((topic) => topic.chapterId))];
  const chapters = chapterIds.map((chapterId) => {
    const topics = input.topics
      .filter((topic) => topic.chapterId === chapterId)
      .map((topic): JourneyTopic => {
        const buildsOn = prerequisitesOf(topic.id, input.links)
          .filter((item) => item.distance === 1 && known.has(item.topicId) && needsWork(labelOf(item.topicId)))
          .map((item) => item.topicId);
        const item = masteryOf.get(topic.id);
        return { topicId: topic.id, state: stateOf(topic.id, buildsOn), label: labelOf(topic.id), score: item && item.label !== "unknown" ? item.score : null, reviewsDue: due.get(topic.id) ?? 0, buildsOn };
      });
    return {
      chapterId,
      topics,
      practised: topics.filter((topic) => masteryOf.get(topic.topicId)?.evidence).length,
      done: topics.filter((topic) => topic.state === "done").length,
    };
  });

  const all = chapters.flatMap((chapter) => chapter.topics);
  const counts = { done: 0, "in-progress": 0, next: 0, ready: 0, later: 0 } as Record<JourneyState, number>;
  for (const topic of all) counts[topic.state] += 1;
  const practised = chapters.reduce((sum, chapter) => sum + chapter.practised, 0);
  const strong = counts.done;
  const reviewsDue = [...due.values()].reduce((sum, value) => sum + value, 0);

  const milestones: Milestone[] = [
    { id: "first-answer", kind: "first-answer", reached: practised > 0 },
    ...rules.topicMilestones.filter((target) => target <= all.length).map((target) => ({ id: `practised-${target}`, kind: "topics-practised" as const, target, count: Math.min(practised, target), reached: practised >= target })),
    ...rules.strongMilestones.filter((target) => target <= all.length).map((target) => ({ id: `strong-${target}`, kind: "topics-strong" as const, target, count: Math.min(strong, target), reached: strong >= target })),
    ...chapters.map((chapter) => ({ id: `chapter-${chapter.chapterId}`, kind: "chapter-practised" as const, chapterId: chapter.chapterId, reached: chapter.topics.length > 0 && chapter.practised === chapter.topics.length })),
    // Only once there has been something to review.
    ...(input.reviews.length ? [{ id: "no-reviews-due", kind: "no-reviews-due" as const, reached: reviewsDue === 0 }] : []),
  ];

  return { chapters, counts, reviewsDue, milestones, total: all.length };
}
