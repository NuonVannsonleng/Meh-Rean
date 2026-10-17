// The revision queue (Learning OS 7.1, 7.2): every review that is due, most
// urgent first, and what comes up in the next days. Sources: the mistake
// notebook today; flashcards would join as another `source` (owner decision,
// see the blockers). Numbers in src/data/learning/revision-rules.json.

import { prerequisitesOf, type ConceptLinkInput } from "./conceptGraph.ts";
import type { MasteryLabel, TopicMastery } from "./mastery.ts";

export interface RevisionRules {
  version: number;
  weights: { due: number; overdue: number; repeated: number; weakTopic: number; prerequisite: number };
  overdueDaysForFull: number;
  repeatsForFull: number;
  examSoonDays: number;
  examBoost: number;
  upcomingDays: number;
  postponeDays: number[];
  maxPostpones: number;
}

export type RevisionReason =
  | { code: "overdue"; days: number }
  | { code: "repeated"; times: number }
  | { code: "weak-topic"; label: MasteryLabel }
  | { code: "needed-for"; topicId: string }
  | { code: "exam-soon"; days: number };

export interface RevisionItem {
  source: "notebook";
  /** The question to review. */
  id: string;
  topicId: string | null;
  dueAt: string;
  priority: number;
  reasons: RevisionReason[];
  /** Times already put off, and whether it may be again. */
  postponed: number;
  canPostpone: boolean;
}

export interface RevisionInput {
  reviews: { questionId: string; topicId: string | null; nextReviewAt: string | null; timesWrong: number; postponed: number }[];
  mastery: TopicMastery[];
  links: ConceptLinkInput[];
  examDate: string | null;
  now?: Date;
}

const DAY = 86_400_000;
const isWeak = (label: MasteryLabel) => label === "needs-foundation" || label === "developing";

export function buildRevisionQueue(input: RevisionInput, rules: RevisionRules): { due: RevisionItem[]; upcoming: RevisionItem[] } {
  const now = (input.now ?? new Date()).getTime();
  const masteryOf = new Map(input.mastery.map((item) => [item.topicId, item]));
  const labelOf = (id: string | null): MasteryLabel => (id ? (masteryOf.get(id)?.label ?? "unknown") : "unknown");
  // Topics a weak topic is built on: a mistake there may be the root of the trouble.
  const neededFor = new Map<string, string>();
  for (const item of input.mastery) {
    if (!isWeak(item.label)) continue;
    for (const p of prerequisitesOf(item.topicId, input.links)) if (p.distance === 1 && !neededFor.has(p.topicId)) neededFor.set(p.topicId, item.topicId);
  }
  const examDays = input.examDate ? Math.ceil((Date.parse(`${input.examDate}T00:00:00+07:00`) - now) / DAY) : null;
  const examFactor = examDays !== null && examDays >= 0 && examDays <= rules.examSoonDays ? 1 + rules.examBoost * (1 - examDays / rules.examSoonDays) : 1;

  const due: RevisionItem[] = [];
  const upcoming: RevisionItem[] = [];
  for (const review of input.reviews) {
    if (!review.nextReviewAt) continue;
    const at = Date.parse(review.nextReviewAt);
    const base = { source: "notebook" as const, id: review.questionId, topicId: review.topicId, dueAt: review.nextReviewAt, postponed: review.postponed, canPostpone: review.postponed < rules.maxPostpones };
    if (at > now) {
      if (at - now <= rules.upcomingDays * DAY) upcoming.push({ ...base, priority: 0, reasons: [] });
      continue;
    }
    const overdueDays = Math.floor((now - at) / DAY);
    const reasons: RevisionReason[] = [];
    let priority = rules.weights.due;
    if (overdueDays > 0) {
      priority += rules.weights.overdue * Math.min(1, overdueDays / rules.overdueDaysForFull);
      reasons.push({ code: "overdue", days: overdueDays });
    }
    if (review.timesWrong > 1) {
      priority += rules.weights.repeated * Math.min(1, (review.timesWrong - 1) / (rules.repeatsForFull - 1));
      reasons.push({ code: "repeated", times: review.timesWrong });
    }
    const label = labelOf(review.topicId);
    if (isWeak(label)) {
      const score = masteryOf.get(review.topicId!)?.score ?? 50;
      priority += rules.weights.weakTopic * ((100 - score) / 100);
      reasons.push({ code: "weak-topic", label });
    }
    const builds = review.topicId ? neededFor.get(review.topicId) : undefined;
    if (builds) {
      priority += rules.weights.prerequisite;
      reasons.push({ code: "needed-for", topicId: builds });
    }
    if (examFactor > 1) reasons.push({ code: "exam-soon", days: examDays! });
    due.push({ ...base, priority: Math.round(priority * examFactor * 1000) / 1000, reasons });
  }
  due.sort((a, b) => b.priority - a.priority || a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
  upcoming.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id));
  return { due, upcoming };
}
