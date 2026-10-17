// Words for the study companion without AI (Learning OS 8.1), in English and
// Khmer. The copy lives in src/i18n/en.ts; this only picks the sentences.

import { t } from "../i18n/en.ts";
import type { PlanStep, ProgressFacts } from "./companion.ts";

const copy = t.learning.companion;

export function summaryLines(facts: ProgressFacts, language: "en" | "km", nameOf: (topicId: string) => string): string[] {
  const words = language === "km" ? copy.lineKm : copy.lineEn;
  const list = (ids: string[]) => ids.map(nameOf).join(language === "km" ? " · " : ", ");
  const lines = [facts.practised ? words.practised(facts.practised, facts.total, facts.done) : words.none];
  lines.push(facts.answers7 ? words.week(facts.answers7, Math.round((facts.correct7 / facts.answers7) * 100), facts.activeDays7) : words.quietWeek);
  if (facts.workOn.length) lines.push(words.workOn(list(facts.workOn)));
  if (facts.goingWell.length) lines.push(words.goingWell(list(facts.goingWell)));
  if (facts.reviewsDue) lines.push(words.reviews(facts.reviewsDue));
  if (facts.examDays !== null) lines.push(words.exam(facts.examDays));
  return lines;
}

export function stepText(step: PlanStep, language: "en" | "km", nameOf: (topicId: string) => string): string {
  const words = language === "km" ? copy.stepKm : copy.stepEn;
  switch (step.activity) {
    case "review":
      return words.review;
    case "break":
      return words.break;
    case "practise":
      return step.topicId ? words.practise(nameOf(step.topicId)) : words.freePractice;
    case "watch":
      return words.watch(nameOf(step.topicId!));
    case "read":
      return words.read(nameOf(step.topicId!));
  }
}
