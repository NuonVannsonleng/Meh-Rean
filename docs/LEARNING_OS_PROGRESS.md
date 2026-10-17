# AI Learning OS — progress

## Current

**Phase 4 — 4.1 Recommendation ranking rules** (next up).

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

- **2026-10-16 — 2.2 Topic page.** Agents: frontend, designer, knowledge
  graph, tester. `/learning/topics/:topicId`: chapter and topic (Khmer
  first, English), provisional label; "You and this topic" (status badge
  from first-try results, "an estimate, not a grade", direct prerequisites
  worth checking first, Practise with the topic filter, Find a video
  prefilled); needed before (all depths, "n steps back"), opens up,
  related; checked videos and linked notes. Shared `TopicStatusBadge`.
  Practice shows "About this topic" when a topic is chosen; note topic chips
  open the topic page. Fixed while testing: a 150 px overflow at 320 px
  (grid without explicit shrinkable columns). Tests: UI 4/4 browser-only
  and online; topic-link UI 3/3 ×2; practice 5/5.

- **2026-10-16 — 2.3 Concept map.** Agents: frontend, designer, knowledge
  graph, performance (SVG, no library), tester. `mapLayout()` places topics
  in columns by prerequisite level and rows by study order (tested: no
  overlaps, every arrow points right). `/learning/map`: inline SVG with
  curved "needed before" arrows and dashed "related" lines; nodes coloured
  by status (signed in), focusable, tap/Enter selects and highlights the
  prerequisite chain and next steps, with a card to open the topic; list
  view by chapter with each topic's direct needs and status — the default
  under 768 px and the accessible alternative; choice remembered. Links
  from the BacII page; the topic page now returns to the map. Tests:
  `npm run test:knowledge-graph` 8/8; UI 4/4 browser-only and online;
  topic page 4/4.

- **2026-10-16 — 2.4 Link management and curriculum review.** Agents:
  knowledge graph, curriculum (review), frontend, tester. Admin page
  `/bacii/admin/topic-links` (linked from the BacII admin tools): add a
  prerequisite or related link (the database and the browser-only store
  both refuse loops, self links and duplicates), check a link (status and
  source; "verified" needs a source), remove. In browser-only mode, admin
  edits replace the seeded list. Curriculum review of the draft: 7 links
  dropped or turned into "related" (e.g. dot product is not needed for the
  cross product; integration by parts needs antiderivatives, not definite
  integrals), 11 added; 40 links, 30 prerequisite, still provisional.
  Topic "Properties" renamed "Properties of exponentials and logarithms"
  (English only). The links seed now follows the file for untouched draft
  links (adds, updates the source, removes dropped ones) and never touches
  links an admin added or checked. Tests: `npm run test:concept-links` 7/7
  (new: seed rerun keeps admins' work), knowledge graph 8/8; UI links 4/4,
  map 4/4, topic 4/4 in both backends; all DB suites green; lint, build.
  Blocker: the review's Khmer term notes need a Grade 12 teacher (see the
  architecture doc's blockers); none were changed.

- **2026-10-16 — 3.1 Mastery algorithm.** Agents: learning intelligence
  (design, tests), curriculum (labels are product labels). Pure functions in
  `src/lib/mastery.ts`; every number in `src/data/learning/mastery-rules.json`
  with a version. Score 0–100 per topic, bounded step towards 100 (right) or
  0 (wrong), step 1/(n+2) within 0.1–0.6 and weighted by difficulty; first
  attempt per question per Cambodia day; reviews and exams count, videos and
  self-reported marks do not; confidence from evidence and time since the
  last answer; labels with "unknown". Nothing stored or shown yet (3.2–3.5).
  Tests: `npm run test:mastery` 11/11 (first attempt, right, wrong, bounds,
  difficulty, recency, labels, confidence, duplicates, order); lint.

- **2026-10-16 — Production database updated (owner's request).** Ran the
  tested `supabase/setup-all.sql` from d017313 in the Supabase SQL editor
  (content checked against the commit first). Read-only check afterwards:
  34 topics, 40 topic links, 12 demo questions, 3 papers, 11/11 new tables,
  0 tables without row level security; the one account is an admin. The
  live topic map loads from it.

- **2026-10-16 — 3.2, 3.3 Stored mastery estimates.** Agents: database
  (tables, trigger), learning intelligence (parity), security (write
  paths), tester. Tables `mastery_rules` (versioned, seeded from
  `mastery-rules.json` by `npm run build:mastery-seed`; one active) and
  `topic_mastery` (score, evidence, right, last answer, version; select own
  only, no client writes). `refresh_topic_mastery(user, topic)` replays the
  topic's evidence with the same rules as `src/lib/mastery.ts`; a trigger
  runs it on each marked answer event (insert, or practice's fill-in
  update); `refresh_all_topic_mastery()` backfills after a version change
  and for older answers (the seed runs it). Exam answer events now carry
  the question's difficulty (database and browser-only store).
  `getTopicMastery()` in both backends: stored state + confidence/label
  for today. Tests: `npm run test:mastery` 17/17 (rules match, practice,
  retry and repeated request, exam difficulty, privacy and no writes, new
  version and back); learning events 9/9, privacy 7/7, profile 6/6, exams
  12/12, mistakes 9/9, daily 8/8; accounts 68/68 (one earlier run had one
  failure that did not repeat in two reruns: flaky, noted); lint.
  Production needs `setup-all.sql` run again for this.

- **2026-10-17 — 3.4 Deterministic tests.** Agents: learning intelligence,
  tester. `masteryHistory()` (the estimate after each answer, for "how it
  changed"). New checks: five answer sequences with estimates worked by
  hand from the rules (any change to the numbers or the update fails them),
  history steps end at the estimate, notebook reviews count in the database,
  an answer with no topic gives no estimate. Case list now: no evidence,
  first attempt, right, wrong, bounds, difficulty, recency, repeats and
  repeated requests, duplicates and order, labels, confidence, history,
  stored = app, privacy, version change. `npm run test:mastery` 20/20.

- **2026-10-17 — 3.5 Mastery in the UI.** Agents: frontend, designer
  (one vocabulary, colours from the theme tokens, phone layout), learning
  intelligence (labelling rule), tester. `MasteryBadge` (six labels incl.
  "Not enough answers yet") and `MasteryMeter`: label, "63 / 100", a bar
  (faded at low confidence), confidence, answers and right, last practised,
  and the last 12 steps of how the estimate changed (bars with screen-reader
  text). Topic page "You and this topic" uses it; the map's colours, legend
  and node names, the topic chips and "Worth checking first" use the
  mastery labels instead of the four older statuses (removed:
  `TopicStatusBadge`, its copy). Learning profile: "Your topics", weakest
  first, each opening its topic. Every place says it is an estimate from
  the student's own answers, not a grade or an official result. Rules
  version 2 adds `labelAfter: 3` (one or two answers give no label);
  re-running the seed moved stored estimates to version 2. History is drawn
  from the student's events and hidden if there are too many to read whole.
  `missingPrerequisites()` now takes the "needs work" rule. Tests: new UI
  test 5/5 browser-only and online (label, score, meter, confidence, exact
  history, profile list, map legend, 320px); topic page 4/4 and map 4/4
  ×2; `npm run test:mastery` 20/20, knowledge graph 8/8; lint, build.

- **2026-10-17 — Production database updated to ea913c7.** Same method as
  before (file checked against the commit, run in the SQL editor). Read-only
  check: mastery rules version 2 active, mastery trigger present, 40 topic
  links, 0 tables without row level security, students cannot insert
  estimates; no answers on production yet, so 0 estimates.

## Report format (per task)

Phase · Task · Agents involved · Summary · Files · Database changes · Tests
run / passed / failed · Security findings · Blockers · Next task.
