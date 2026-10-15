# Progress

## Current

**Phase 5 — Task 5.1: Progressive Web App** (next up). Phase 4 is done.

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
- **2026-10-13 — 3.4 Study plan generator.** `src/lib/studyPlan.ts`
  (`buildStudyPlan`) with rules as data in `src/data/study-plan.json`: weeks
  from this Monday to the exam's, study days per week (fewer in the first and
  last), a 10-minute daily mistake-notebook review, a mock exam every fourth
  learning week and two a week in the revision weeks (last 1–2; all of them
  when 2 or fewer study weeks remain), chapter time weighted 2× for weak
  chapters and by target grade for the rest, weak chapters first. The exam
  date is always the student's own entry (hint: the MoEYS announcement).
  Table `study_plans` (one per student; read and write own only; the database
  checks the settings, size and that a new exam date is ahead). Page
  `/bacii/plan`: settings form (weak chapters pre-ticked from
  `chapter_progress`), weekly cards with tick, ± half hours, remove, add,
  links to practice/papers/notebook; autosaves, and saves at once when the
  page is hidden or left. `npm run test:study-plan` 19/19,
  `npm run test:study-plans` 6/6; UI 9/9 online and browser-only; 320px
  checked.
- **2026-10-13 — 4.1 Video search: cache and quota.** The video finder
  already used the official YouTube Data API. Now: a warm server instance
  reuses identical searches for 24 hours (`BACII_SEARCH_CACHE_HOURS`); it is
  in memory and written only by the server, so students cannot plant
  results (a shared database cache would need a server-only key — not added).
  Each student's last 10 lookups are kept on their phone for 7 days (photos
  only as a SHA-256 fingerprint): the same exercise shows the earlier result
  without spending a lookup or quota, with "Search again" and a "Your recent
  lookups" list. Quota: every real YouTube call is logged in
  `youtube_search_log` (with the student's session, 1–2 per row, no
  backdating); `youtube_units_today()` totals units since midnight Pacific;
  `GET /api/bacii-videos` returns lookups left and units used, shown under
  "Find videos" with a warning past 90%. `npm run test:video-quota` 3/3;
  video e2e (mock Gemini + YouTube) 18/18.
- **2026-10-13 — 4.2 Match videos by chapter.** `api/bacii-videos.ts` reads
  Meh Rean's chapters and topics from the public curriculum tables (with the
  publishable key; kept an hour per warm instance; not bundled, so admin
  edits apply) and gives them to the model, which returns `chapter_id` /
  `topic_id`. The server keeps only ids that exist and a topic only inside
  its chapter. The Khmer search is told to use the curriculum's Khmer name;
  ranking sees the chapter and topic. Practice, paper and result pages pass
  their chapter to the finder (`?chapter=`) as a hint. Results show
  "Practise chapter N: …" linking to `/bacii/practice`. Curriculum is still
  provisional, so this inherits its labels. Video e2e 20/20.
- **2026-10-13 — 4.3 Prefer Khmer videos.** Table `video_channels` (channel
  id `UC…`, name, language, subjects, note; everyone reads, admins write),
  managed at `/bacii/admin/channels` (linked for admins on the BacII page).
  The list starts empty: Meh Rean does not presume which channels are good.
  The video function reads it (publishable key, 10-minute cache), marks each
  video's language (Khmer script in the title or description) and whether
  its channel is trusted for the exercise's subject, and orders by match,
  then trusted, then Khmer. The page groups "In Khmer" and "English and other
  languages" with a "Show first" switch saved on the phone; trusted videos
  carry a badge. `npm run test:video-channels` 5/5; video e2e 21/21; admin
  UI 5/5 browser-only and 6/6 online (students refused).
- **2026-10-13 — 4.4 Jump to the right minute.** Captions are only
  downloadable by a video's owner and scraping is against YouTube's terms, so
  timing comes from chapter lists creators put in their own descriptions:
  one `videos.list` call per lookup (1 unit; cached per video for 24 h),
  parsed by `parseVideoChapters` (time-first or time-last lines, at least
  two, impossible times skipped). The ranker sees each video's chapters and
  may return `start_seconds`; the server keeps it only if it is one of the
  listed times. The list shows "Starts at 2:15: … (the video's own
  chapter)", the embedded player starts there (`start=`) and "Open on
  YouTube" adds `t=`. `npm run test:video-chapters` 8/8; video e2e 22/22.
- **2026-10-13 — 4.5 Photo to solution.** Page `/bacii/solve` (BacII hub
  entry). The video function gained two tasks sharing its AI set-up and the
  daily allowance (one lookup each): `read` (a photo → faithful transcript
  with LaTeX, Khmer kept, `unclear` notes, subject and chapter) and `solve`
  (checked text → 2–12 steps, answer, confidence, caveats). The student edits
  the transcript with a live `MathText` preview. Matching against the
  question bank happens in the browser (`src/lib/questionMatch.ts`: LaTeX
  reduced to symbols, character-trigram Dice similarity, ≥ 0.5, small
  same-chapter lift), so it also works typed, signed out and browser-only;
  matches show as practice cards with their step-by-step solutions. When
  nothing matches (or it is not the same), the student can ask for an AI
  solution — always badged "AI-generated (provider) · not checked" with a
  warning — find videos (text and chapter passed on) or practise the
  chapter. Checks: `npm run test:question-match` 8/8 (every demo question
  found when retyped, nothing for unrelated text); UI 8/8 online with mock
  Gemini (misread "1O" still matched, corrected text sent to the solver,
  KaTeX rendered), 4/4 browser-only; video e2e still 22/22. Not yet tried
  with real photos and the live Gemini key. Matching downloads the bank
  (≤ 500 questions); a server-side search will be needed when it grows.
- **2026-10-13 — 4.6 Quiz from a video.** No transcripts are fetched. An
  admin pastes one they have the right to use (the channel shared it, or it
  is their own video) and must say who allowed it; the video function's
  admin-only `quiz` task (checked with `is_admin`) asks the AI for 5
  multiple-choice questions grounded in it and returns them without storing
  anything; malformed ones are dropped. The admin edits every question,
  ticks "I have read and checked", and saves to `video_quizzes` (public
  read, admin write; `valid_video_quiz()` checks shape in the database).
  Admins can also write quizzes by hand. Students: a "Quiz" badge on result
  videos and the quiz under the player, labelled "Written by Meh Rean",
  "Drafted by AI, checked by Meh Rean" or "Drafted by AI, not checked yet",
  with the permission note. `npm run test:video-quizzes` 4/4; UI 8/8 online
  (mock AI; student cannot draft), 6/6 browser-only; video e2e 22/22.
- **2026-10-13 — 4.7 Track watched videos.** Table `video_progress` (per
  student and video: title, channel, status watched / understood /
  needs-revision, the chapter of the exercise; own rows only). Under the
  player in the video finder: "How was this video for you?" with the three
  marks; results show each video's mark. `/bacii/my-videos` (linked from the
  video finder) filters by mark and shows, per video, its chapter (to
  practice), the student's results there (`chapter_progress`) and open
  mistakes (to the notebook, filtered by chapter); marks can be changed or
  removed. The mistake notebook links to "Videos to revise". `npm run
  test:video-progress` 5/5; UI 5/5 online, 3/3 browser-only; notebook,
  quiz and video e2e regressions pass.
- **2026-10-13 — "Nothing works" on the live site: diagnosed.** Deploys
  are fine (all Vercel builds succeeded; the live bundle and `/api` are
  current). The production database was never updated: a read-only check
  with the publishable key found every BacII table and function missing.
  Added `supabase/setup-all.sql` (schema + both seeds + API reload, from
  `npm run build:setup-sql`) so it is one paste. Testing it like production
  (pre-BacII schema, then the file) found two ordering bugs that would have
  stopped the run: `video_progress` referenced the curriculum tables before
  they were created, and the question-image storage policies used
  `is_admin()` before it was defined. Both fixed; the file now runs cleanly
  on an empty project, on the old schema, and a second time, and every
  database suite passes on the upgraded database.
- **2026-10-15 — Live quiz (owner's request, outside the roadmap).**
  Kahoot-style: any signed-in user writes a quiz (`/live/quizzes/new`: 1–50
  questions, 2–4 answers, 5–120 s each), hosts it (`/live/host/:id`, a
  6-digit code and join link), and others join on their phones (`/live`,
  `/live/play/:id`). Everyone sees the same question and countdown on the
  server's clock (offset measured per phone); answers after the deadline
  (plus 1 s grace) are refused; a right answer scores 1000 − 500 × (time
  taken ÷ time allowed), added at the reveal. The host's screen reveals by
  itself when time is up or everyone has answered, then shows answer counts
  and the leaderboard; players see right/wrong, points and rank; podium at
  the end. Tables `live_quizzes` (owner only), `live_games` (host only; the
  questions with answers), `live_game_state` (what players see; answer
  hidden until the reveal), `live_players`, `live_answers` (players cannot
  read whether they were right before the reveal: column grants); all writes
  through `create_live_game`, `join_live_game`, `live_next`, `live_answer`,
  `live_reveal`, `live_finish`. Live updates over Realtime (members only via
  `is_live_member()`), with a 5-second poll as a fallback. Browser-only
  mode can write quizzes; games need the online version and say so.
  `npm run test:live` 10/10; UI 8/8 online (host + two phones), 1/1
  browser-only; 320–375 px checked.

## Blockers and things that need a person

| Item | Needed for | What is needed |
| --- | --- | --- |
| Official Grade 12 curriculum | 1.1 → verified, all later content | A Grade 12 maths teacher, or the MoEYS textbook, to check chapters, topics and Khmer terms; then set `verification: "verified"` with a `source`. |
| Production database | everything since 1.1 | **Checked 2026-10-13: production has none of the BacII tables yet** — every BacII feature fails until the owner pastes `supabase/setup-all.sql` into the Supabase SQL editor and runs it (see SUPABASE.md §2). |
| Real past papers | 2.1 | Papers and permission to publish them; until then demo entries only, clearly labelled. |
| Official exam rules (durations, grade bands, exam-day rules) | 2.4, 2.5, 8.1 | An official source; until then values are labelled practice settings. Grade bands: edit `src/data/grade-scale.json`. |
| YouTube transcripts | 4.6 content | The Data API only gives captions to a video's owner. 4.4 uses creators' description chapters; 4.6 quizzes need an admin with a transcript they may use (channels that agree to share theirs). |
| Telegram bot | 5.5 | A bot token from @BotFather (free) and owner approval. |
| Khmer interface wording | 5.4 | A Khmer speaker to review translations. |
| Real-photo reading | 4.5 quality | Try "Photo to solution" on the live site with real handwritten and printed exercises; tune the prompt from what goes wrong. |
| Trusted video channels | 4.3 useful | An admin (a teacher, ideally) to add Khmer channels they have checked at `/bacii/admin/channels`. |
| Bundle size (725 kB main file) | Phase 2+ on cheap phones | Pages already load on demand; next: load the data backend asynchronously in `api.ts`. |
