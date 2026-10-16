# AI Learning OS — progress

## Current

**Phase 2 — 2.2 Topic page** (next up).

## Done

- **2026-10-16 — Phase 0: audit and agent setup.** Audited every learning
  feature (table in [LEARNING_OS_ARCHITECTURE.md](LEARNING_OS_ARCHITECTURE.md)):
  practice, mock exams, notebook with reviews, chapter results, daily
  question, study plan, video finder and live quiz work; flashcards do not
  exist; notes are not linked to the curriculum; the bank has 12 demo
  questions in one subject. Agents: the 14 `meh-rean-*` specialists cover
  most roles; added `learning-os-orchestrator`, `learning-os-intelligence`
  and `learning-os-knowledge-graph`, with the role map in `AGENTS.md`.
  Approach: topics as concepts, relational graph, events written by the
  database from `note_answer()`, incremental mastery, recommendations
  computed on request. Blockers listed in the architecture doc.

- **2026-10-16 — 1.1 Concept links.** Agents: knowledge graph (design),
  curriculum (links labelled provisional), tester. Table `concept_links`
  (from → to, prerequisite or related, verification, source; public read,
  admin write); trigger `guard_concept_link` refuses prerequisite cycles
  (recursive check), self links, unordered related pairs and "verified"
  without a source. Draft links in `src/data/curriculum-links/kh-grade12-math.json`
  → `supabase/seed/concept-links.sql` (`npm run build:links-seed`; insert
  missing only, so admin edits survive) → included in `setup-all.sql`.
  `src/lib/conceptGraph.ts`: expand, validate, cycle finder, prerequisite
  traversal. Tests: `npm run test:concept-links` 6/6 (file sound; traversal;
  public read; admin-only writes; cycle, self link, related order and
  unsourced verified refused). Blocker: links need a teacher's check.

- **2026-10-16 — 1.2 Videos and notes linked to topics.** Agents: knowledge
  graph, frontend, security (rules), tester. Table `resource_topics`
  (video or note → topic, title; public read; insert/delete by the note's
  author or an admin; videos admin-only; no in-place edits) with
  `guard_resource_topic` (YouTube id format and title for videos, note must
  exist, `added_by` from the session). API `getResourceTopics`,
  `linkResourceTopic`, `unlinkResourceTopic` in both backends. UI: "BacII
  topics" box on the note page (chips open practice for that topic; author
  or admin add/remove), admin page "Videos by topic". Fixed on the way: the
  note owner's header buttons overflowed by 3 px at 320 px. Tests:
  `npm run test:resource-topics` 3/3; UI 3/3 browser-only and online;
  edit-note regression 5/5.

- **2026-10-16 — 1.3 Learning events.** Agents: backend, database,
  learning intelligence (event shape), security, tester. Table
  `learning_events` (type, resource, topic, chapter, small `data`,
  idempotency key unique per student, schema version; own read only; no
  client writes). Internal `record_learning_event()` (not callable by
  users). Writers: `record_practice_answer` (now with an optional `request`
  id: it claims the key first, so a retry or a simultaneous duplicate
  returns the first result and adds no mistake, score or event; type
  `mistake_reviewed` when the question was in the notebook, `source` daily
  or practice), `mark_exam_attempt` (an event per marked answer and
  `mock_exam_completed`), triggers on `video_progress` and `study_plans`
  (self-reported). Browser-only store mirrors all of it; `getLearningEvents()`
  in both backends; practice cards send a request id. Tests:
  `npm run test:learning-events` 6/6; mistakes, exams, daily, study plans,
  video progress, accounts, questions suites pass; 11 UI regressions pass in
  both backends; browser-only event recording checked. Not covered:
  "chapter practice completed" needs practice sessions (Phase 5).

- **2026-10-16 — 1.4 Student learning profile.** Agents: backend,
  database, learning intelligence (indicator rules), designer, tester.
  Table `learning_profiles` (track, subjects, target grade, exam date,
  language, session minutes, days a week; own row only; trigger checks the
  exam date (within 400 days when changed) and subjects, sets
  `updated_at`). Nothing inferred is stored there: `src/lib/learningProfile.ts`
  computes chapter indicators (≥ 3 answers; smoothed rate ≥ 0.75 "going
  well", ≤ 0.5 "worth more practice") and a 7-day activity summary from the
  student's own events (self-reported ones are not answers).
  `src/lib/learningDefaults.ts` suggests settings from the study plan and
  the curriculum until the student saves. API `getLearningProfile`,
  `saveLearningProfile` in both backends. Page `/learning/profile`.
  Tests: `npm run test:learning-profile` 6/6 (rules + privacy + checks);
  UI 4/4 browser-only and online; 320px.

- **2026-10-16 — 1.5 Authorization and privacy.** Agents: security
  (review), database, backend, frontend, tester. Review found no critical
  or high issues; fixed every finding:
  - (M) Plan trigger could flood events: now one pass over ≤ 60 weeks and
    ≤ 100 newly ticked items per save, odd values skipped (never fail the
    save), chapter ids checked; ≤ 200 self-reported events per student per day.
  - (M) Practice repeats: retry key bound to the question
    (`practice:<request>:<question>`), ≤ 500 practice answers a day (54000);
    mastery (Phase 3) will count the first attempt per question per day.
  - (M) Live quiz account ids: players read a per-game `player_id`, not
    `user_id` (column grants; `live_my_player()`); `live_players` no longer
    streamed (state carries `player_count`); join attempts throttled
    (30 / 10 min; unknown codes return nothing instead of an error so they
    count); lobbies close after 6 h; finished games deleted after 30 days;
    ≤ 50 quizzes per person; code search bounded; UI says names and
    questions are visible to the game.
  - (L) Note links: ≤ 5 topics per note, no free text, authors remove only
    their own links, links deleted with the note. `learning_events`: all
    privileges revoked except select; trigger functions not executable;
    concept-link edits serialised with an advisory lock.
  New `npm run test:learning-privacy` 7/7; added checks in `test:live`
  (12), `test:learning-events` (9), `test:resource-topics` (4). Full
  suite (25) passes on a database upgraded from the pre-BacII schema with
  `setup-all.sql`; UI: live quiz 8/8, topic links 3/3 ×2, practice 5/5,
  profile 4/4.

- **2026-10-16 — 2.1 Graph queries.** Agents: knowledge graph, learning
  intelligence, tester. `src/lib/conceptGraph.ts` gains `dependentsOf`,
  `relatedTo`, `studyOrder` (prerequisites first, otherwise curriculum
  order; cycle-safe), `prerequisiteLevels` (map columns), and
  `missingPrerequisites`. Per-topic evidence: `my_topic_results()`
  (security invoker over the caller's events) and the same rule in
  `topicResultsFromEvents()` — first attempt at a question per Cambodia day
  only; `topicStatus()` reuses the profile thresholds (≥ 3 answers). API
  `getTopicResults()` in both backends. Tests: `npm run test:knowledge-graph`
  7/7 (on the real links file; SQL and TypeScript rules agree on retries;
  privacy).

## Report format (per task)

Phase · Task · Agents involved · Summary · Files · Database changes · Tests
run / passed / failed · Security findings · Blockers · Next task.
