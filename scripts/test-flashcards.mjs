#!/usr/bin/env node
/**
 * Checks for flashcards (Learning OS 7.4): the review rules in
 * src/lib/flashcards.ts (unit), and with a local Supabase that
 * review_flashcard() applies the same rules, that students write content but
 * never the schedule, and that cards stay private.
 *
 *   npm run test:flashcards
 */

import { afterFlashcardReview, FLASHCARD_INTERVAL_DAYS, FLASHCARD_LEARNED } from "../src/lib/flashcards.ts";
import { accounts, assert, localTarget, reporter, sql } from "./lib/local-supabase.mjs";

const { check, skip, finish } = reporter();
const NOW = new Date("2026-10-17T05:00:00Z");
const DAY = 86_400_000;
const fresh = { reviewStage: 0, nextReviewAt: NOW.toISOString(), timesForgotten: 0 };

await check("remembered when due moves a stage on: 1, 3, 7, 14 days, then learned", async () => {
  let card = fresh;
  let now = NOW;
  const gaps = [];
  for (let i = 0; i < FLASHCARD_LEARNED; i++) {
    card = afterFlashcardReview(card, true, now);
    if (card.nextReviewAt) {
      gaps.push((Date.parse(card.nextReviewAt) - now.getTime()) / DAY);
      now = new Date(Date.parse(card.nextReviewAt));
    }
  }
  assert(gaps.join() === FLASHCARD_INTERVAL_DAYS.join() && card.reviewStage === FLASHCARD_LEARNED && card.nextReviewAt === null, `${gaps} stage ${card.reviewStage}`);
});

await check("remembered early changes nothing; forgot starts again tomorrow and is counted", async () => {
  const later = { reviewStage: 2, nextReviewAt: new Date(NOW.getTime() + 2 * DAY).toISOString(), timesForgotten: 1 };
  assert(afterFlashcardReview(later, true, NOW) === later, "an early review moved it");
  const forgot = afterFlashcardReview(later, false, NOW);
  assert(forgot.reviewStage === 0 && Date.parse(forgot.nextReviewAt) - NOW.getTime() === DAY && forgot.timesForgotten === 2, JSON.stringify(forgot));
  const learned = { reviewStage: 5, nextReviewAt: null, timesForgotten: 0 };
  assert(afterFlashcardReview(learned, true, NOW) === learned && afterFlashcardReview(learned, false, NOW).reviewStage === 0, "learned cards");
});

const target = localTarget();
if (!target) {
  skip("database checks", "no local Supabase in SUPABASE_URL or .env.test (never run against a hosted project)");
  finish();
}
if (sql("select count(*) from pg_proc where proname = 'review_flashcard'") !== "1") {
  skip("database checks", "run supabase/setup-all.sql first");
  finish();
}
const TOPIC = "kh-grade12-science-mathematics-integrals-by-parts";
const people = accounts(target, "cards");
const { anon } = people;
const me = await people.create("s");
const other = await people.create("o");
const card = (await me.client.from("flashcards").insert({ topic_id: TOPIC, front: "  ∫ u dv = ?  ", back: "$uv - \\int v\\,du$" }).select("*").single()).data;
const state = () => sql(`select review_stage || ':' || coalesce(extract(epoch from next_review_at)::bigint::text, 'null') || ':' || times_forgotten from public.flashcards where id = '${card.id}'`).split(":");

await check("a new card is due now, trimmed, with no schedule set by the student", async () => {
  assert(card && card.front === "∫ u dv = ?" && card.review_stage === 0 && Math.abs(Date.parse(card.next_review_at) - Date.now()) < 60_000, JSON.stringify(card));
  assert((await me.client.from("flashcards").insert({ front: "a", back: "b", review_stage: 5 })).error, "set the stage on insert");
  assert((await me.client.from("flashcards").update({ next_review_at: new Date(Date.now() + 365 * DAY).toISOString() }).eq("id", card.id)).error, "moved the date directly");
  const edited = await me.client.from("flashcards").update({ back: "$uv - \\int v\\, du$ (by parts)" }).eq("id", card.id).select("back, updated_at").single();
  assert(!edited.error && edited.data.back.endsWith("(by parts)"), edited.error?.message);
});

await check("the database reviews with the same rules: remembered → 1 day; early → unchanged; forgot → tomorrow", async () => {
  const first = await me.client.rpc("review_flashcard", { card: card.id, remembered: true });
  let [stage, next] = state();
  assert(!first.error && stage === "1" && Math.abs(Number(next) - (Date.now() / 1000 + 86400)) < 60, `${first.error?.message} ${stage} ${next}`);
  await me.client.rpc("review_flashcard", { card: card.id, remembered: true });
  assert(state()[0] === "1", "an early review moved it");
  await me.client.rpc("review_flashcard", { card: card.id, remembered: false });
  const [s2, n2, forgotten] = state();
  assert(s2 === "0" && forgotten === "1" && Math.abs(Number(n2) - (Date.now() / 1000 + 86400)) < 60, `${s2} ${n2} ${forgotten}`);
});

await check("reviews are self-reported learning events, never mastery evidence", async () => {
  const events = sql(`select count(*) || ':' || bool_and((data ->> 'self_reported')::boolean) from public.learning_events where user_id = '${me.id}' and event_type = 'flashcard_reviewed'`);
  assert(events === "2:true", events);
  assert(sql(`select count(*) from public.topic_mastery where user_id = '${me.id}'`) === "0", "a flashcard review made an estimate");
});

await check("cards are private: another student and a visitor cannot read, edit, delete or review them", async () => {
  assert(!(await other.client.from("flashcards").select("id").eq("id", card.id)).data?.length, "another student read it");
  assert(!(await anon.from("flashcards").select("id").eq("id", card.id)).data?.length, "a visitor read it");
  await other.client.from("flashcards").update({ front: "hacked" }).eq("id", card.id);
  await other.client.from("flashcards").delete().eq("id", card.id);
  assert(sql(`select front from public.flashcards where id = '${card.id}'`) === "∫ u dv = ?", "another student changed or deleted it");
  assert((await other.client.rpc("review_flashcard", { card: card.id, remembered: false })).error, "another student reviewed it");
  assert((await anon.rpc("review_flashcard", { card: card.id, remembered: true })).error, "a visitor reviewed it");
  assert((await other.client.from("flashcards").insert({ user_id: me.id, front: "x", back: "y" })).error, "wrote a card as someone else");
});

await check("at most 500 cards each; deleting learning history keeps them", async () => {
  sql(`insert into public.flashcards (user_id, front, back) select '${me.id}', 'f' || n, 'b' || n from generate_series(1, 499) n`);
  const extra = await me.client.from("flashcards").insert({ front: "one more", back: "too many" });
  assert(extra.error && /500/.test(extra.error.message), extra.error?.message ?? "a 501st card was accepted");
  await me.client.rpc("delete_my_learning_events", {});
  assert(sql(`select count(*) from public.flashcards where user_id = '${me.id}'`) === "500", "history deletion removed cards");
});

await people.cleanUp();
finish();
