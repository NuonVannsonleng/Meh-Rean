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

- [ ] Mastery algorithm (bounded update; difficulty, recency, evidence count,
  confidence), configurable in a data file.
- [ ] Update from practice answers, mock exams and notebook reviews.
- [ ] Store estimates (`topic_mastery`) with algorithm version.
- [ ] Deterministic tests (first attempt, right, wrong, repeats, no evidence,
  difficulty, duplicates, history).
- [ ] Mastery components ("Needs foundation" … "Consistently strong", unknown state).

## Phase 4 — Recommendation engine

- [ ] Ranking rules and configurable weights.
- [ ] Weak topics, missing prerequisites, review urgency (existing reviews).
- [ ] Recommend existing questions, videos and notes; exclude unavailable ones.
- [ ] Reasons in English and Khmer; no repeats without reason.
- [ ] API and quality tests.

## Phase 5 — Adaptive practice

- [ ] Question selection for a target topic; gradual difficulty change; no repeats.
- [ ] Modes: recommended, weak topic, prerequisite review, quick five, mixed, exam prep.
- [ ] Answers marked on the server, mastery updated, results screen.
- [ ] End-to-end tests.

## Phase 6 — Learning journey

- [ ] Journey API and view: done, in progress, next, prerequisites, reviews, milestones.
- [ ] Never locks content; mobile view; tests.

## Phase 7 — Smart revision and learning memory

- [ ] Unified revision queue (mistake reviews; flashcards — see blocker).
- [ ] Priorities (overdue, repeated mistakes, weak topics, prerequisites, exam date); postpone.
- [ ] Learning history view and deletion controls.

## Phase 8 — AI study companion

- [ ] Context from the student's own data only; explanations of recommendations,
  progress summaries, session plans; deterministic fallback; usage limits; tests.

## Phase 9 — Exam readiness and analytics

- [ ] Coverage, mastery trends, mock exam trends, consistency; readiness with
  insufficient-data states; weekly summary; calculation tests.

## Phase 10 — Unified dashboard

- [ ] Personalised home: today's focus, recommendations, mastery, revision,
  journey preview, quick actions; Khmer and English; empty and loading states.

## Phase 11 — Security, performance and release readiness

- [ ] Full test suite, data-isolation audit, slow-network and phone tests,
  AI cost review, deployment checklist, known limitations.
