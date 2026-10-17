// Words for a recommendation's reasons (Learning OS 4.4), in English and Khmer.
// The copy lives in src/i18n/en.ts; this only picks the sentence.

import { t } from "../i18n/en.ts";
import type { RecommendationReason } from "./recommend.ts";

const copy = t.learning.next;

/** One reason as a sentence; `nameOf` gives a topic's name in that language. */
export function reasonText(reason: RecommendationReason, language: "en" | "km", nameOf: (topicId: string) => string): string {
  const words = language === "km" ? copy.reasonKm : copy.reasonEn;
  switch (reason.code) {
    case "reviews-due":
      return words.reviewsDue(reason.count, reason.overdueDays);
    case "weak":
      return words.weak(reason.score, t.learning.mastery.labels[reason.label]);
    case "needed-for":
      return words.neededFor(nameOf(reason.topicId));
    case "few-answers":
      return words.fewAnswers(reason.needed);
    case "not-practised":
      return words.notPractised(reason.days);
    case "start-here":
      return words.startHere;
    case "next-in-order":
      return words.nextInOrder;
    case "exam-soon":
      return words.examSoon(reason.days);
  }
}
