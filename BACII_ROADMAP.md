# BacII roadmap

Meh Rean's plan for Cambodian Grade 12 (BacII) students, alongside the global
note sharing it already does. A box is ticked only when the task's main
workflow works from the UI through the data layer and its checks pass
(see `docs/TESTING.md`). Progress and blockers: `docs/PROGRESS.md`.

Size: S small, M medium, L large. Pilot subject: Science-track Mathematics,
then Physics. Chapter tagging is the base for everything after Phase 1.

**Already in the app before this roadmap:** the BacII section (`/bacii`) and
its first tool, *Find a video for an exercise* (`/bacii/videos`): photo or text
→ AI reads it → official YouTube Data API search → AI ranking. Subjects with
Khmer names. Note sharing with subject and level tags.

## Phase 1 — Lay the foundation

- [x] **1.1 Map the BacII curriculum (M)** — seed Track → Subject → Chapter →
  Topic, starting with Grade 12 Science-track Mathematics, with source and
  verification status per entry. *Done when chapters load from the seed and
  can be queried by subject.*
  ✔ 2026-10-13: Grade 12 Science Mathematics, 10 chapters / 34 topics, all
  **provisional** until checked against the MoEYS textbook
  (`npm run test:curriculum` 11/11).
- [x] **1.2 Design the question schema (S)** — id, year, track, subject,
  chapter, topic, type, content, solution steps, answer, difficulty, language,
  origin, source, verification, timestamps. *Done when the migration exists
  and is typed.*
  ✔ 2026-10-13: `questions` + `question_solutions` with database-enforced
  rules, types in `src/types.ts`, mapper and marking in `src/lib/questions.ts`
  (`npm run test:questions` 16/16, security-reviewed).
- [x] **1.3 Render Khmer and maths together (S)** — KaTeX plus a Khmer font
  (Kantumruy Pro); Khmer paragraphs with inline LaTeX. *Done when mixed text
  renders correctly on a phone.*
  ✔ 2026-10-13: `MathText` component (KaTeX loaded on demand, `trust: false`)
  with the Khmer font already in the app (Noto Sans Khmer); checked at 320px,
  375px dark and desktop, including hostile input (`npm run test:math` 17/17).
- [x] **1.4 Content entry (M)** — admin-only form to add and edit questions
  (text, LaTeX, images, track, subject, chapter, steps, answer, source,
  verification). *Done when an admin can add and edit without code.*
  ✔ 2026-10-13: `/bacii/admin/questions` (list, new, edit, delete) with live
  Khmer + maths preview; saved through `save_question` in one transaction;
  checked end to end in both backends and security-reviewed.

## Phase 2 — Ship the MVP

- [x] **2.1 Past paper bank (L)** — browse by year, track, subject; start with
  three placeholder years of Science Maths, clearly marked as demo content.
  ✔ 2026-10-13: `/bacii/papers` and `/bacii/papers/:id`; three demo papers
  (2023–2025, 12 original questions with worked solutions), labelled demo
  everywhere; official papers can only hold official questions of their
  year (`npm run test:papers` 7/7; UI 5/5 in both backends).
- [x] **2.2 Step-by-step solutions (L)** — reveal one step at a time, Khmer
  first, with maths and related videos.
  ✔ 2026-10-13: `SolutionSteps` on paper pages: one step at a time (or all),
  then the answer; status and origin shown, AI solutions warned; links to
  the video finder (prefilled) and a Khmer YouTube search. Content is Khmer
  first; interface labels turn Khmer with 5.4. UI 6/6 in both backends.
- [x] **2.3 Chapter filter (S)** — filter questions by subject, chapter, topic
  in the database.
  ✔ 2026-10-13: `/bacii/practice` (subject, chapter and topic chips with
  counts; database filtering) with practice answering and step-by-step
  solutions; `npm run test:papers` 8/8, UI 5/5 in both backends.
- [x] **2.4 Mock exam mode (M)** — timer, navigation, auto-save, auto-submit,
  scoring of objective questions on the server, results and review.
  Durations come from data; unverified ones are labelled practice settings.
  ✔ 2026-10-13: `/bacii/papers/:id/exam` and `/bacii/attempts/:id`. The
  database sets the deadline, refuses late answers, hides the paper's answer
  key from the student until hand-in and marks on hand-in or time-out.
  `npm run test:exams` 12/12; UI 8/8 in both backends; 320px checked.
- [x] **2.5 Grade estimate (S)** — configurable A–F bands: estimate, percent,
  points to the next grade. Never presented as an official result.
  ✔ 2026-10-13: bands in `src/data/grade-scale.json` (provisional, evenly
  spaced, labelled "practice estimate"); grade, percent of marked points and
  points to the next grade on the result page, letter in "Your attempts".
  `npm run test:grades` 12/12; UI 8/8 in both backends; 320px dark checked.

## Phase 3 — Bring students back daily

- [x] **3.1 Mistake notebook (M)** — wrong answers saved automatically with
  answer, correct answer, explanation and chapter; retry them.
  ✔ 2026-10-13: `/bacii/mistakes` ("To fix" / "Fixed", chapter filter, last
  answer, times wrong, retry with step-by-step solution, remove). Filled on
  the server from mock exams (wrong and blank answers) and practice
  (`record_practice_answer`); a right answer marks it fixed.
  `npm run test:mistakes` 8/8; UI 9/9 in both backends; 320px checked.
- [x] **3.2 Spaced repetition (M)** — reviews after 1, 3, 7, 14 days, adapting
  to results.
  ✔ 2026-10-13: every notebook entry has a review stage and a due date,
  set on the server (`note_answer`): wrong → review tomorrow; a right answer
  when due → next review 3, 7, 14 days out, then learned. "Due today" view
  opens first when reviews are due. `npm run test:review` 9/9,
  `npm run test:mistakes` 9/9; UI 11/11 in both backends.
- [x] **3.3 Daily question and streak (S)** — one question from the weakest
  chapter; gentle streaks.
  ✔ 2026-10-13: `/bacii/today` and a card on the BacII page. Picked once a
  day (Cambodia time) on the server from the chapter with the lowest
  smoothed accuracy (`chapter_progress`, kept for every marked answer);
  answering, right or wrong, keeps the streak; friendly copy when it breaks.
  `npm run test:daily` 8/8, `npm run test:daily-rules` 12/12; UI 7/7 in
  both backends; 320px checked.
- [x] **3.4 Study plan generator (M)** — exam date, hours a day, weak
  chapters, target grade → weekly plan, editable.
  ✔ 2026-10-13: `/bacii/plan`. The student enters the exam date (no date
  is assumed), hours, days and target; weak chapters are suggested from
  their results. Weekly plan: weak chapters first with double time, daily
  notebook review, mock exams, revision weeks; rules in
  `src/data/study-plan.json`. Every item can be ticked, resized, removed or
  added; saved to `study_plans` (own rows only). `npm run test:study-plan`
  19/19, `npm run test:study-plans` 6/6; UI 9/9 in both backends.

## Phase 4 — Upgrade the video scanner

- [x] **4.1 YouTube Data API (S)** — *already uses the official API, no
  scraping.* Remaining: cache results and show quota use.
  ✔ 2026-10-13: searches reused by the server while warm (24 h, written
  only by the server); each student's recent lookups kept on their phone, so
  the same exercise again costs no lookup and no quota; lookups left and
  the share of the daily YouTube allowance shown (`youtube_search_log`,
  `GET /api/bacii-videos`). `npm run test:video-quota` 3/3; video e2e 18/18.
- [x] **4.2 Match videos by chapter (M)** — use exercise text, subject,
  chapter, topic, language.
  ✔ 2026-10-13: the model gets Meh Rean's chapters and topics (read from
  the database, cached an hour) and places the exercise in one; unknown ids
  are dropped. The Khmer search uses the curriculum's Khmer names, ranking
  compares against the chapter/topic, and pages that know the chapter pass
  it as a hint. Results link to practising that chapter. Video e2e 20/20.
- [x] **4.3 Prefer Khmer videos (S)** — configurable trusted Khmer channels,
  English alternatives.
  ✔ 2026-10-13: admins keep a list of trusted channels
  (`/bacii/admin/channels`, table `video_channels`; starts empty). Within
  each match level, trusted channels come first, then Khmer videos; results
  are grouped "In Khmer" / "English and other languages", and students can
  put English first (kept on their phone). `npm run test:video-channels` 5/5;
  video e2e 21/21; admin UI 5/5 browser-only, 6/6 online.
- [ ] **4.4 Jump to the right minute (M)** — only where transcripts are
  legally available (see blockers).
- [ ] **4.5 Photo to solution (L)** — photo and camera, OCR for Maths and
  Physics, match against existing questions first, let students correct OCR.
- [ ] **4.6 Quiz from a video (M)** — five questions from an authorised
  transcript, labelled as generated.
- [ ] **4.7 Track watched videos (S)** — watched / understood / needs
  revision, linked to question history and mistakes.

## Phase 5 — Make it work on any phone

- [ ] **5.1 Progressive Web App (M)** — manifest exists; add a service
  worker, app-shell caching, install prompt.
- [ ] **5.2 Offline papers (M)** — save authorised papers and solutions.
- [ ] **5.3 Low-data mode (S)** — compressed images, fewer downloads, lazy
  loading, data-use hints on videos.
- [ ] **5.4 Khmer-first interface (M)** — strings into locale files, Khmer
  and English, optional Khmer numerals.
- [ ] **5.5 Telegram bot (M)** — daily question, countdown, reminders;
  opt-in and secure linking.

## Phase 6 — Subject tools

- [ ] **6.1 Formula sheets (M)** — searchable; Maths, then Physics.
- [ ] **6.2 Khmer literature essay trainer (L)** — themes, outlines,
  practice, structure feedback, teacher-reviewed examples.
- [ ] **6.3 History and Geography flashcards (M)** — plus a history timeline.
- [ ] **6.4 English drills (M)** — reading and grammar, aligned to the
  verified curriculum.
- [ ] **6.5 Biology and Chemistry diagrams (M)** — labelling quizzes, starting
  with a cell.

## Phase 7 — Grow the community

- [ ] **7.1 Discussion per question (M)** — with reporting and moderation.
- [ ] **7.2 Verified answer badges (S)** — admins approve verifiers; only they
  mark solutions reviewed.
- [ ] **7.3 Study rooms (L)** — small rooms with a shared Pomodoro timer.
- [ ] **7.4 Leaderboards (M)** — optional, weekly, by school and province,
  privacy-safe names.
- [ ] **7.5 BacII tags on notes (S)** — link notes to Grade 12 subjects and
  chapters.

## Phase 8 — Exam day and after

- [ ] **8.1 Exam-day checklist (S)** — admin-editable, from verified official
  information.
- [ ] **8.2 Official results link (S)** — admin-configurable link to MoEYS.
- [ ] **8.3 Scholarship and university guide (M)** — with sources and
  verification dates.
- [ ] **8.4 Major and career quiz (M)** — suggestions, never definitive advice.

## Later (needs approval before starting)

AI tutor and hint-only mode, AI summaries and flashcards, semantic search,
personalised recommendations; Pomodoro, focus mode, bookmarks, PDF notes;
custom mock exams and analytics; course-level organisation, translation,
copyright reporting; badges and challenges.
