# AI Learning OS — progress

## Current

**Phase 1 — 1.3 Learning events** (next up).

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

## Report format (per task)

Phase · Task · Agents involved · Summary · Files · Database changes · Tests
run / passed / failed · Security findings · Blockers · Next task.
