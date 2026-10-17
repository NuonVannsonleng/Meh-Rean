# AI Learning OS — progress

## Current

**All phases done** (2026-10-17), with flashcards, hardening, a smaller bundle, Continue learning on Home and demo set D. Open: a native Khmer check (docs/LEARNING_OS_RELEASE.md).

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

- **2026-10-17 — 4.1, 4.2 Ranking and signals.** Agents: learning
  intelligence (rules, tests), knowledge graph (prerequisites, study order).
  Pure functions `rankCandidates()` and `recommend()`; numbers in
  `recommendation-rules.json`. Candidates: due notebook reviews (urgency
  from how many and how overdue), weak topics ("Needs foundation",
  "Developing"; held back a little when their own prerequisites need work),
  those prerequisites ("needed for …"), topics with too few answers for an
  estimate, labelled topics not practised for 14+ days, and new topics in
  study order whose prerequisites are in place. An exam within 60 days
  boosts reviews, weak topics and prerequisites and says so. A topic
  practised today is halved unless reviews are due. One entry per topic
  (strongest kind, all reasons); ties in curriculum order; at most 2 per
  chapter, 5 in all. Nothing shown yet. Fixed while testing: a weak topic
  with due reviews was rested after practice. `npm run test:recommend`
  10/10; lint.

- **2026-10-17 — 4.3 Resources.** Agents: learning intelligence, knowledge
  graph (resource links). Each recommendation gets one action — the
  notebook when reviews are due, else practice (with the topic's question
  count), else a checked video, else a linked note — and up to one video
  and one note alongside. Only what exists is offered: questions in the
  bank, videos an admin linked, notes still linked (deleting a note removes
  its links). A topic with nothing is skipped before the list is cut, so it
  never takes a place. `npm run test:recommend` 12/12; lint.

- **2026-10-17 — 4.4 Reasons and no repeats.** Agents: learning
  intelligence, curriculum (wording; Khmer flagged), designer (copy). Every
  reason (reviews due, estimate, needed for a topic, answers still needed,
  days since practice, start here, next in order, exam soon) has an English
  and a Khmer sentence; `reasonText()` picks it. No repeats: one entry per
  topic (4.1), and "Not now" sets a suggestion aside until it expires (3
  days, from the page) unless what it is about changes — a new review due,
  a different label, another topic it is needed for — which brings it back
  at once; time passing alone does not. Tests: `npm run test:recommend`
  14/14 (both languages for every reason, wording, set-aside rules); lint.
  Blocker: the Khmer sentences are Meh Rean's own and need a native check.

- **2026-10-17 — 4.5 API, "Study next", quality tests.** Agents: backend,
  frontend, designer, performance (one light count query instead of whole
  questions), tester. `getRecommendations()` reads the profile (subjects,
  exam date, language), curriculum, links, mastery, notebook, question
  counts and linked resources through api.ts, so it works in both backends
  with no new tables; nothing is stored. New `getTopicQuestionCounts()` in
  both backends (topic ids only). BacII page: "Study next · រៀនអ្វីបន្ទាប់"
  under today's question — up to 5 suggestions, each with the Khmer and
  English topic name, its reasons in the student's chosen language, one
  main action (review / practise / video / note) and any video or note,
  "Not now" (this device, 3 days, `snoozeDays` in the rules, now version 2)
  and "Show them again"; signed-out visitors are asked to sign in; the card
  says these are rule-based suggestions, not a teacher's advice. Fixed while
  testing: online, a set-aside suggestion stayed until the reload finished
  (now hidden at once). Tests: `npm run test:recommend` 15/15, including a
  seeded run of 300 random students checking every list (limit, chapters,
  no duplicates, sorted, a valid action and reason, "next" only after its
  prerequisites, set-aside respected, deterministic, every kind seen); UI
  7/7 browser-only and online (visitor, starting point in Khmer, a due
  review first with the notebook link, Not now kept after reload and shown
  again, English reasons, topic link, 320px); mastery UI 5/5, topic page
  4/4; mastery 20/20, knowledge graph 8/8, profile 6/6, questions 21/21;
  lint, build. No database change: production needs nothing new.

- **2026-10-17 — 5.1 Adaptive selection.** Agents: learning intelligence.
  `startingDifficulty()` maps a topic's estimate onto 1–5 (0–24 → 1, …,
  100 → 5; none → 2), `nextDifficulty()` moves one step per answer within
  1–5, `pickNext()` scores candidates by topic priority (×3), closeness to
  the difficulty (×2) and freshness (×1). Only multiple-choice and numeric
  questions on the target topics; never twice in a session; answered in the
  last 3 days only when nothing else is left; ties by id. `npm run
  test:adaptive` 8/8; lint. Limit: 12 demo questions (about one per topic),
  so difficulty can rarely move to a different question yet.

- **2026-10-17 — 5.2 Modes.** Agents: learning intelligence, knowledge
  graph. `sessionPlan(mode)` gives the target topics, count and difficulty
  offset: recommended (Study next ranking, 10), quick five (same, 5), weak
  topics (labelled "Needs foundation"/"Developing", weakest first, 10),
  prerequisite review (those topics' prerequisites that need work, nearest
  first, 8), mixed (one topic per chapter in turn, 10), exam prep (every
  topic weakest first, one step harder, 15). No mode invents topics: an
  empty plan is shown as such. `topicsForTurn()` moves to a topic asked
  less this session (all modes but weak topics). `npm run test:adaptive`
  13/13; lint.

- **2026-10-17 — 5.3, 5.4 Practice session, results, end-to-end tests.**
  Agents: frontend, designer, backend (marking path), tester. Page
  `/learning/practice` (signed in): the six modes with their question
  counts; a session shows one question at a time with "Question n of up to
  N" and "Difficulty d of 5", reusing `PracticeQuestion`. Each answer is
  marked by the backend (`record_practice_answer` online, the same rules in
  the browser-only store), the database trigger updates mastery, and only
  then does the difficulty move and "Next question" appear. Skip and Finish
  at any time; the results show the score, skips and each practised topic's
  estimate before the session and now, with Practise again / another mode /
  back. Empty plans say so (e.g. no weak topics yet). Links: BacII header
  ("Adaptive practice") and Study next ("Practise these"). Shared
  `loadStudyContext()` now feeds both Study next and sessions. Fixed while
  testing: "That was the last question" showed after finishing early.
  Tests: Playwright end to end 9/9 browser-only and online (sign-in,
  picker, empty weak mode, difficulty 2→3→2, no repeats across four
  chapters, skip, results, events and estimates written by the backend,
  practise again, quick five stops at five, Study next link, 320px); Study
  next 7/7, mastery UI 5/5; lint. Blocker: the page's Khmer title is Meh
  Rean's own wording.

- **2026-10-17 — 6.1, 6.2 Learning journey.** Agents: learning
  intelligence, knowledge graph, frontend, designer (mobile layout), tester.
  `buildJourney()` puts every topic in one state — done (Strong or
  better), next up (top 3 of the Study next ranking), in progress
  (practised), ready to start, or "builds on earlier topics" (a direct
  prerequisite needs work) — with its due reviews and the prerequisites it
  builds on; milestones (first answer, 1/5/10/20 topics practised, 1/5/10
  strong, each chapter practised, no reviews waiting) are worked out each
  time, never stored. Page `/learning/journey` (signed in; "My journey" on
  the BacII page): summary bar and counts, reviews due with Review now,
  Next up, milestones (reached ones plus the next target of each kind;
  chapters once started), and every chapter (open when something is going
  on) listing all its topics. Nothing is locked: every topic links to its
  page and to practice in every state, and the page says so. Fixed while
  testing: 20 milestones crowded a new student's page; long topic names were
  squeezed beside the chips on phones. Tests: `npm run test:journey` 6/6;
  Playwright 5/5 browser-only and online (sign-in, new student, all 34
  topics with both links, a "later" topic opens practice, done + review +
  milestones after practice, 320px); Study next 7/7; lint. No database
  change.

- **2026-10-17 — 7.1, 7.2 Revision queue and postpone.** Agents: learning
  intelligence (priorities), database (postpone function), security (date
  and ownership on the server), frontend, tester. `buildRevisionQueue()`:
  every due notebook review, priority = 1 + overdue (×2, full at 7 days) +
  repeated mistakes (×1.5, full at 3) + weak topic (×1.5 × weakness) +
  prerequisite of a weak topic (+1), × exam boost within 60 days; each with
  its reasons; reviews due in the next 7 days listed as coming up. Page
  `/learning/revision` ("Revision" on the BacII page): due reviews in that
  order, answered in place (the existing marking does the review), reason
  chips, "Not today: Tomorrow / In 3 days / In 7 days", and the week ahead.
  Database: `mistakes.postponed` (0–5) and `postpone_review(question,
  days)` — only your own entry, only 1/3/7 days, from the later of now and
  the due date, refused after 5; students still cannot update the table.
  Same rules in the browser-only store. Flashcards: not built (owner
  decision pending); the page says reviews come from the notebook. Tests:
  `npm run test:revision` 6/6 (order, reasons, exam, limit; postpone rules,
  ownership, visitor, direct update refused); Playwright 5/5 browser-only
  and online (empty, order with reasons, postpone kept and set by the
  database, a right answer clears it, 320px); mistakes 9/9, review 9/9,
  privacy 7/7, accounts 68/68; lint. Production needs setup-all.sql again.

- **2026-10-17 — 7.3 Learning history and deletion.** Agents: database,
  security (own rows only, no table writes), frontend, tester. Page
  `/learning/history` (from the learning profile): every recorded event,
  grouped by Cambodia day, with what it was (practice answer, today's
  question, mock exam answer or result, notebook review, video marks, plan
  tasks), its topic and result; older entries in steps of 200 up to 1000.
  Delete one entry, or "Delete all my learning history" (confirmed). The
  database function `delete_my_learning_events(ids)` deletes only the
  caller's events (at most 1000 ids at a time), works the touched topics'
  estimates out again and, for everything, removes every estimate; the
  table itself still cannot be written by students. Kept on purpose and
  said on the page: mistake notebook, mock exams, study plans, video marks.
  Fixed while here: online, `getLearningEvents()` capped at 200, so the
  topic page's history (and recent-answer checks in practice) could start
  part-way for busy students; now up to 1000, as asked. Security note:
  deleting events also lowers the daily practice count, which the 500 a
  day limit uses; a student can only affect their own data, so accepted.
  Tests: `npm run test:learning-history` 4/4 (no direct deletes, one entry
  and its estimate, other student's ids, visitor, 1001 ids, delete all keeps
  the notebook and other students' data); Playwright 5/5 browser-only and
  online (link, empty, entries with topic and result, delete one + reload +
  topic page, delete all, notebook kept, 320px); learning events 9/9,
  privacy 7/7, mastery 20/20, revision 6/6, mastery UI 5/5; lint.
  Production needs setup-all.sql again.

- **2026-10-17 — Production database updated to 25a33b3.** Same method
  (file checked against the commit, run in the SQL editor). Read-only
  check: `postpone_review` and `delete_my_learning_events` present,
  `mistakes.postponed` added, mastery rules version 2 active, 40 topic
  links, 0 tables without row level security, students cannot delete
  learning events directly.

- **2026-10-17 — 8.1 Study companion without AI.** Agents: learning
  intelligence, designer, frontend, tester. Built first because it is the
  fallback the AI version needs. `planSession()` fills the chosen session
  length exactly in 5-minute steps: due reviews first (3 minutes each, at
  most 40%), then the top 3 Study next topics (videos and notes 10
  minutes, practice shares the rest), a 5-minute break from 45 minutes;
  `progressFacts()` gathers what a summary says (topics practised and
  strong, the last 7 days, weakest and strongest topics, reviews due, days
  to the exam). Page `/learning/companion` ("Study companion" on BacII):
  summary, why these suggestions (the Study next reasons), and a plan with
  a length picker and "Start with the first step" (revision, practice, a
  video or a note); all in the student's language; it says it is written
  by Meh Rean's rules, no AI. Tests: `npm run test:companion` 6/6 (300
  random plans add up; review cap; order; breaks; facts; both languages);
  Playwright 4/4 browser-only and online (Khmer summary and reasons, plan
  adds up, 60 minutes with a break, a due review first and Start opens
  revision, 320px); lint. Blocker: Khmer wording is Meh Rean's own.

- **2026-10-17 — 8.2 AI study companion.** Agents: AI engineer, backend,
  database (allowance table), security (context, privacy, prompt input),
  frontend, tester. New task "companion" in the existing function (one file,
  as before): it signs the student in from their token, takes one of their
  `BACII_COMPANION_LIMIT` requests a day (default 10; table
  `companion_requests`, insert/select own only, never changed or removed),
  then reads their own profile, estimates, due reviews and last 7 days'
  answers with their own session (row level security). The browser only
  sends the Study next topics and reason codes on its page; both are checked
  against the curriculum and a fixed list, so no student-typed text reaches
  the model, and no name, email or id does. The prompt forbids inventing
  scores, dates, exam rules or content and asks for "your answers
  suggest" wording. A plan is kept only when every step is a known activity
  and topic and the steps add up to the session; otherwise the page keeps
  Meh Rean's plan and says why. Page: "Ask the AI to write this" under the
  summary, the reasons and the plan; every AI answer is labelled
  "AI-generated (model) · not checked by a teacher · may be wrong" and sits
  above Meh Rean's own version, which always stays; a note says what is
  sent. Errors (limit, not set up, AI down, browser-only) explain and fall
  back. Tests: Playwright with mock Gemini 6/6 online (label, prompt facts
  and no identifying data, sound plan kept, bad plan dropped, limit with
  rows that cannot be deleted, 320px) and 2/2 browser-only; video finder
  e2e 22/22, photo to solution 8/8, companion 4/4; lint, build. Cost: uses
  the existing Gemini key and free tier; no new provider. Production needs
  setup-all.sql again (table) and, optionally, `BACII_COMPANION_LIMIT`.

- **2026-10-17 — Production database updated to 1db7a97.** Same method.
  Read-only check: `companion_requests` present with row level security,
  students cannot delete from it, the Phase 7 functions present, 0 tables
  without row level security.

- **2026-10-17 — 9.1 Exam readiness and analytics.** Agents: learning
  intelligence (calculations), curriculum (no claims about the official
  exam), designer, frontend, tester. `buildReadiness()`: coverage (topics
  practised and with an estimate, per chapter); the average estimate now
  and as it stood 7 and 28 days ago (answers replayed up to then; needs 3
  labelled topics, change of 3+ points is up/down); mock exams (marked ones
  only; latest against the average of up to three before; needs 2);
  consistency (active days in 28, weeks with 3+ days); readiness from 20
  answers: 0.4 × share of topics with an estimate + 0.4 × average estimate
  + 0.2 × latest mock exam, missing parts sharing their weight, banded Early
  days / Building up (35) / On track (60) / Strong (80); this week against
  last week. Page `/learning/readiness` ("Exam readiness" on BacII): level
  and score with its parts and days to the exam, coverage bars by chapter,
  estimates over time, mock exam bars and trend, consistency, this week
  with last week beside it. It says it is Meh Rean's estimate from the
  student's own practice, not a prediction of a BacII result or grade, and
  that demo questions make it a rough guide. Tests: `npm run
  test:readiness` 7/7 (no data, coverage, trends replayed, exam trend and
  unfinished exams, consistency, readiness threshold and shared weights,
  weeks); Playwright 3/3 browser-only and online (not enough data
  everywhere; 24 answers give a level, parts, coverage, a 7-day trend, this
  week's 12 answers; 320px); lint. Limit: trends use the latest 1000 events.

- **2026-10-17 — 10.1 My learning dashboard.** Agents: designer (one
  place instead of eight header links), frontend, tester. Page `/learning`:
  today's focus (due reviews first, else the top Study next topic with its
  reason, else free practice; one Go button) with today's question and
  streak; Study next (top 3, main reason in the student's language);
  topics by mastery label; revision (due now, coming this week); journey
  (done of total, next up); readiness level; quick actions (adaptive
  practice, companion, topic map, notebook, mock exams, history). Every
  card has an empty state and the page a loading state; English with Khmer
  beside the titles, reasons and topic names in the chosen language. The
  BacII header now shows My learning, Topic map and My learning profile;
  journey, revision, readiness, companion and the practice picker go back
  to My learning. Tests: Playwright 5/5 browser-only and online (sign-in;
  new student focus, link and every empty state; quick-action targets; a
  due review becomes the focus and Go opens revision; 320px); journey 5/5,
  practice 9/9, revision 5/5, readiness 3/3, companion 4/4, Study next 7/7,
  each in both backends; lint. No database change. Open: whether My
  learning should replace the Home feed for students (owner decision).

- **2026-10-17 — 11.1 Release readiness.** Agents: security (isolation and
  database audit), performance (slow phone), tester (full suite), AI
  engineer (cost), documentation. Full run on a local database reset, loaded
  with the old production schema (256811f) and upgraded twice with
  `setup-all.sql`: all 34 `npm run test:*` suites pass. The accounts
  suite's realtime check failed only on the first run after a cold local
  Realtime start (a channel reports SUBSCRIBED before its feed is live); the
  test now waits 3 s after subscribing and passes on a cold start. Privacy
  audit extended to topic mastery, companion requests, and the postpone and
  delete functions: 8/8. Database audit: no table without row level
  security, every security definer function pins search_path, no student
  write access to events, estimates or rules; older messaging functions are
  visitor-callable but scoped to auth.uid() (low, left as is). Slow-phone
  run on the production build (360 px, slow 3G, CPU ×4, 600 answers): every
  page usable, no sideways scroll; fixed: My learning no longer fetches the
  event history (readiness from stored estimates, same result — new unit
  check), practice fetches only the last 30 days (`getLearningEvents(limit,
  since)` in both backends). Tests after the fixes: readiness 8/8; My
  learning 5/5, practice 9/9, readiness 3/3 in both backends. Release notes,
  checklist, AI cost review and limitations in
  docs/LEARNING_OS_RELEASE.md. No database change. Note: during the run a
  local `supabase start` printed the standard local demo keys into the
  session output (not production keys; nothing committed); later runs were
  silenced.

- **2026-10-17 — 7.4 Flashcards** (owner: "build it"). Agents: database,
  backend, frontend, security, tester. Table `flashcards`: student's own
  cards (front ≤ 500, back ≤ 2000 characters, LaTeX allowed, optional
  topic); row level security own only; column grants let students insert
  and edit only topic, front and back, so the schedule (stage 0–5, next
  review, times forgotten) is set by `review_flashcard(card, remembered)`:
  remembered when due → next after 1, 3, 7, 14 days, then learned;
  remembered early → no change; forgot → back to the start, tomorrow. New
  cards are due at once; 500 a student (trigger). Each review is a
  `flashcard_reviewed` learning event marked self-reported (in the history,
  never mastery evidence); event type and resource type checks widened.
  The same rules in `src/lib/flashcards.ts` and the browser-only store.
  Page `/learning/flashcards` (My learning quick actions; "Make a flashcard"
  on topic pages, topic chosen): form with formula preview and topic, review
  of the due cards (show answer, I remembered / I forgot, next date), list
  with status, edit and delete. Fixed while testing: two reviews in the same
  second shared one event key (now unique per review). Tests: `npm run
  test:flashcards` 7/7 (rules, database parity, no schedule writes, events
  self-reported and no estimates, privacy, 500 cap, kept when history is
  deleted); Playwright 7/7 browser-only and online; privacy 8/8 (13
  tables), history 4/4, events 9/9; My learning, history and topic page UI
  pass; lint. Production needs setup-all.sql again.

- **2026-10-17 — 7.5 Flashcards in revision.** Agents: learning
  intelligence (priorities), frontend, tester. `buildRevisionQueue()` takes
  the student's cards as a second source: due cards are ranked with the
  notebook (forgetting counts like a repeated mistake, reason "Forgot it N
  times before"), never postponed, and cards due within 7 days are listed
  as coming up. The revision page shows due cards in the same list and
  reviews them in place with `FlashcardReview`; its note now says reviews
  come from the notebook and flashcards, with a link to them. My learning's
  revision card and today's focus count due cards too. Study next, the
  journey and the companion still count notebook reviews only (cards are
  self-marked). Tests: `npm run test:revision` 7/7; Playwright revision
  6/6 (a card reviewed in place and moved to coming up), My learning 5/5,
  flashcards 7/7 in both backends; lint. No database change.

- **2026-10-17 — Production database updated to 414d2da (flashcards).**
  Same method. Read-only check: `flashcards` present with row level
  security, students cannot set review dates, `review_flashcard` present,
  the event type check allows `flashcard_reviewed`, 0 tables without row
  level security.

- **2026-10-17 — 11.2 Hardening** (owner: "finish all"). Visitors lose
  `execute` on `delete_own_account`, `edit_message`, `mark_conversation_read`,
  `my_conversations`, `react_to_message`, `send_message`,
  `unread_message_count` and `unsend_message` (signed-in users keep it). Tests:
  `npm run test:accounts` 68/68; Playwright rich chat 16/16 (text, photo,
  file, sticker, voice, typing, reaction, reply, edit, unsend, inbox,
  320px); signed-out pages (Home, BacII, map, messages, papers, a topic) load
  with no errors. The older `chat-e2e.mjs` script fails at a click that
  predates the chat redesign (not affected by this change; superseded by
  `chat-rich-e2e.mjs`).

- **2026-10-17 — 11.3 Smaller bundle.** Agents: performance, tester. A Vite
  plugin (`vite.config.ts`, `onlineOnly`) gives `api.ts` a stand-in for
  `localApi.ts` in builds with Supabase settings (the same trimmed test as
  `isSupabaseConfigured`), so the browser-only store, sample posts and demo
  papers are not shipped online; dev and browser-only builds are unchanged
  (checked: the online build has no sample data, the browser-only one does).
  `DEMO_ACCOUNT` moved to `src/data/demoAccount.ts`. React and Supabase are
  their own chunks so app deploys leave them cached. Main chunk 785 → 209
  kB (233 → 64 kB gzipped); 693 kB in all. Slow-phone run again: every page
  about 0.5 s faster on a first visit, nothing broken; My learning and Study
  next UI pass browser-only. Calls per page: about 16 (two small repeats).

- **2026-10-17 — 11.4 Continue learning on Home** (owner: "finish all").
  The Home feed stays for every student; signed-in students who have
  practised (any stored estimate) see a "Continue learning · ការសិក្សារបស់ខ្ញុំ"
  card above it with topics practised and strong, opening My learning. One
  light request (stored estimates); nothing for anyone else. Playwright My
  learning test extended: 7/7 browser-only and online (no card before
  practice; card after one answer opens My learning).

- **2026-10-17 — 11.5 Demo practice set D** (owner: "finish all"). Agents:
  curriculum (demo only, never presented as official), tester. 25 new demo
  questions, one automatically marked question (18 numeric, 7 multiple
  choice) for every topic that had none, difficulty 1–3, 4
  points each, as "Demo practice set D (not the real 2022 exam)" with the
  same demo labels and source as A–C. Every answer was checked by
  computation (limits near the point, finite-difference derivatives,
  numeric integrals, complex arithmetic, exact probabilities) and every
  formula (198) rendered with KaTeX without error before writing. Now 37
  demo questions, 34 markable, covering all 34 topics. Tests: papers 8/8,
  questions 21/21, exams 12/12, daily 8/8, mistakes 9/9, curriculum 11/11,
  events 9/9, privacy 8/8, mastery 20/20, knowledge graph 8/8; Playwright
  practice, papers (4 demo papers), exam, topic, Study next, journey, My
  learning, revision, readiness, companion, mistakes, daily and map pass in
  both backends. The Khmer wording of the questions is Meh Rean's own, like
  sets A–C.

- **2026-10-17 — Production database updated to f9de1c0.** Same method.
  Read-only check: 37 demo questions in 4 demo papers, all 34 topics with a
  marked question, visitors cannot call `send_message` (students can),
  flashcards present, 0 tables without row level security.

## Report format (per task)

Phase · Task · Agents involved · Summary · Files · Database changes · Tests
run / passed / failed · Security findings · Blockers · Next task.
