# Testing

## Commands

```bash
npm run lint              # type-check everything (app, api/, vite config)
npm run build             # type-check and build
npm run test:accounts     # auth, uploads, authorization, chat, roles
npm run test:curriculum   # curriculum seed + database checks (task 1.1)
npm run test:questions    # question schema rules and permissions (task 1.2)
npm run test:math         # LaTeX/Khmer text splitter (task 1.3), no database
npm run test:papers       # demo papers seed + paper rules (task 2.1)
```

The harnesses need a local Supabase for their database parts:

```bash
npx supabase start        # Docker must be running
docker exec -i supabase_db_Meh_Rean psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f - < supabase/schema.sql
docker exec -i supabase_db_Meh_Rean psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f - < supabase/seed/curriculum.sql
docker exec -i supabase_db_Meh_Rean psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f - < supabase/seed/demo-papers.sql
```

and a `.env.test` pointing at it (see `docs/ENVIRONMENT.md`). They refuse to
write to a hosted project.

UI flows are checked with Playwright (Chromium) against `npm run dev` in two
modes: browser-only (no Supabase variables) and local Supabase. Those scripts
are not in the repository yet (see Architecture finding 4).

## Latest results

| Date | Check | Result |
| --- | --- | --- |
| 2026-10-13 | `npm run lint`, `npm run build` | pass |
| 2026-10-13 | `npm run test:curriculum` (local Supabase) | 11 passed, 0 failed |
| 2026-10-13 | `npm run test:questions` (local Supabase) | 21 passed, 0 failed |
| 2026-10-13 | Playwright: admin question pages, online / browser-only | 10/10, 9/9 |
| 2026-10-13 | `npm run test:papers` (local Supabase) | 7 passed, 0 failed |
| 2026-10-13 | Playwright: past papers + step-by-step solutions, online / browser-only | 6/6, 6/6 |
| 2026-10-13 | `npm run test:math` | 17 passed, 0 failed |
| 2026-10-13 | Playwright on `/dev/math` (320, 375 dark, 1280) | pass: font, KaTeX + MathML, no overflow, hostile input inert |
| 2026-10-13 | `npm run test:accounts` (local Supabase) | 68 passed, 0 failed, 3 skipped (documented, not asserted) |

Known flake: the first `test:accounts` run straight after `npx supabase start`
has twice reported 1 failure that did not reproduce on the next run. When it
happens, keep the output and rerun; investigate if it reproduces.

Known flake: the New note picker run ("tapping University opens the
university search" right after picking a high school) has failed
intermittently three times since 2026-10-08 and passed on every rerun. Not
yet traced; suspect timing between the high-school dialog closing and the
next level tap.
