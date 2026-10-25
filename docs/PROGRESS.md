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

- **2026-10-19 — Paper exam timer** (owner request; separate from the live
  quiz, which is unchanged). `/bacii/timer` ("Paper exam timer ·
  នាឡិកាប្រឡងលើក្រដាស" on the BacII page, no sign-in): choose the track and
  subject, or another length; Exam mode cannot pause (like the real exam),
  Practice mode can; a large countdown with the end time and progress,
  warnings at 30, 15 and 5 minutes left (English and Khmer, a beep and a
  vibration), "Time's up — pens down / អស់ម៉ោង — ឈប់សរសេរ" at the end, full
  screen, the screen kept on (Wake Lock, where allowed), the tab title shows
  the time. It works from the wall clock and is saved on the device, so a
  reload, a sleeping phone or a closed tab loses nothing. Afterwards an
  optional self-marked score (out of the paper's points) and the last 10
  papers, on this device only — nothing is sent anywhere, so no score is
  trusted. Paper lengths and points per track are data
  (`src/data/bacii/exam-timings.json`), **provisional**, researched from
  news reports of the Ministry's rules and past-paper headers (2017–2025,
  sources listed on the page); the Ministry's own timetable is published as
  images that could not be read, so the page tells students to check their
  year's timetable. Science: mathematics 150 min (125 points), Khmer
  literature, physics, chemistry, biology 90 (75), history (elective) and a
  foreign language 60 (50). Social science: Khmer literature 150 (125),
  mathematics, history, geography, morals-civics 90 (75), earth and
  environmental science (elective) and a foreign language 60 (50). Fixed
  while testing: "time used" counted past the end. Tests: `npm run
  test:exam-timer` 5/5 (data, countdown, no pause in exam mode, pause and
  resume, warnings once, saved state); Playwright 6/6 browser-only and
  online with a fake clock (lengths per track and sources, 2:30:00 with no
  pause, the 30-minute warning, time's up and a saved score, a reload and
  pausing with the real clock, 320px); lint. Blocker: a teacher or the
  official timetable to confirm the lengths; the Khmer title is Meh Rean's.

- **2026-10-19 — Real past papers, part 1: science-track mathematics
  2014–2025, timed on paper** (owner request). The 12 real BacII sittings
  (2014 first and second, 2015–2019, 2021–2025; there was no exam in 2020),
  81 exercises, typed by Meh Rean into `src/data/past-papers/` from copies
  shared online: the exercises only, never the copies' worked answers.
  2014–2022 were typed from one copy and checked line by line against a
  second (retyped by ជៀប គន្ធា / ជៀប គីមឈរ, github.com/HELMAB/bacii; compiled
  by ខែម ឫទ្ធី, Edu Plus, on sala.moeys.gov.kh); 2023–2025 come from the
  second copy only. Where the copies disagreed, the paper's own working
  settled it (2017 J: the first copy's own solution uses sin 2x − cos x;
  2018 (z₁/z₂)³ likewise; 2016 and 2017 typos in one copy contradict the
  rest of the exercise) and the paper's source says so. Each paper keeps
  its printed length (150 minutes, matching the timer data) and points
  (125; the 2024 copy prints none per exercise). Everything is `official`
  but `needs-review`, with no answer key, and says so on the page.
  Seed `supabase/seed/past-papers.sql` (`npm run build:past-papers-seed`),
  in `setup-all.sql`; the browser-only store loads the same papers. A paper
  page now offers **Do it on paper, timed**: `/bacii/timer?paper=<id>` uses
  the paper's own length and points, shows its questions under the clock
  (hide or show), survives a reload, scores out of the paper's points, and
  links back to the paper; the mock exam stays as the second option. Long
  inline formulas scroll in their own box, so a phone never scrolls
  sideways. Tests: `npm run test:past-papers` 7/7 (every sitting, lengths
  and points, origin and no answer key, every formula parsed by KaTeX,
  broken data refused, seeds up to date; on local Supabase: read in order,
  no answer key, an official paper refuses other years' and demo
  questions, a student cannot edit); papers, exams, daily, mistakes,
  mastery, questions, exam-timer, recommend, adaptive, learning-privacy,
  knowledge-graph all pass; Playwright 7/7 browser-only and online (list
  badges, a paper with 76 formulas drawn, timing it end to end, a reload
  mid-paper, a broken link, 320px on four papers and the timer), the
  original timer test 6/6; lint, build. Next: social-science mathematics,
  then the other subjects (2014–2022 found for all of them; 2023–2025 only
  for mathematics so far).
- **2026-10-19 — Real past papers, part 2: social-science mathematics
  2014–2025.** The curriculum gains the social science track
  (ថ្នាក់វិទ្យាសាស្ត្រសង្គម) with Mathematics: 5 provisional chapters, 12
  topics, taken from what its papers examine (limits, function study,
  integrals, probability, conics). Its 12 sittings, 59 exercises, 90 minutes
  and 75 points each, typed from the Edu Plus social-science collection
  (sala.moeys.gov.kh/kh/library/00007808) and checked against the
  ជៀប គន្ធា / ជៀប គីមឈរ copies for 2014–2022 (2014 first sitting: only that
  copy's worked answers, which restate every exercise). Disagreements
  settled by the paper itself or the copy's own solution (2018 J; 2021 and
  2022 misprinted denominators); 2014 second sitting III.ខ is wrong in both
  copies and is kept as printed with a note; 2024 prints no points for IV
  and V, so none are shown. Tests: `npm run test:past-papers` covers both
  tracks; all 37 suites pass after the curriculum change;
  Playwright 8/8 browser-only and online (a social paper timed at
  1:30:00, scored out of 75, 320px).
- **2026-10-19 — Real past papers, part 3: Khmer literature 2014–2022, both
  tracks.** 18 papers, one essay each (science 90 minutes / 75 points,
  social science 150 / 125), typed from the ជៀប គន្ធា / ជៀប គីមឈរ copies
  (one copy only, so single-source), every prompt read from a zoomed image.
  Each sitting's date is printed on these copies, so the mathematics papers
  of the same sittings now carry it too. New subjects in the curriculum get
  one clearly labelled chapter, "BacII exam questions (not yet sorted into
  chapters)", instead of invented chapters. A question may now be worth up
  to 200 points (was 100), since a whole literature paper is one 125-point
  essay; `schema.sql` relaxes the check in a re-runnable way. The browser-only
  store loads every file in `src/data/past-papers/` itself. Tests: all 37
  suites pass; `test:past-papers` 7/7 over 4 subjects, 42 papers;
  Playwright 9/9 browser-only and online. No 2023–2025 literature papers
  were found online.
- **2026-10-19 — Real past papers, part 4: history (both tracks), morals and
  civics, geography, earth and environmental science, 2014–2022.** 40 papers,
  195 short-answer and essay questions, typed from the ជៀប គន្ធា / ជៀប គីមឈរ
  copies (single source). Missing from that collection, so not here: social
  history 2014 second sitting, geography 2018, earth science before 2016.
  Where a copy's printed total disagrees with the paper (science history 2017
  and earth science 2016–2019 print 75 for a 50-point elective; the 2018
  earth-science questions themselves add up to 50), 50 is used and the paper
  says so. Points per question are shown only where the copy prints them for
  every question. Tests: affected suites pass; `test:past-papers` 7/7 over 9
  subjects, 82 papers, 353 questions; Playwright 10/10 browser-only and online.
- **2026-10-19 — Production database updated to 572b187** (and to 46a16f1
  before it), the same way: the committed `setup-all.sql` hash-checked in the
  browser, pasted into the SQL editor and run. Read-only check: 82 official
  papers and 353 questions over the 9 subjects, the same counts as locally,
  and the questions' 200-point check in place. The live 2019 science
  mathematics paper shows with its notice and timer.
- **2026-10-19 — Real past papers, part 5: English 2014–2022 and French
  2014–2021.** Both tracks sat the same language paper (the copies' text is
  identical), so each sitting is typed once and listed under both tracks
  (34 papers, 132 parts: reading, grammar, vocabulary, writing). Questions
  now carry their language (`en`, `fr`) instead of always Khmer; the seed
  updates it on rerun. Typos in the copies are kept as printed, with a note
  where a choice is clearly misprinted. No French 2022 paper was in the
  collection. Tests: all suites; `test:past-papers` also checks each
  question's language; Playwright 11/11 browser-only and online.
  `setup-all.sql` passed 1 MB, which the Supabase SQL editor refuses, so
  `npm run build:setup-sql` also writes `supabase/setup-parts/NN.sql`: the
  same SQL in parts under 600 KB, split only between whole transactions
  (the past-papers seed is now one transaction per subject). Run in order on
  local Supabase, then `test:past-papers` (which now checks the parts' size,
  whole transactions and that they hold every question) 7/7. SUPABASE.md
  says to run the parts in order.
- **2026-10-19 — Production database updated to db4712c** by running
  `setup-parts/01–03.sql` in order (each hash-checked against the commit).
  Read-only check: 116 official papers, 485 questions, 13 subjects, 72
  English and 60 French questions — the same as locally.
- **2026-10-19 — Real past papers, part 6: science-track physics 2014–2022,
  with figures.** 9 papers, 55 questions, typed from zoomed crops of the
  copies (2014–2015 from ប៉ែន ពេជ្រវិចិត្រ's copy, which says it copies the
  paper in full). Figures a question needs are cropped from the copy into
  `public/past-papers/` (small grayscale JPEGs, 4–9 KB) and shown with a
  description on the paper page and under the timer. The database accepts
  `past-papers/<name>.(png|jpg|webp)` as an image path besides admin
  uploads; the app serves it from its own origin. 2019's printed points add
  up to 80, so none are shown; 2016 VII's constant and 2022 IV's question
  are missing in the copy, noted on the paper. Tests: all 37 suites;
  `test:past-papers` 9/9 (figures exist, are small, described and all used;
  the database refuses other paths); Playwright 12/12 browser-only and
  online (the 2015 figure on the paper and under the timer at 320px).
- **2026-10-19 — Real past papers, part 7: science-track chemistry
  2014–2022.** 9 papers, 48 questions; formulas and equations in LaTeX
  (`\mathrm{…}`), the 2014 second-sitting rate table as a KaTeX array. The
  structural drawings in the copies are in their answers, not the questions,
  so no figures were needed. 2022's printed points add up to 80, so none are
  shown. Tests: affected suites; `test:past-papers` 9/9 (134 papers, 588
  questions); Playwright 12/12 browser-only and online.
- **2026-10-19 — Real past papers, part 8: science-track biology
  2014–2022.** 9 papers, 64 questions, text only (no figures in the
  questions). Every printed total checked (2018: 6+8+9+10+11+11+20); 2014
  first sitting VI.2 is missing a value in the copy, noted on the paper.
  With this every subject in the collection is in: 16 subjects, 143
  papers, 652 questions. Tests: all 37 suites; `test:past-papers` 9/9;
  Playwright 12/12 browser-only and online.
- **2026-10-21 — Past papers as the real paper, with the copy's answers**
  (owner request). A paper (on its page and under the paper timer) now has
  a **Real paper / One by one** switch: the pages as printed in the copy it
  was typed from (872 images in `public/past-papers/scans/`, 4-shade
  grayscale lossless WebP, 900 px wide, about 20 KB each, 19.6 MB in all;
  tap to zoom), or the typed questions. Under the paper timer the clock is a
  slim bar that stays on top while the paper scrolls. **Answers** open when
  the time is up or the student finishes (on the paper page, behind a
  button), with an **Answers in the copy / AI answer key** switch: the
  copy's own worked-answer pages, labelled as the compiler's and unchecked,
  or the AI key (next task). Where each copy's answers begin was found from
  its centred answer heading and checked by eye on every paper (8 set by
  hand). The view choices are remembered on the device. Tests:
  `test:past-papers` 10/10 (every paper has its pages, every file present,
  small and used); Playwright 14/14 browser-only and online (the clock stays
  in view while scrolling, zoom, answers hidden during the exam, both answer
  views, the view remembered, 320–375px); all 37 suites; lint, build.
- **2026-10-21 — AI answer key, part 1: science-track mathematics
  2014–2025.** 81 worked answers (final answer plus steps, Khmer with LaTeX),
  written by AI (Claude) and stored as `question_solutions` with origin
  `ai-generated`, `needs-review`, so the existing "AI-generated, may contain
  mistakes" warning shows with each. Every numeric result (limits,
  integrals, probabilities, complex numbers, vectors, differential
  equations, tangents) was checked with sympy before it was written. The
  seed updates an AI answer on rerun but never one a teacher has written or
  checked (tested); the browser-only store refreshes stored past-paper
  questions the same way. Answers stay hidden during a running mock exam
  as before. Tests: `test:past-papers` 11/11 (answers labelled, every
  formula parses, the teacher-answer rule); Playwright 14/14 both versions;
  all 37 suites; lint, build.
- **2026-10-21 — Past papers: fewer taps** (owner request: easier to use).
  From the BacII page to a running timed paper is now 2 taps (Past papers,
  then Start on a year), at most 4 for another subject; it was 6 plus two
  dropdowns and a setup screen. Past papers is the first BacII tile, and the
  tiles are a compact 2-column grid. The list picks a track and a subject
  with one tap each (Khmer chips, subjects scroll sideways on a phone),
  opens on the first subject, and shows each sitting as one short row
  (year, sitting, minutes, points) with its own Start button; demo sets are
  listed apart. Start (also on the paper page, now one main button, with
  practice mode and the mock exam as small links) starts the exam timer
  straight away. While the paper runs the page heading is hidden so the
  paper sits right under the clock. When the time is up the answers come
  first, and the AI key shows each final answer at once with the working
  one tap away. The copy notes on a paper fold into "About this copy".
  Tests: Playwright 8/8 browser-only and online (the new flow end to end,
  320–375px) and the timer suite 6/6; `test:past-papers` 11/11,
  `test:exam-timer` 5/5; lint, build.
- **2026-10-21 — Fix: Start showed an old timer instead of the paper**
  (owner report). A timer saved on the device (here a subject timer that
  had ended) took priority over the paper a student tapped Start on, so the
  page showed "00:00" with no paper. Start on a paper now replaces a saved
  timer unless it is that same paper still running; a sitting that ended
  over 3 hours ago is no longer shown again (the history keeps it); and an
  ended sitting is not added to the history again on each visit. The Exam
  timer page now offers "Do a real past paper" first, since a subject timer
  has no paper. Tests: `test:exam-timer` 6/6; Playwright 10/10 both
  versions (the new steps fail on the old page with "00:00"); timer 6/6;
  lint, build.
- **2026-10-21 — AI answer key, part 2: social-track mathematics
  2014–2025.** 59 worked answers in the same form as part 1 (Khmer with
  LaTeX, ai-generated, needs-review); every limit, integral, probability,
  conic and function study checked with sympy, and every formula parses.
  Where the paper is ambiguous (2023 Q1c writes $x	oinfty$) both limits
  are given. Tests: `test:past-papers` 11/11; answers checked on a 375px
  phone (no overflow, no formula errors).
- **2026-10-21 — AI answer key, part 3: science-track physics
  2014–2022.** 55 answers (theory in Khmer, calculations with LaTeX),
  ai-generated and needs-review. Every number recomputed and compared with
  the copy's own worked answers; where the copy's question is incomplete
  (2014-1 Q6b, 2016 Q7, 2019 Q5, 2022 Q2 and Q4) the answer says what it
  assumes, and where the copy's answer disagrees with the printed paper
  (2019 Q6c: 5000 J against 50000 J) the key follows the paper and says so.
  Tests: `test:past-papers` 11/11; every physics paper's key checked on a
  375px phone (no overflow, no formula errors).
- **2026-10-21 — AI answer key, part 4: science-track chemistry
  2014–2022.** 48 answers (equations, ionic equations, calculations),
  ai-generated and needs-review, every number recomputed and compared with
  the copy's worked answers. Where the printed question and the copy's
  answer differ, the key says so: 2015 Q3 prints ammonium sulfate (no
  precipitate, as printed) while the copy answers for the sulfide (CdS);
  2022 Q4 prints an ester mass of 2.29 with no unit, which fits no formula,
  and the copy uses 2.2 g. Long chemical equations are split at their + and
  arrows so they wrap on a phone instead of running off the screen (one
  social-maths derivative likewise). `test:past-papers` now writes its
  answer row before testing the teacher-answer rule, so it no longer
  depends on what the local database already holds. Tests:
  `test:past-papers` 11/11; setup parts 01–04 load into local Supabase;
  every answered paper checked on a 375px phone for clipped formulas.
- **2026-10-21 — AI answer key, part 5: science-track biology
  2014–2022.** 64 answers (theory in Khmer, DNA and RNA calculations),
  ai-generated and needs-review. Calculations follow the copy's conventions
  (0.34 nm per nucleotide pair, amino acids = codons − 2) and were
  rechecked; the copy's own slips are corrected and named (2014-1 Q5 bond
  count, 2014-2 Q8 C = G). 2014-1 Q6 lacks the mRNA data in print, so the
  answer uses the copy's U = 250, C = 60 and says so. 2019 Q6 was typed as
  "ការ" where the paper prints "ការេ" (the square of A − C); the question
  text is corrected. Tests: `test:past-papers` 11/11; every biology key
  checked on a 375px phone (no clipped formulas).
- **2026-10-21 — AI answer key, part 6: English 2014–2022 (both
  tracks).** The two tracks sit the same English paper, so one key of 36
  answers serves both: the reading gap-fills (with the word left over),
  grammar and vocabulary choices with a one-line reason each, and a model
  essay for every writing task that meets the paper's word count (180 words
  to 2016, 80 after). Misprints in the copy are named where they matter
  (for example "opinion pool", "golds", "exacted"); 2015's text lost
  gap (7), and the answer says which word is left for it. Labelled
  ai-generated and needs-review like the rest. Tests: `test:past-papers`
  11/11; checked on a 375px phone.
- **2026-10-21 — AI answer key, part 7: French 2014–2021 (both
  tracks).** One key of 30 answers for the shared French paper, in French:
  gap-fills, odd-one-out words with the reason, grammar transformations
  with the rule, and a model text for every writing task within the word
  count asked. The copies' own marking keys (2018, 2019) were compared:
  where they accept two answers (2019 odd-one-out 1) the key says so, and
  where the printed key does not fit the sentence as printed (2018 Q3B, 3
  → b) the key explains the difference. Labelled ai-generated and
  needs-review. Tests: `test:past-papers` 11/11.
- **2026-10-21 — AI answer key, part 8: Khmer literature 2014–2022 (both
  tracks).** 18 model essays in Khmer, one per paper (the tracks sit
  different prompts), in the shape the copies' marking guides reward:
  introduction (lead-in, prompt, question), explanation of the key words
  and meaning, analysis, three literary examples, summary and conclusion.
  The examples keep to the works those guides cite (Tum Teav, Reamker,
  Kolab Pailin, Thmenh Chey, Vessantara, Sophat and others) and to
  well-known facts about them; each essay reminds students to check names
  and authors against their textbook. Labelled ai-generated and
  needs-review. Tests: `test:past-papers` 11/11.
- **2026-10-21 — AI answer key, part 9: history 2014–2022 (both
  tracks).** 77 answers in Khmer (science 39, social 38) built from one
  shared bank, so a topic asked in both tracks (the 1970 coup, the
  protectorate, ASEAN, the win-win policy, 7 January 1979…) gets the same
  answer. They follow the curriculum the copies' marking keys reflect, with
  the established dates and names (for example 11 August 1863, 9 November
  1953, 18 March 1970, 2 December 1978, 23 October 1991, 29 December
  1998, ASEAN on 30 April 1999), avoid disputed figures, and note
  Timor-Leste joining ASEAN in October 2025, after these papers. Labelled
  ai-generated and needs-review. The setup SQL now splits into 5 parts.
  Tests: `test:past-papers` 11/11.
- **2026-10-21 — AI answer key, part 10: morality and civics 2014–2022.**
  49 answers in Khmer, with the textbook's own classifications as the
  copies' marking keys give them: the two kinds of virtue, of moral
  responsibility, the high values (moral value highest), the stages of a
  voluntary act, the three models of noble people, the three
  anti-corruption measures (do not want, cannot, do not dare), common,
  scientific and philosophical knowledge, analysis and synthesis,
  induction and deduction. A topic asked in several years gets one
  consistent answer. Labelled ai-generated and needs-review. Tests:
  `test:past-papers` 11/11.
- **2026-10-21 — Fix: the 2014 second-sitting social-track history paper
  was missing.** The copy bundles it into its geography file (pages 4–7),
  so the split filed its paper and key as extra geography answer pages and
  the paper never reached the history list. Geography 2014 (second
  sitting) now shows only its own three answer pages; history gains the
  real paper (13 October 2014, 90 minutes, 75 points, three questions:
  Jayavarman VII, world food security, why the Khmer Rouge leaders were
  tried) with its printed page, the copy's key and an AI answer key. 144
  papers, 655 questions. Tests: `test:past-papers` 11/11; setup parts
  01–05 load into local Supabase; the paper and the trimmed geography
  answers checked on a 375px phone in both versions.
- **2026-10-21 — AI answer key, part 11: geography 2014–2022.** 43
  answers in Khmer, following the copies' marking keys: the seven types of
  province, the four kinds of road, the three rice systems, the four forms
  of internal migration, the seven national parks, and the textbook's own
  figures, labelled as such (for example 2008 rice yields and tourism
  income). The 2021 density is worked: 11 437 656 ÷ 181 035 ≈ 63.18
  people per km². There is no 2018 paper in the source copies. Labelled
  ai-generated and needs-review. Tests: `test:past-papers` 11/11.
- **2026-10-21 — AI answer key, part 12: earth and environmental science
  2016–2022.** 26 answers in Khmer (galaxies, the Sun, weathering, fossil
  fuels, the water cycle, the greenhouse effect, Earth's motions and the
  solstices, planets, soils, minerals, energy, waste), with the
  Cambodia-specific lists from the copies' marking keys (four mineral
  groups, five soil types, gem provinces). With this every past-paper
  question has an AI answer key: 655 of 655, all ai-generated and
  needs-review. Tests: `test:past-papers` 11/11; every earth-science key
  checked on a 375px phone.
- **2026-10-21 — The social track's science paper before 2016: physics
  (2014) and biology (2015).** Two real papers in the source copies had
  never been added: social-track physics (13 October 2014) and biology
  (24 August 2015), each 60 minutes and 50 points, which earth and
  environmental science replaced from 2016. They are added as two social
  subjects (one past-papers chapter each, like the other added subjects),
  typed as printed, with their page images, the copies' keys and AI answer
  keys (physics numbers checked: 2π×10⁻³ T, 60 %, 6000 W, 2500 J, 1000 J,
  20 Ω). The timing data records that the elective slot was these
  subjects earlier (`earlierAs`), so the timer and the length check map
  them to it. 18 subjects, 146 papers, 667 questions, all with an AI key.
  Tests: `test:past-papers` 11/11, `test:curriculum` 11/11,
  `test:exam-timer` 6/6; lint; build; setup parts 01–06 load locally;
  both papers checked on a 375px phone in both versions.
- **2026-10-22 — Study next, simpler** (owner report: confusing). The
  card moved below the BacII tools, so they stay one tap away. It now
  shows the top 3 suggestions as one compact list instead of a stack of
  boxes. Each row has the topic name with its chapter ("Chapter 4 · …",
  because a topic name such as "Properties" means little alone), one
  reason (not repeated when the row above has the same one), one short
  button (Practise, Review, Watch, Read) and a small × for "Not now". The
  intro line is gone; "Practise these" still covers the whole list.
  Tests: the Study next browser test 8/8 browser-only and online (tools
  first, at most 3, only the top reason, review first when due, Not now,
  English reasons, 320px); `test:recommend` 15/15; lint; build.
- **2026-10-24 — Neutral look and a new BacII page** (owner request, with a
  mockup). Colours: white pages and cards, grey lines and plain grey ink
  (black and dark grey in dark mode); the logo green only highlights
  (buttons, active items, links, icons, focus). Tinted backgrounds, the teal
  second colour, the notebook rules, the bookmark decorations and the
  coloured spines on note cards are gone; the browser bar and installed app
  use white. BacII page: a banner with a small drawn illustration and the
  learning links as pills, a Today's question bar with a Start button, and
  tool cards with an icon, description and arrow. Also fixed: Settings
  scrolled sideways on a phone. Checked on desktop and a 375px phone in
  light and dark (Home, BacII, past papers, practice, profile, settings).
  Tests: Playwright past papers 10/10 and Study next 8/8; lint; build.
- **2026-10-24 — Drawings on the BacII page** (owner request, from their
  mockup). The banner and each tool card get a small drawing: books and a
  mortar board, exam sheets and a pencil, an open book, an alarm clock, a
  trophy, a phone framing an exercise, a notebook, a calendar and a video
  screen. Drawn in SVG (`src/components/BaciiArt.tsx`) in theme greys with
  the green as the one highlight, so they follow light and dark mode and
  add almost nothing to the download. On a phone the drawing leads each
  card; on wider screens it sits on the right with the arrow below.
  Checked on desktop and a 375px phone in light and dark. Tests: Study next
  8/8 (tools still first); lint; build.
- **2026-10-24 — 3D pictures instead of drawings** (owner request: real
  picture files look better). The BacII banner and tool cards, the Home
  welcome card, its three points and the Continue learning card now use
  3D pictures from Microsoft Fluent Emoji (MIT; notice in
  `public/illustrations/LICENSE.txt` and on the Credits page). Resized to
  WebP in `public/illustrations/`: 13 files, about 58 KB in all, loaded
  lazily below the fold. The SVG drawings (`BaciiArt.tsx`) are removed.
  Checked on desktop and a 375px phone, light and dark, signed in and out.
  Tests: Study next 8/8, past papers UI 10/10; lint; build.
- **2026-10-24 — Real photos instead of 3D stickers** (owner request: the
  3D pictures looked like stickers; use real photos). The BacII banner and
  every tool card, the Home welcome card, its three points, the greeting
  card and Continue learning now use photos: an exam hall, an answer sheet,
  an open book, an alarm clock, a gold trophy (live quiz), a phone on a
  notebook, a planner, a laptop. Google and Pinterest images belong to
  their owners, and Unsplash blocks automated download, so the photos come
  from CC0 libraries found through the Openverse API (rawpixel, StockSnap)
  and one CC BY-SA 4.0 photo from Wikimedia Commons; every photo is listed
  with author, source and licence on the Credits page
  (`src/data/photo-credits.json`). WebP at 360/640 px (banner 480/960) with
  `srcset`, so a phone fetches about 90 KB for the BacII page. Cards show
  the photo across the top; the banner photo fades into the card on wider
  screens. Fluent Emoji pictures removed. Checked on desktop and a 375px
  phone, light and dark, signed in and out. Tests: Study next 8/8, past
  papers UI 10/10; lint; build.
- **2026-10-25 — Library accounts with real, referenced lectures** (owner
  request). Five clearly labelled curator accounts ("Meh Rean Library ·
  Computer Science / Mathematics / Science / Economics & Society / BacII
  Cambodia", usernames `library_*`, bios say they are run by Meh Rean and
  not affiliated with the sources) posted 31 notes on the live site. Each
  describes one real free lecture series and links to its sources:
  Harvard CS50 (x, Python, Web, AI) and Justice; MIT OpenCourseWare 6.0001,
  6.006, 6.042J, 6.034, 18.01SC, 18.02SC, 18.06SC, 18.03SC, 18.05, 8.01SC,
  5.111SC, 7.016, 14.01, plus MIT 6.S191 and the Missing Semester; Yale
  PHYS 200 and ECON 252; Khan Academy; and for BacII, the Ministry's free
  Grade 12 lessons (YouTube, Facebook, e-learning site, the MoEYS app with
  1,000 Grade 12 videos) per subject, and VVOB's Khmer experiment videos.
  Every fact was checked on the source page on 2026-10-25; claims we could
  not check were left out (a paid app was not posted; the Ministry site
  refuses automated visits, which the posts say). Links in note text are
  now clickable (`LinkedText`, shared with chat). Tested on local Supabase
  first (31 added, rerun adds 0), then run once on production.

## Blockers and things that need a person

| Item | Needed for | What is needed |
| --- | --- | --- |
| Official Grade 12 curriculum | 1.1 → verified, all later content | A Grade 12 maths teacher, or the MoEYS textbook, to check chapters, topics and Khmer terms (both tracks; the social-science chapters were taken from what its past papers examine); then set `verification: "verified"` with a `source`. |
| Production database | everything since 1.1 | **Checked 2026-10-13: production has none of the BacII tables yet** — every BacII feature fails until the owner pastes `supabase/setup-all.sql` into the Supabase SQL editor and runs it (see SUPABASE.md §2). |
| Real past papers | 2.1 | Mathematics for both tracks, 2014–2025, is in, typed from copies shared online and marked "not yet checked". Needed: a teacher (or the Ministry's original papers) to check each paper and mark it verified; the owner to confirm publishing the exercises is fine; answer keys written or checked by a teacher; 2023–2025 papers for subjects other than mathematics. |
| Official exam rules (durations, grade bands, exam-day rules) | 2.4, 2.5, 8.1 | An official source; until then values are labelled practice settings. Grade bands: edit `src/data/grade-scale.json`. |
| YouTube transcripts | 4.6 content | The Data API only gives captions to a video's owner. 4.4 uses creators' description chapters; 4.6 quizzes need an admin with a transcript they may use (channels that agree to share theirs). |
| Telegram bot | 5.5 | A bot token from @BotFather (free) and owner approval. |
| Khmer interface wording | 5.4 | A Khmer speaker to review translations. |
| Real-photo reading | 4.5 quality | Try "Photo to solution" on the live site with real handwritten and printed exercises; tune the prompt from what goes wrong. |
| Trusted video channels | 4.3 useful | An admin (a teacher, ideally) to add Khmer channels they have checked at `/bacii/admin/channels`. |
| Bundle size (725 kB main file) | Phase 2+ on cheap phones | Pages already load on demand; next: load the data backend asynchronously in `api.ts`. |
