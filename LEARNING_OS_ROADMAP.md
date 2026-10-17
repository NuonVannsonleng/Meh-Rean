# Meh Rean AI Learning OS — roadmap

System 1 of 6: connect the existing learning features into one system that
knows what each student has practised, estimates what they find hard, and
suggests what to study next — with reasons, and never claiming certainty.

Rules: [AGENTS.md](AGENTS.md). Architecture and audit:
[docs/LEARNING_OS_ARCHITECTURE.md](docs/LEARNING_OS_ARCHITECTURE.md).
Progress: [docs/LEARNING_OS_PROGRESS.md](docs/LEARNING_OS_PROGRESS.md).
A box is ticked only with verification evidence recorded in the progress notes.

Concepts are the curriculum **topics** (34 for Grade 12 Science Mathematics,
all `provisional`); a finer concept layer waits for checked content (see
decisions). Existing features are reused, not rebuilt.

## Phase 0 — Repository audit and agent setup

- [x] Inspect the existing application.
- [x] Read existing documentation.
- [x] Identify reusable BacII features.
- [x] Inspect database and authentication.
- [x] Inspect existing tests.
- [x] Create or update AI subagents.
- [x] Create architecture documentation.
- [x] Identify technical blockers.
- [x] Confirm the implementation approach.

**Done when:** the existing system is understood, agents are configured and the
plan is documented. ✔ 2026-10-16: see the architecture audit.

## Phase 1 — Learning data foundation

- [x] 1.1 Concept links: prerequisite and related links between topics
  (`concept_links`), provisional, admin-managed.
  ✔ 2026-10-16: 36 draft links (32 prerequisite, 4 related) from
  `src/data/curriculum-links/`, seeded as provisional; database refuses
  cycles, self links and unsourced "verified"; `getConceptLinks()` in both
  backends. `npm run test:concept-links` 6/6. (Admin editing UI: Phase 2.)
- [x] 1.2 Link videos and notes to topics (`resource_topics`); questions
  already carry `topic_id`.
  ✔ 2026-10-16: authors link their own notes (topic box on the note page),
  admins link notes and checked YouTube videos (`/bacii/admin/topic-videos`).
  `npm run test:resource-topics` 3/3; UI 3/3 in both backends; 320px.
- [x] 1.3 Learning events: `learning_events`, written by the database from
  existing flows (practice answers, mock exams, notebook reviews, daily
  question, video marks), idempotent.
  ✔ 2026-10-16: one event per action with topic and chapter; practice
  answers carry a request id so a retry counts nothing twice; video marks
  and plan ticks are self-reported. `npm run test:learning-events` 6/6;
  11 UI regressions pass; browser-only events checked.
- [x] 1.4 Student learning profile (`learning_profiles`): track, subjects,
  target grade, exam date, language, session length — reusing the study
  plan's settings, separate from inferred indicators.
  ✔ 2026-10-16: `/learning/profile` (linked from the BacII page):
  settings pre-filled from the study plan and curriculum; "what your answers
  suggest" (≥ 3 answers per chapter, labelled estimates); last 7 days.
  `npm run test:learning-profile` 6/6; UI 4/4 in both backends; 320px.
- [x] 1.5 Authorization and privacy checks across the new tables.
  ✔ 2026-10-16: security review (no critical/high); all medium and low
  findings fixed; `npm run test:learning-privacy` 7/7 (another student, an
  admin and a visitor cannot read or change a student's data in 10 tables).

**Done when:** existing activity is recorded and linked to topics without
breaking any existing feature. ✔ 2026-10-16: all 25 suites pass on a
database upgraded from the pre-BacII schema with `supabase/setup-all.sql`.

## Phase 2 — Knowledge graph

- [x] 2.1 Relationship queries and prerequisite traversal (depth-limited, cycle-safe).
  ✔ 2026-10-16: prerequisites, dependents, related, study order, levels,
  missing prerequisites (`src/lib/conceptGraph.ts`); per-topic results
  counting the first attempt per question per day (`my_topic_results()` and
  `topicResultsFromEvents()`). `npm run test:knowledge-graph` 7/7.
- [x] 2.2 Topic page: prerequisites, what it opens up, questions, videos, notes, the student's results.
  ✔ 2026-10-16: `/learning/topics/:id` (open to visitors; results when
  signed in); linked from practice ("About this topic") and note topic
  chips. UI 4/4 in both backends; 320px.
- [x] 2.3 Concept map (interactive) and a list view for low-end phones.
  ✔ 2026-10-16: `/learning/map` (linked from BacII): layered SVG map
  coloured by the student's status, tap or Enter highlights a topic's chain;
  list view by chapter (default on phones, remembered). `npm run
  test:knowledge-graph` 8/8 (layout); UI 4/4 in both backends; 320px.
- [x] 2.4 Link management for admins; relationship integrity; curriculum review of the links.
  ✔ 2026-10-16: BacII → Admin → Topic links (`/bacii/admin/topic-links`):
  add (loops, self links and duplicates refused, in both backends), check
  (verified needs a source), remove. Curriculum review: 40 links (30
  prerequisite), still provisional. Re-running the seed updates untouched
  draft links and keeps admins' work. `npm run test:concept-links` 7/7;
  UI 4/4 in both backends; 320px.

## Phase 3 — Mastery engine

- [x] 3.1 Mastery algorithm (bounded update; difficulty, recency, evidence count,
  confidence), configurable in a data file.
  ✔ 2026-10-16: `src/lib/mastery.ts` with `src/data/learning/mastery-rules.json`
  (version 1). `npm run test:mastery` 11/11.
- [x] 3.2 Update from practice answers, mock exams and notebook reviews.
- [x] 3.3 Store estimates (`topic_mastery`) with algorithm version.
  ✔ 2026-10-16: the database recomputes a topic's estimate whenever a marked
  answer event lands (`refresh_topic_mastery`), with the rules from
  `mastery_rules` (seeded from the JSON); a new version refreshes every
  estimate. Students read only their own and cannot write any.
  `getTopicMastery()` in both backends. `npm run test:mastery` 17/17
  (stored scores equal the app's to 1e-9).
- [x] 3.4 Deterministic tests (first attempt, right, wrong, repeats, no evidence,
  difficulty, duplicates, history).
  ✔ 2026-10-17: `masteryHistory()`; hand-worked sequences pinned; reviews
  and topic-less answers in the database. `npm run test:mastery` 20/20.
- [x] 3.5 Mastery components ("Needs foundation" … "Consistently strong", unknown state).
  ✔ 2026-10-17: `MasteryBadge` and `MasteryMeter` (label, score bar,
  confidence, answers, last practised, history). Topic page, map, topic
  chips and "Worth checking first" use the mastery labels (one vocabulary);
  learning profile lists "Your topics", weakest first. Rules version 2: no
  label before 3 answers. UI 5/5 in both backends; 320px.

## Phase 4 — Recommendation engine

- [x] 4.1 Ranking rules and configurable weights.
- [x] 4.2 Weak topics, missing prerequisites, review urgency (existing reviews).
  ✔ 2026-10-17: `src/lib/recommend.ts` with
  `src/data/learning/recommendation-rules.json` (version 1): due reviews,
  weak topics, their weak prerequisites, too-few-answers, refresh after 14
  days, next in study order; exam boost; rest after practising today; one
  per topic with every reason; at most 2 per chapter. `npm run
  test:recommend` 10/10.
- [x] 4.3 Recommend existing questions, videos and notes; exclude unavailable ones.
  ✔ 2026-10-17: `actionFor()`: due reviews, else practice questions, else a
  checked video, else a linked note, with a video and a note alongside;
  topics with nothing are skipped without taking a place. `npm run
  test:recommend` 12/12.
- [x] 4.4 Reasons in English and Khmer; no repeats without reason.
  ✔ 2026-10-17: `reasonText()` with copy in `src/i18n/en.ts` (Khmer to be
  checked by a native speaker); "Not now" sets a suggestion aside for 3
  days unless its reason changes (`reasonSignature()`). `npm run
  test:recommend` 14/14.
- [x] 4.5 API and quality tests.
  ✔ 2026-10-17: `getRecommendations()` (`src/services/recommendations.ts`,
  both backends through api.ts; light `getTopicQuestionCounts()`); "Study
  next" on the BacII page in the student's language with "Not now".
  `npm run test:recommend` 15/15 (incl. 300 random students); UI 7/7 in
  both backends; 320px.

## Phase 5 — Adaptive practice

- [x] 5.1 Question selection for a target topic; gradual difficulty change; no repeats.
  ✔ 2026-10-17: `src/lib/adaptive.ts` with `src/data/learning/adaptive-rules.json`:
  start from the estimate (1–5), one step per answer, topic priority, never
  twice a session, recent ones last; server-markable only. `npm run
  test:adaptive` 8/8.
- [x] 5.2 Modes: recommended, weak topic, prerequisite review, quick five, mixed, exam prep.
  ✔ 2026-10-17: `sessionPlan()` and `topicsForTurn()`; counts, difficulty
  offsets and spreading per mode in the rules (version 2). `npm run
  test:adaptive` 13/13. (Shown in the app with 5.3.)
- [x] 5.3 Answers marked on the server, mastery updated, results screen.
- [x] 5.4 End-to-end tests.
  ✔ 2026-10-17: `/learning/practice` (mode picker, one question at a time,
  difficulty shown, skip, finish, results with each topic's estimate before
  and now); answers go through `record_practice_answer` so the database
  marks them and updates mastery. Playwright 9/9 browser-only and online
  (recorded in docs/LEARNING_OS_TESTING.md).

## Phase 6 — Learning journey

- [x] 6.1 Journey API and view: done, in progress, next, prerequisites, reviews, milestones.
- [x] 6.2 Never locks content; mobile view; tests.
  ✔ 2026-10-17: `buildJourney()` (`src/lib/journey.ts`, rules in
  `journey-rules.json`) and `/learning/journey`: summary bar, reviews due,
  next up, milestones, chapters with every topic's state; every topic links
  to its page and practice whatever its state. `npm run test:journey` 6/6;
  Playwright 5/5 in both backends; 320px.

## Phase 7 — Smart revision and learning memory

- [x] 7.1 Unified revision queue (mistake reviews; flashcards — see blocker).
- [x] 7.2 Priorities (overdue, repeated mistakes, weak topics, prerequisites, exam date); postpone.
  ✔ 2026-10-17: `buildRevisionQueue()` (`src/lib/revision.ts`, rules in
  `revision-rules.json`) and `/learning/revision`; `postpone_review()` in
  the database (1/3/7 days, at most 5 times, date set by the server) and
  `postponeReview()` in both backends. `npm run test:revision` 6/6;
  Playwright 5/5 in both backends; 320px. Flashcards still need the
  owner's decision; the queue has a `source` field ready for them.
- [x] 7.4 Flashcards (owner decision 2026-10-17: build them).
  ✔ 2026-10-17: table `flashcards` (content written by the student, schedule
  only by `review_flashcard()`; 500 each), the same rules in
  `src/lib/flashcards.ts` and the browser-only store; `/learning/flashcards`
  (make with a formula preview, edit, delete, review due cards); "Make a
  flashcard" on topic pages; reviews are self-reported events, never
  mastery evidence. `npm run test:flashcards` 7/7; Playwright 7/7 in both
  backends; privacy 8/8 with flashcards.
- [ ] 7.5 Flashcards in the revision queue and on My learning.
- [x] 7.3 Learning history view and deletion controls.
  ✔ 2026-10-17: `/learning/history` (by day, newest first, up to 1000);
  delete one entry or everything through `delete_my_learning_events()`,
  which works the estimates out again; the notebook, exams, plans and video
  marks are kept. `npm run test:learning-history` 4/4; Playwright 5/5 in
  both backends; 320px.

## Phase 8 — AI study companion

- [x] 8.1 Deterministic companion (the fallback): progress summary, why the
  suggestions, session plan, from the student's own data, in English and Khmer.
  ✔ 2026-10-17: `src/lib/companion.ts` + `companionText.ts` (rules in
  `companion-rules.json`) and `/learning/companion`. `npm run
  test:companion` 6/6 (300 random plans fill their time); Playwright 4/4
  in both backends; 320px.
- [x] 8.2 AI version: context from the student's own data only (read on the
  server), explanations, summaries and plans labelled as AI and unverified;
  usage limits; falls back to 8.1; tests.
  ✔ 2026-10-17: task "companion" in `api/bacii-videos.ts`: facts read with
  the student's own session, suggestions checked against the curriculum, no
  identifying data to the model; plans kept only when sound;
  `companion_requests` and `BACII_COMPANION_LIMIT` (default 10 a day). Ask
  buttons on `/learning/companion`; every answer labelled AI-generated and
  unchecked; the rules version always stays. Playwright with mock Gemini
  6/6 online, 2/2 browser-only; video finder 22/22, photo to solution 8/8.

## Phase 9 — Exam readiness and analytics

- [x] 9.1 Coverage, mastery trends, mock exam trends, consistency; readiness with
  insufficient-data states; weekly summary; calculation tests.
  ✔ 2026-10-17: `buildReadiness()` (`src/lib/readiness.ts`, rules in
  `readiness-rules.json`) and `/learning/readiness`; a level, never a
  predicted result; each part says when there is not enough data. `npm run
  test:readiness` 7/7; Playwright 3/3 in both backends; 320px. No database
  change.

## Phase 10 — Unified dashboard

- [x] 10.1 Personalised home: today's focus, recommendations, mastery, revision,
  journey preview, quick actions; Khmer and English; empty and loading states.
  ✔ 2026-10-17: `/learning` ("My learning", from the BacII page, whose
  header is now three links): today's focus, Study next, topics by label,
  revision, journey, readiness, quick actions; the learning pages go back
  to it. Playwright 5/5 in both backends; the learning UI tests 33/33 ×2
  after the navigation change; 320px. The site's main Home feed is
  unchanged (owner decision whether My learning becomes students' home).

## Phase 11 — Security, performance and release readiness

- [x] 11.1 Full test suite, data-isolation audit, slow-network and phone tests,
  AI cost review, deployment checklist, known limitations.
  ✔ 2026-10-17: [docs/LEARNING_OS_RELEASE.md](docs/LEARNING_OS_RELEASE.md).
  All 34 suites on a database upgraded from the old production schema;
  privacy 8/8 over 12 tables and the new functions; database audit; slow-3G
  phone measurements (My learning 224 → 48 KB of API data after a fix);
  AI cost table; checklist; limitations and open owner decisions.
