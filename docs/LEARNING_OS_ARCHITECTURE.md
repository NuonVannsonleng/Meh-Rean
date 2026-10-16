# AI Learning OS — architecture and audit

Phase 0 audit of the repository (2026-10-16) and the plan for System 1.
General architecture: [ARCHITECTURE.md](ARCHITECTURE.md).

## What exists today (verified in the code and tests)

| Feature | State | Where |
| --- | --- | --- |
| Lecture notes | Working: posts with title, body, attachments, a free-text `subject` and `level`, tags. **Not linked to the curriculum.** | `posts`; `src/pages/` feed, post, new note |
| Curriculum | Grade 12 Science Mathematics only: 1 track, 1 subject, 10 chapters, 34 topics, all `provisional`. | `curriculum_*`, `src/data/curriculum/kh-grade12.json` |
| Question bank | Working, but only **12 demo questions** (3 demo papers), every one with a topic and difficulty 1–3; types multiple choice, numeric, open. Admin editor. | `questions`, `question_solutions`, `/bacii/admin/questions` |
| Past papers | Demo only (no real BacII papers yet). | `exam_papers` |
| Practice by chapter | Working; answers marked on the server for signed-in students. | `record_practice_answer`, `/bacii/practice` |
| Mock exams | Working: server timing and marking. | `exam_attempts`, `exam_answers` |
| Mistake notebook + spaced repetition | Working: wrong answers go in; reviews 1, 3, 7, 14 days. | `mistakes`, `note_answer()` |
| Per-chapter results | Working: answered / right per student and chapter. | `chapter_progress` |
| Daily question + streak | Working: weakest chapter by smoothed accuracy. | `daily_questions` |
| Study plan | Working: weekly plan from exam date, time and weak chapters; student-owned. | `study_plans` |
| Video finder | Working (AI reading + YouTube), with chapter matching, trusted channels, creator chapters, photo-to-solution, quizzes, watched marks. | `api/bacii-videos.ts`, `video_progress`, `video_quizzes` |
| Live quiz | Working (Kahoot-style). | `live_*` |
| **Flashcards** | **Do not exist.** (Only a sample post mentions them.) | — |
| Learning profile | Partly: `profiles.grade`, school; exam date and target grade live in the study plan. No track, language or session preferences. | `profiles`, `study_plans` |

Authentication: Supabase Auth; all data access through `src/services/api.ts`
(browser-only `localApi.ts` or `supabaseApi.ts`); row level security on every
table; scores and timing in database functions. AI: Gemini (default) or
Claude in `api/bacii-videos.ts`, server-only keys, a daily allowance per
student. Tests: 25 `npm run test:*` suites (database rules against a local
Supabase, pure-function units) plus Playwright scripts.

**Important:** `note_answer()` is already the single place every marked
answer passes through (practice, notebook reviews, mock exams, daily
question). The Learning OS hooks in there instead of adding a parallel path.

## Design for System 1

```
Layer 1  Content        curriculum_* (topics = concepts), questions, papers, posts (notes), videos
Layer 2  Activity       learning_events  ← note_answer(), mark_exam_attempt, video_progress, …
Layer 3  Graph          concept_links (prerequisite / related), resource_topics (video, note → topic)
Layer 4  Intelligence   topic_mastery (per student, topic); chapter_progress; mistakes (reviews)
Layer 5  Recommend      ranked actions with reasons, computed from layers 2–4
Layer 6  Experience     dashboard, concept map, journey, adaptive practice, companion, readiness
```

- **Concepts are curriculum topics.** The prompt's `learning_concepts` would
  duplicate `curriculum_topics` one-to-one today; a finer concept table is
  added only when checked concept-level content exists. Questions without a
  topic count at chapter level.
- **Relational graph.** `concept_links (from_topic, to_topic, kind,
  verification, source)` and `resource_topics (resource_type, resource_id,
  topic_id, kind)`; traversal with recursive SQL, depth-limited and
  cycle-safe. No graph database.
- **Events are written by the database**, never by the browser: the functions
  that already mark answers add an event with an idempotency key, so retries
  cannot double-count. Self-reported actions (video watched, plan item done)
  are recorded as such and never count as mastery evidence.
- **Mastery** is stored per student and topic (unknown until there is
  evidence), updated incrementally in the same transaction as the answer.
- **Recommendations** are computed on request from current data (cheap at
  this size) and not stored until there is a need (e.g. "don't repeat" history).
- **Privacy:** every student-specific table is readable only by its student;
  admins get no blanket read access to learning history.
- **AI** (Phase 8) reuses the existing provider set-up in `api/`, sends only
  the minimum context, and has a deterministic fallback.

## Blockers and limits

| Item | Effect | Needs |
| --- | --- | --- |
| Production database not updated | Every BacII and Learning OS feature fails on the live site | Owner runs `supabase/setup-all.sql` (SUPABASE.md §2) |
| 12 demo questions, 1 subject | Mastery and adaptive practice have little to work with; results are demos | Real, checked questions (admin editor) |
| Curriculum and prerequisites are provisional | Concept map and prerequisite suggestions must be labelled provisional | A Grade 12 teacher to check (`meh-rean-curriculum`); admins can now check links at `/bacii/admin/topic-links` |
| Khmer topic names not checked | Review flagged: "លក្ខណៈ" is vague; "សមីការលំដាប់ទី១" may need "លីនេអ៊ែរ"; "ចំណុចរបត់", "ព្រីមីទីវ" and "ផលគុណស្កាលែ" spellings to confirm | A Grade 12 teacher; not changed without one |
| No flashcards | Phase 7 integrates only the notebook until flashcards exist | Owner decision: build flashcards (new feature) or skip |
| Notes not linked to the curriculum | Notes can only be recommended once linked | 1.2 lets authors/admins link notes to topics |
