# Progress

## Current

**Phase 1 — Task 1.2: Design the question schema** (next up).

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
