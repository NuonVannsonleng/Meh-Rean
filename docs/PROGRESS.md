# Progress

## Current

**Phase 3 — Task 3.4: Study plan generator** (next up). Exam date, hours a
day, weak chapters and target grade → an editable weekly plan.

Rules to keep: stored text only through `MathText`; question images only by
storage path; AI-derived content labelled with its origin; exam marking and
timing only in database functions, never in the browser.

## Done

- **2026-10-13 — Setup:** `AGENTS.md`, 14 specialist agents in
  `.claude/agents/meh-rean-*.md`, `BACII_ROADMAP.md`, these docs and an
  architecture audit (`docs/ARCHITECTURE.md`).
- **2026-10-13 — 1.1 Map the BacII curriculum.** Grade 12 Science-track
  Mathematics: 10 chapters, 34 topics, in Khmer and English, all marked
  provisional. Tables `curriculum_*` with RLS (read: everyone; write: admins);
  seed `supabase/seed/curriculum.sql`; `getCurriculumSubjects()` and
  `getCurriculumChapters()` in both backends. `npm run test:curriculum`:
  11/11.
- **2026-10-13 — 1.2 Design the question schema.** Tables `questions` and
  `question_solutions` (answer, steps, marking key, own origin and
  verification). The database sets the subject from the chapter, checks
  topics, choices, images (https only), sizes, past-paper year and source,
  "no verified without a source", stamps creator and verifier from the
  session, drops "verified" when content is edited, blocks type changes once
  a solution exists, and blocks moving chapters or topics that have
  questions. Admin-only writes. Types and mapper: `src/types.ts`,
  `src/lib/questions.ts` (with `isCorrect`). `npm run test:questions`: 16/16.
  Reviewed by `meh-rean-security`: no way for non-admins to write; 8 lower
  findings, 7 fixed (see `docs/DECISIONS.md` for the one accepted).
- **2026-10-13 — 1.3 Render Khmer and maths together.** `src/components/MathText.tsx`
  renders Khmer or English text with `$…$`, `$$…$$`, `\(…\)`, `\[…\]`;
  KaTeX 0.19 downloads only on pages with maths (`trust: false`, limits,
  theme error colour), wide formulas scroll in their own box, Khmer gets
  `lang="km"` and a taller line height. Splitter `src/lib/mathText.ts`
  (`npm run test:math` 17/17). Browser check of the dev page `/dev/math`
  (development builds only) at 320px, 375px dark and desktop: Noto Sans
  Khmer loaded, 19 formulas with MathML, no page overflow, hostile input
  creates no links, images or scripts, and no alerts.
- **2026-10-13 — 1.4 Content entry.** Admin pages `/bacii/admin/questions`
  (list with subject/chapter filters; new; edit; delete), linked from the
  BacII page for admins only and downloaded only by them. The editor covers
  chapter, topic, year, difficulty, language, type, text with live
  Khmer + maths preview, images with descriptions, choices with the correct
  one, numeric answer and tolerance, final answer, ordered steps, and origin,
  source and status for question and solution; problems are shown per field
  and re-checked as the admin types. Saved by `save_question` (one
  transaction, admin-only, all guards apply); images stored by path only, in
  an admin's own folder, raster files only (storage policies). Works in the
  browser-only demo with the same rules (`checkQuestionInput`). Checks:
  `npm run test:questions` 21/21; UI end to end 10/10 online and 9/9
  browser-only; 320px phone layout. Security review: no critical or high
  issues; both low findings fixed. Also fixed: the six-tab bottom bar wrapped
  "Messages" at 320px.
- **2026-10-13 — Performance: pages load on demand.** Every page but the
  home page is now its own file, downloaded when first opened. Main file
  836 kB → 669 kB (245 kB → 199 kB gzip, −19%). KaTeX (262 kB) and the admin
  pages were already separate. Still in the main file: React, Supabase's
  library and both data backends (the browser-only demo store and its sample
  data); splitting those needs `api.ts` to load its backend asynchronously.
- **2026-10-13 — 2.1 Past paper bank.** Tables `exam_papers` and
  `exam_paper_questions` (order, points; duration only trusted with a
  source). Rules: official papers need a source and hold only official
  past-paper questions of their year; demo papers are never verified;
  questions match the paper's subject; subject, year and origin cannot
  change under existing questions. Three demo papers for Science Maths
  (2023–2025 placeholders, 12 original questions written for Meh Rean with
  worked solutions), from `src/data/demo/` via
  `scripts/build-demo-seed.mjs` → `supabase/seed/demo-papers.sql`; the
  browser-only demo reads the same JSON. Pages `/bacii/papers` (track,
  subject, year filters) and `/bacii/papers/:id` (demo banner, questions
  with maths and choices, show answer). `npm run test:papers` 7/7; UI 5/5
  online and browser-only; 320px checked.
- **2026-10-13 — 2.2 Step-by-step solutions.** `src/components/SolutionSteps.tsx`:
  steps revealed one at a time ("Next step"), or all at once, then the final
  answer; shows verification and origin, with a warning on unchecked AI
  solutions. "Still stuck?" links to the video finder with the exercise and
  subject prefilled (`/bacii/videos?text=…&subject=…`) and to a Khmer YouTube
  search for the chapter (no API quota). Used on paper pages. UI 6/6 online
  and browser-only.
- **2026-10-13 — 2.3 Chapter filter.** `/bacii/practice`: subject, chapter
  and topic chips with question counts; questions filtered in the database
  (`getQuestions` with `subject_id` / `chapter_id` / `topic_id`); each
  question can be answered for instant practice feedback (multiple choice
  and numbers, `isCorrect`), with the step-by-step solution. The browser-only
  store now copies the demo questions in once, so practice and the admin
  list see them there too (a deleted one stays deleted). `npm run test:papers`
  8/8 (filter check added); UI 5/5 online and browser-only; 320px checked.
- **2026-10-13 — 2.4 Mock exam mode.** "Take as a mock exam" on each paper
  page. Time: the paper's official duration only when it has a source;
  otherwise the student picks a practice time (30–150 minutes, labelled
  "not an exam rule"). Sticky timer, question navigator, answers saved as
  you type (retrying if the network drops), warning before leaving, resume
  while time is left, automatic hand-in at zero. Tables `exam_attempts` and
  `exam_answers` (students read their own, write nothing directly);
  functions `start_exam`, `save_exam_answer`, `submit_exam` set the
  deadline, refuse late answers and mark multiple-choice and number answers
  from the answer key; worked problems are left for the student to check.
  During a running attempt the paper's solutions are hidden from that
  student everywhere (not from admins). One running attempt per paper;
  30 starts a day. Result page with score, percent, review and solutions;
  "Your attempts" on the paper page. `npm run test:exams` 12/12; UI 8/8
  online and browser-only; 320px checked.
- **2026-10-13 — 2.5 Grade estimate.** `src/lib/grades.ts` (`estimateGrade`,
  `checkGradeScale`, `formatPercent`) with the bands as data in
  `src/data/grade-scale.json`: Meh Rean's own evenly spaced A–F practice
  bands, `provisional` with no source, so every estimate says "Practice
  estimate" and "not the official BacII grading". The result page shows the
  grade, the percent of the marked points (one decimal, never rounded up),
  points to the next grade, which questions are not counted, and the bands;
  "Your attempts" shows the letter. Swapping in official bands later is a
  data change (with `verification: "verified"` and a `source`, the practice
  labels drop). `npm run test:grades` 12/12; UI 8/8 online and browser-only;
  320px dark checked.
- **2026-10-13 — 3.1 Mistake notebook.** Table `mistakes` (one row per
  student and question: last answer, source, times wrong, first/last wrong,
  fixed) — students read and remove their own; only the server writes.
  `mark_exam_attempt` adds wrong and blank exam answers and fixes earlier
  mistakes answered right; `record_practice_answer` marks a signed-in
  student's practice answer on the server (shared `answer_matches`), adds or
  fixes the entry, and refuses questions on their running mock exam. Practice
  feedback still shows at once from the answer key; the notebook update
  follows. Page `/bacii/mistakes` (BacII hub entry, link from exam results).
  Works browser-only with the same rules. `npm run test:mistakes` 8/8; UI 9/9
  online and browser-only; 320px checked.
- **2026-10-13 — 3.2 Spaced repetition.** `mistakes.review_stage` (0–4) and
  `next_review_at`, added by a re-runnable schema change (existing entries
  get their first review a day after their last mistake). One database
  function, `note_answer`, now updates the notebook for exams and practice:
  wrong → stage 0, review in 1 day; right while a review is due → next stage,
  then 3, 7, 14 days, then learned; right before it is due → fixed only.
  Same rules in `src/lib/review.ts` for the browser-only store and the page
  (a check keeps the intervals equal). Notebook: "Due today" / "To fix" /
  "Fixed", opening on due reviews; each entry shows its next review or
  "Learned". `npm run test:review` 9/9, `npm run test:mistakes` 9/9; UI 11/11
  online and browser-only.
- **2026-10-13 — 3.3 Daily question and streak.** Tables `chapter_progress`
  (answered and right per student and chapter, updated by `note_answer` for
  every marked practice or exam answer) and `daily_questions` (one per
  student and Cambodia day). `daily_question()` picks once a day: only
  automatically markable questions, never from a running mock exam, avoiding
  the last 14 days' picks, from the chapter with the lowest
  (right + 1) / (answered + 2) — untried chapters count as half right.
  `record_practice_answer` completes today's question (first answer only);
  `daily_streak()` gives the current and best run. Gentle by design: any
  answer counts, no reminders, "Welcome back" instead of a broken-streak
  warning. Same rules in `src/lib/daily.ts` for the browser-only store.
  Page `/bacii/today`; card at the top of the BacII page. `npm run test:daily`
  8/8, `npm run test:daily-rules` 12/12; UI 7/7 online and browser-only.

## Blockers and things that need a person

| Item | Needed for | What is needed |
| --- | --- | --- |
| Official Grade 12 curriculum | 1.1 → verified, all later content | A Grade 12 maths teacher, or the MoEYS textbook, to check chapters, topics and Khmer terms; then set `verification: "verified"` with a `source`. |
| Production database | 1.1–3.3 live | Owner runs `supabase/schema.sql`, then `supabase/seed/curriculum.sql`, then `supabase/seed/demo-papers.sql`, in the Supabase SQL editor. |
| Real past papers | 2.1 | Papers and permission to publish them; until then demo entries only, clearly labelled. |
| Official exam rules (durations, grade bands, exam-day rules) | 2.4, 2.5, 8.1 | An official source; until then values are labelled practice settings. Grade bands: edit `src/data/grade-scale.json`. |
| YouTube transcripts | 4.4, 4.6 | The Data API only gives captions to a video's owner; third-party timestamps and video quizzes need another lawful source or will be limited. |
| Telegram bot | 5.5 | A bot token from @BotFather (free) and owner approval. |
| Khmer interface wording | 5.4 | A Khmer speaker to review translations. |
| Bundle size (706 kB main file) | Phase 2+ on cheap phones | Pages already load on demand; next: load the data backend asynchronously in `api.ts`. |
