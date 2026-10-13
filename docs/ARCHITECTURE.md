# Architecture

Audit of Meh Rean as of October 2026, before the BacII roadmap
(`BACII_ROADMAP.md`) starts in earnest.

## Stack

| Layer | What | Where |
| --- | --- | --- |
| UI | React 19, React Router 7, TypeScript (strict), Tailwind CSS v4 | `src/` |
| Build | Vite 7 | `vite.config.ts` (also serves `api/` in dev) |
| Data | Supabase: Postgres + row level security, Auth, Storage, Realtime | `supabase/schema.sql` |
| Server | Vercel Functions (secrets live here) | `api/` |
| Hosting | Vercel, SPA rewrite in `vercel.json` | |

No unit-test framework is installed; checks are Node scripts and Playwright
runs (see `docs/TESTING.md`).

## Two backends, one API

`src/services/api.ts` exports every data function. It uses
`supabaseApi.ts` when `VITE_SUPABASE_URL` and the publishable key are set, and
`localApi.ts` (a browser-only demo store in localStorage + IndexedDB, seeded
from `src/data/mock.ts`) otherwise. Both modules export the same functions
with the same types; `api.ts` fails to type-check if they drift. New features
add to both, or say plainly that they need the online version (as the BacII
video finder does).

## Data model (Postgres)

Social: `profiles`, `posts` (notes; subject, level, school, tags,
attachments JSON, `edited_at`), `comments`, `reactions`, `ratings`, `saves`,
`follows`, `verification_requests`.
Chat: `conversations`, `conversation_members`, `messages`,
`message_reactions`, plus a private `chat` bucket and Realtime channels.
BacII: `bacii_video_lookups` (daily limit counter), curriculum tables
(`curriculum_versions → tracks → subjects → chapters → topics`), and
`questions` with one `question_solutions` row each (see below).

Rules live in the database: RLS on every table, `public.is_admin()` for admin
writes, triggers that pin ownership and dates (`guard_post_update`), and
SECURITY DEFINER functions for multi-step actions. Storage: public
`attachments` bucket for note files (type-downgraded by `safeContentType`),
private `chat` bucket with signed URLs.

## Authentication

Supabase Auth (email + password). Profiles are created by the
`handle_new_user` trigger from sign-up metadata. Admins are `profiles.is_admin`
(set in the database, never by the client). The browser remembers the signed-in
account (`meh-rean:account`) to avoid a signed-out flash on reload.

## BacII video finder (existing)

Since 4.1: in-memory search cache in `api/bacii-videos.ts`, `GET` for usage,
`youtube_search_log` + `youtube_units_today()`, and per-student recent
lookups in the browser (`src/lib/videoCache.ts`). Since 4.2: the function
reads `curriculum_chapters`/`curriculum_topics` (cached) and returns
`exercise.chapter` / `exercise.topicId`; `?chapter=` hints come from
`SolutionSteps`. Since 4.3: `video_channels` (admin page
`src/pages/admin/AdminChannels.tsx`); each returned video has `language`
and `trusted`. Since 4.4: `parseVideoChapters` + `videoChapters()` (videos.list)
give each video an optional `start` from its creator's chapter list.

`/bacii/videos` → `src/lib/bacii.ts` → `POST /api/bacii-videos`
(`api/bacii-videos.ts`):

1. Checks the Supabase session and a per-student daily limit
   (`bacii_video_lookups`, RLS: own rows, no delete).
2. An AI model reads the photo or text (Gemini by default — free tier — or
   Claude when `ANTHROPIC_API_KEY` is set) and returns subject, topic, BacII
   year and exercise when recognisable, and search queries (Khmer + English).
3. Searches the official **YouTube Data API v3** (no scraping), two queries.
4. The model ranks results: same exercise, same topic, related.

Resilience: model fallbacks (2.5-flash → 2.5-flash-lite → -latest aliases),
retries on 503, a 50 s budget inside Vercel's 60 s limit, schema fallback.
Not yet: result caching, quota monitoring, Khmer channel preference,
transcripts.

## Curriculum (roadmap 1.1)

Source of truth: `src/data/curriculum/*.json` (nested, bilingual, each entry
with `verification` and `source`). `src/lib/curriculum.ts` flattens and
checks it; the browser-only store reads it directly, and
`scripts/build-curriculum-seed.mjs` writes `supabase/seed/curriculum.sql`
(idempotent upserts, never deletes). API: `getCurriculumSubjects()`,
`getCurriculumChapters(subjectId)`. Ids are stable slugs, e.g.
`kh-grade12-science-mathematics-integrals`.

## Questions (roadmap 1.2)

`questions` (chapter, optional topic, year, type, Khmer/English content with
inline LaTeX, choices, images, difficulty, language, origin, source,
verification) and `question_solutions` (answer, marking key, steps, its own
origin and verification). Integrity rules are triggers and checks in
`schema.sql` (`guard_question`, `guard_question_solution`,
`guard_chapter_move`, `guard_topic_move`). Read: everyone; write: admins.
App types in `src/types.ts`; row types, `toQuestion()` and `isCorrect()` in
`src/lib/questions.ts`; select with `QUESTION_SELECT`.

## Rendering question text (roadmap 1.3)

`src/components/MathText.tsx` shows stored text (Khmer or English with
LaTeX). `src/lib/mathText.ts` splits it into text and maths; text is
rendered as React text, maths through KaTeX (`trust: false`), which is
loaded with its CSS only when needed. `/dev/math` (development builds only)
shows samples, including hostile ones.

## Admin question entry (roadmap 1.4)

`/bacii/admin/questions` (`src/pages/admin/`, lazy-loaded, behind
`RequireAdmin`). API: `getQuestions(filter)`, `getQuestion(id)`,
`saveQuestion(input, id)`, `deleteQuestion(id)`, `uploadQuestionImage(file)`
in both backends. Online, `saveQuestion` calls the `save_question` database
function; `checkQuestionInput()` in `src/lib/questions.ts` mirrors the
database rules for messages in the form and for the browser-only store.

## Past papers (roadmap 2.1)

`exam_papers` + `exam_paper_questions` (position, points). Demo papers live
in `src/data/demo/*.json`, built by `src/lib/papers.ts`
(`buildDemoPapers`) for the browser-only store and by
`scripts/build-demo-seed.mjs` into `supabase/seed/demo-papers.sql`. API:
`getExamPapers(filter)`, `getExamPaper(id)`. Pages: `src/pages/BaciiPapers.tsx`,
`src/pages/BaciiPaper.tsx`.

## Mock exams (roadmap 2.4)

`exam_attempts` + `exam_answers`, written only by `start_exam`,
`save_exam_answer` and `submit_exam` (security definer; marking in
`mark_exam_attempt`). API: `startExam`, `saveExamAnswer`, `submitExam`,
`getExamAttempt`, `getMyExamAttempts`; the browser-only store mirrors the same
rules. Pages: `src/pages/BaciiExam.tsx` (intro, timer, navigator, autosave)
and `src/pages/BaciiAttempt.tsx` (result and review).

Grade estimate (2.5): `src/lib/grades.ts` + `src/data/grade-scale.json`,
shown by `src/components/GradeEstimateCard.tsx`.

## Mistake notebook (roadmap 3.1)

`mistakes` (primary key user + question), written by `mark_exam_attempt` and
`record_practice_answer`. API: `recordPracticeAnswer`, `getMistakes`,
`deleteMistake`. `PracticeQuestion` records answers for signed-in students
(`onChecked`, `note` props); page `src/pages/BaciiMistakes.tsx`.
Reviews (3.2): `review_stage`, `next_review_at`, set by `note_answer`
(called by `mark_exam_attempt` and `record_practice_answer`); browser rules
in `src/lib/review.ts`.

## Daily question (roadmap 3.3)

`chapter_progress` (per student and chapter, from `note_answer`) and
`daily_questions`; functions `daily_question()` and `daily_streak()`. API:
`getDailyQuestion`, `getDailyStreak`; browser rules in `src/lib/daily.ts`.
Page `src/pages/BaciiToday.tsx`; streak card on `src/pages/Bacii.tsx`.

## Study plan (roadmap 3.4)

Builder `src/lib/studyPlan.ts` + rules `src/data/study-plan.json`; table
`study_plans` (student-owned, `guard_study_plan` trigger). API:
`getChapterProgress`, `getStudyPlan`, `saveStudyPlan`, `deleteStudyPlan`.
Page `src/pages/BaciiPlan.tsx`.

## Other parts

- Subjects: `src/lib/subjects.ts` (15 main + ~130 specific, colours).
- Schools: `public/data/schools/<country>.json` and
  `public/data/institutions.json`, built by `scripts/build-*.mjs` from
  Wikidata, OpenStreetMap and the Hipo list; logos from Wikimedia Commons
  and hand-checked official sites (`public/logos/official.json`).
- Copy: `src/i18n/en.ts` (English, with Khmer inline for subjects and BacII).

## Findings

1. ~~One 811 kB JavaScript bundle~~ Pages now load on demand (main file
   669 kB / 199 kB gzip on 2026-10-13). Next step: load only the data
   backend in use (both are bundled today).
2. **No Khmer interface yet**: all UI copy is English in `en.ts`; Khmer only
   for subjects and BacII labels. Roadmap 5.4.
3. **No unit-test runner**; logic tests are Node scripts. Adding Vitest (free,
   dev-only) would help Phases 2–3 (scoring, spaced repetition).
4. **Test scripts for the UI live outside the repo** (Playwright runs from a
   scratch folder). Committing a small e2e suite is worth doing.
5. The video finder works but has no cache: each lookup costs 200 of
   YouTube's 10,000 daily quota units.
6. A manifest exists, but no service worker (roadmap 5.1).
