# Meh Rean — rules for AI agents

Meh Rean is a study-sharing web app (notes, slides, past papers, videos) for
students everywhere, growing a **BacII** section for Cambodian Grade 12
students. Live: https://meh-rean.vercel.app. Plan: [BACII_ROADMAP.md](BACII_ROADMAP.md).
Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack (do not change without approval)

- Vite 7 + React 19 + TypeScript (strict) + React Router 7 + Tailwind CSS v4.
- Supabase: Postgres with row level security, Auth, Storage, Realtime.
  `supabase/schema.sql` is the whole schema and must stay re-runnable.
- Vercel: static site plus Functions in `api/` (server-only secrets live there).
- No paid service, new provider or recurring cost without the owner's approval.

## How the code is organised

- All data access goes through `src/services/api.ts`, which picks
  `localApi.ts` (browser-only demo store) or `supabaseApi.ts` (Supabase). Both
  export the same functions with the same types; `api.ts` type-checks that.
  A feature is not done until it works in both, or deliberately says it needs
  the online version.
- User-facing copy lives in `src/i18n/en.ts`. Khmer appears next to English
  where students look for it (subjects, BacII). Do not hard-code copy.
- Curriculum, subjects, grade bands and exam rules are data, never constants
  inside components.
- Comments are short and say why, not what.

## Rules

1. Read the existing code before changing it; reuse components and services.
2. Never print, commit or log the contents of `.env*` files or any key.
   Browser code only ever sees the Supabase publishable key.
3. Every new table gets row level security in `schema.sql`. Writes that only
   admins may make check `public.is_admin(auth.uid())`.
4. Never trust the client for scores, roles, ownership or dates; enforce them
   in the database (policies, triggers) or in an `api/` function.
5. Never fabricate official BacII questions, curriculum facts, exam rules or
   results. Unverified content carries `verification = 'provisional'` (or
   `'needs-review'`) and says so in the UI.
6. AI output shown to students is labelled as AI-generated and unverified.
7. Mobile first: test at 320px and 375px, cheap Android phones, slow networks.
8. One roadmap task at a time. It is complete only when its main workflow
   works from the UI through the data layer and its checks pass.
9. Report blockers plainly. Never claim a test passed that did not run.
10. Never run destructive migrations or touch production data without approval.

## Commands

```bash
npm run lint             # type-check (tsc -b --noEmit)
npm run build            # type-check and build
npm run test:accounts    # auth, uploads, authorization; local Supabase only
npm run test:curriculum  # curriculum seed checks; local Supabase for the DB part
npm run test:questions   # question schema rules and permissions; local Supabase
npm run test:math        # LaTeX/Khmer text splitter
npm run test:papers      # demo papers seed + paper rules; local Supabase
npm run test:exams       # mock exam timing, marking, hidden answers; local Supabase
npm run test:grades      # grade estimate bands and maths
npm run test:mistakes    # mistake notebook and reviews; local Supabase
npm run test:review      # spaced-repetition rules
npm run test:daily       # daily question and streak; local Supabase
npm run test:daily-rules # daily question rules (no database)
npx supabase start       # local Supabase (Docker)
```

Tests that write data refuse to run against anything but a local Supabase
(see `scripts/test-accounts.mjs`). Point them at `.env.test`.

## Agents

Specialists live in `.claude/agents/` (`meh-rean-*`). The lead session (or
`meh-rean-project-manager`) plans and owns commits and pushes; specialists
report back with: what changed, files, decisions, checks run and their
results, open issues. Parallelise research and reviews, not edits to the same
files.
