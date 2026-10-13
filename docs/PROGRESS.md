# Progress

## Current

**Phase 2 — Task 2.3: Chapter filter** (next up).

Rules to keep: stored text only through `MathText`; question images only by
storage path; AI-derived content labelled with its origin; solutions held
back on the server before mock exams (2.4).

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

## Blockers and things that need a person

| Item | Needed for | What is needed |
| --- | --- | --- |
| Official Grade 12 curriculum | 1.1 → verified, all later content | A Grade 12 maths teacher, or the MoEYS textbook, to check chapters, topics and Khmer terms; then set `verification: "verified"` with a `source`. |
| Production database | 1.1–2.1 live | Owner runs `supabase/schema.sql`, then `supabase/seed/curriculum.sql`, then `supabase/seed/demo-papers.sql`, in the Supabase SQL editor. |
| Real past papers | 2.1 | Papers and permission to publish them; until then demo entries only, clearly labelled. |
| Official exam rules (durations, grade bands, exam-day rules) | 2.4, 2.5, 8.1 | An official source; until then values are labelled practice settings. |
| YouTube transcripts | 4.4, 4.6 | The Data API only gives captions to a video's owner; third-party timestamps and video quizzes need another lawful source or will be limited. |
| Telegram bot | 5.5 | A bot token from @BotFather (free) and owner approval. |
| Khmer interface wording | 5.4 | A Khmer speaker to review translations. |
| Bundle size (811 kB) | Phase 2+ on cheap phones | Route-level code splitting (no approval needed; scheduled before Phase 2). |
