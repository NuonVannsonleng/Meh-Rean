// "Study next" (Learning OS 4.5): gathers the student's own data through
// api.ts — so it works in both backends — and ranks it with src/lib/recommend.ts.
// Everything is read fresh on each call; nothing about the ranking is stored.

import masteryRules from "../data/learning/mastery-rules.json";
import recommendationRules from "../data/learning/recommendation-rules.json";
import { recommend, type RecommendationInput, type RecommendationRules, type RecommendationWithAction, type TopicResources } from "../lib/recommend";
import type { CurriculumChapter, CurriculumTopic } from "../types";
import {
  getConceptLinks,
  getCurriculumChapters,
  getCurriculumSubjects,
  getLearningProfile,
  getMistakes,
  getResourceTopics,
  getTopicMastery,
  getTopicQuestionCounts,
} from "./api";

export const RECOMMENDATION_RULES = recommendationRules as RecommendationRules;

export interface StudyNext {
  items: RecommendationWithAction[];
  /** The student's chosen explanation language; reasons are shown in it. */
  language: "km" | "en";
  topics: Map<string, { topic: CurriculumTopic; chapter: CurriculumChapter }>;
}

export interface StudyContext {
  input: RecommendationInput & { resources: Record<string, TopicResources> };
  language: "km" | "en";
  /** The study session length the student chose (or was suggested). */
  sessionMinutes: number;
  subjectIds: string[];
  topics: Map<string, { topic: CurriculumTopic; chapter: CurriculumChapter }>;
}

/** Everything the rankings need, read fresh (also used by adaptive practice, 5.3). */
export async function loadStudyContext(snoozed: { topicId: string; signature: string; until: string }[] = []): Promise<StudyContext> {
  const [profile, subjects, links, mastery, mistakes, resourceLinks] = await Promise.all([
    getLearningProfile(),
    getCurriculumSubjects(),
    getConceptLinks(),
    getTopicMastery(),
    getMistakes(),
    getResourceTopics(),
  ]);
  // The student's subjects when they chose some, otherwise every subject there is.
  const chosen = subjects.filter((subject) => !profile.subjectIds.length || profile.subjectIds.includes(subject.id));
  const [chapterLists, questionLists] = await Promise.all([
    Promise.all(chosen.map((subject) => getCurriculumChapters(subject.id))),
    Promise.all(chosen.map((subject) => getTopicQuestionCounts(subject.id))),
  ]);
  const chapters = chapterLists.flat().sort((a, b) => a.subjectId.localeCompare(b.subjectId) || a.number - b.number);
  const topics = new Map(chapters.flatMap((chapter) => chapter.topics.map((topic) => [topic.id, { topic, chapter }] as const)));

  const resources: Record<string, TopicResources> = {};
  const slot = (topicId: string) => (resources[topicId] ??= { questions: 0, videos: [], notes: [] });
  for (const counts of questionLists) for (const [topicId, count] of Object.entries(counts)) slot(topicId).questions += count;
  for (const link of resourceLinks) {
    const entry = { id: link.resourceId, title: link.title };
    if (link.resourceType === "video") slot(link.topicId).videos.push(entry);
    else slot(link.topicId).notes.push(entry);
  }

  return {
    input: {
      topics: chapters.flatMap((chapter) => chapter.topics.map((topic) => ({ id: topic.id, chapterId: chapter.id }))),
      links,
      mastery,
      // Due as in the notebook (isDue in src/lib/review.ts): a review date that has passed.
      reviews: mistakes.map((mistake) => ({ topicId: mistake.question.topicId, nextReviewAt: mistake.nextReviewAt })),
      examDate: profile.examDate,
      labelAfter: masteryRules.labelAfter,
      snoozed,
      resources,
    },
    // English-only interface for now (see DECISIONS.md); the preference is kept for later.
    language: "en",
    sessionMinutes: profile.sessionMinutes,
    subjectIds: chosen.map((subject) => subject.id),
    topics,
  };
}

export async function getRecommendations(snoozed: { topicId: string; signature: string; until: string }[] = []): Promise<StudyNext> {
  const context = await loadStudyContext(snoozed);
  return { items: recommend(context.input, RECOMMENDATION_RULES), language: context.language, topics: context.topics };
}
