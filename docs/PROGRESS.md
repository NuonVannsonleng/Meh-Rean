# Progress

## Current

**Phase 1 — Task 1.3: Render Khmer and maths together** (next up).

Carry over from the 1.2 security review — the renderer must:
render `content`, choices, answers and steps as text through KaTeX with
`trust: false`, `throwOnError: false` and a `maxExpand` limit (no `\href`,
`\url`, `\includegraphics`, `\htmlClass`); never use
`dangerouslySetInnerHTML` on stored strings; allow only `https:` image
sources, with `alt`; keep AI-derived content labelled with its origin.

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

## Blockers and things that need a person

| Item | Needed for | What is needed |
| --- | --- | --- |
| Official Grade 12 curriculum | 1.1 → verified, all later content | A Grade 12 maths teacher, or the MoEYS textbook, to check chapters, topics and Khmer terms; then set `verification: "verified"` with a `source`. |
| Production database | 1.1 live | Owner runs `supabase/schema.sql`, then `supabase/seed/curriculum.sql`, in the Supabase SQL editor. |
| Real past papers | 2.1 | Papers and permission to publish them; until then demo entries only, clearly labelled. |
| Official exam rules (durations, grade bands, exam-day rules) | 2.4, 2.5, 8.1 | An official source; until then values are labelled practice settings. |
| YouTube transcripts | 4.4, 4.6 | The Data API only gives captions to a video's owner; third-party timestamps and video quizzes need another lawful source or will be limited. |
| Telegram bot | 5.5 | A bot token from @BotFather (free) and owner approval. |
| Khmer interface wording | 5.4 | A Khmer speaker to review translations. |
| Bundle size (811 kB) | Phase 2+ on cheap phones | Route-level code splitting (no approval needed; scheduled before Phase 2). |
