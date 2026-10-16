// Suggestions for a learning profile nobody has saved yet, from what Meh
// Rean already knows (the study plan, the curriculum), so students are not
// asked twice.

import type { CurriculumSubject, LearningProfile, StudyPlan } from "../types";

export function suggestedProfile(plan: StudyPlan | null, subjects: CurriculumSubject[]): LearningProfile {
  const only = subjects.length === 1 ? subjects[0] : undefined;
  const planSubject = plan ? subjects.find((subject) => subject.id === plan.subjectId) : undefined;
  const subject = planSubject ?? only;
  return {
    trackId: subject?.trackId ?? null,
    subjectIds: subject ? [subject.id] : [],
    targetGrade: plan?.targetGrade ?? null,
    examDate: plan?.examDate ?? null,
    preferredLanguage: "km",
    sessionMinutes: plan ? Math.min(240, Math.max(10, Math.round(plan.hoursPerDay * 60))) : 30,
    daysPerWeek: plan?.daysPerWeek ?? null,
    updatedAt: null,
  };
}
