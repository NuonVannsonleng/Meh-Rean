#!/usr/bin/env node
/**
 * Checks for the learning profile (Learning OS 1.4): inferred indicators and
 * the activity summary (unit), suggestions from known data (unit), and with a
 * local Supabase the table's privacy and checks.
 *
 *   npm run test:learning-profile
 */

import { activitySummary, chapterIndicators } from "../src/lib/learningProfile.ts";
import { suggestedProfile } from "../src/lib/learningDefaults.ts";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();

await check("indicators need 3 answers, use smoothed rates, and sort strongest/weakest first (ties: more evidence first)", async () => {
  const { strengths, workOn } = chapterIndicators([
    { chapterId: "a", answered: 2, correct: 0 },
    { chapterId: "b", answered: 4, correct: 4 },
    { chapterId: "c", answered: 10, correct: 9 },
    { chapterId: "d", answered: 6, correct: 1 },
    { chapterId: "e", answered: 3, correct: 1 },
    { chapterId: "f", answered: 8, correct: 5 },
  ]);
  assert(strengths.map((i) => i.chapterId).join() === "c,b", `strengths ${strengths.map((i) => i.chapterId)}`);
  assert(workOn.map((i) => i.chapterId).join() === "d,e", `work on ${workOn.map((i) => i.chapterId)}`);
  assert(chapterIndicators([]).strengths.length === 0, "no evidence gave an indicator");
});

await check("the activity summary counts the last 7 days of answers only", async () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const at = (days) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const event = (eventType, days, data = {}) => ({ id: String(Math.random()), eventType, resourceType: null, resourceId: null, topicId: null, chapterId: null, data, createdAt: at(days) });
  const summary = activitySummary(
    [
      event("question_attempted", 0.1, { correct: true }),
      event("question_attempted", 1.2, { correct: false }),
      event("mistake_reviewed", 1.3, { correct: true }),
      event("mock_exam_completed", 2),
      event("video_marked_understood", 0.2, { self_reported: true }),
      event("question_attempted", 9, { correct: true }),
    ],
    now,
  );
  assert(summary.answers === 3 && summary.correct === 2 && summary.reviews === 1 && summary.examsCompleted === 1, JSON.stringify(summary));
  assert(summary.activeDays === 2 && summary.lastActiveAt === at(0.1), JSON.stringify(summary));
});

await check("suggestions come from the study plan, else the curriculum, and are marked unsaved", async () => {
  const subject = { id: "s1", trackId: "t1" };
  const none = suggestedProfile(null, [subject]);
  assert(none.trackId === "t1" && none.subjectIds.join() === "s1" && none.examDate === null && none.sessionMinutes === 30 && none.updatedAt === null, JSON.stringify(none));
  const plan = { subjectId: "s1", examDate: "2026-12-20", targetGrade: "B", hoursPerDay: 1.5, daysPerWeek: 5 };
  const fromPlan = suggestedProfile(plan, [subject, { id: "s2", trackId: "t2" }]);
  assert(fromPlan.examDate === "2026-12-20" && fromPlan.targetGrade === "B" && fromPlan.sessionMinutes === 90 && fromPlan.daysPerWeek === 5 && fromPlan.subjectIds.join() === "s1", JSON.stringify(fromPlan));
});

const target = localTarget();
if (!target) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test");
  finish();
}
const subjectId = "kh-grade12-science-mathematics";
if (sql(`select count(*) from public.curriculum_subjects where id = '${subjectId}'`) !== "1") {
  skip("database checks", "the curriculum is not loaded");
  finish();
}
const people = accounts(target, "profile");
const { anon } = people;
const me = await people.create("s");
const other = await people.create("o");
const inDays = (days) => sql(`select ((now() at time zone 'Asia/Phnom_Penh')::date + ${days})::text`);
const row = { user_id: me.id, track_id: "kh-grade12-science", subject_ids: [subjectId], target_grade: "B", exam_date: inDays(90), preferred_language: "en", session_minutes: 45, days_per_week: 5 };

await check("a student saves their own profile; the server sets the date", async () => {
  const { data, error } = await me.client.from("learning_profiles").upsert({ ...row, updated_at: "2000-01-01T00:00:00Z" }).select().single();
  if (error) throw new Error(error.message);
  assert(data.updated_at > "2020" && data.session_minutes === 45, JSON.stringify(data));
});

await check("profiles are private", async () => {
  assert(!(await other.client.from("learning_profiles").select("user_id").eq("user_id", me.id)).data?.length, "another student read the profile");
  assert(!(await anon.from("learning_profiles").select("user_id")).data?.length, "a visitor read profiles");
  assert((await other.client.from("learning_profiles").insert({ ...row })).error, "wrote someone else's profile");
  const changed = await other.client.from("learning_profiles").update({ target_grade: "F" }).eq("user_id", me.id).select();
  assert(!changed.data?.length, "changed someone else's profile");
});

await check("settings are checked", async () => {
  const bad = [{ exam_date: inDays(0) }, { exam_date: inDays(500) }, { target_grade: "Z" }, { session_minutes: 5 }, { days_per_week: 9 }, { preferred_language: "fr" }, { subject_ids: ["no-such-subject"] }];
  const accepted = [];
  for (const change of bad) if (!(await me.client.from("learning_profiles").upsert({ ...row, ...change })).error) accepted.push(Object.keys(change)[0]);
  assert(!accepted.length, `accepted: ${accepted.join(", ")}`);
});

await people.cleanUp();
finish();
