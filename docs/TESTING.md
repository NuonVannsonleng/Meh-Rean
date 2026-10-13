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
npm run test:exams        # mock exam timing, marking, hidden answers (task 2.4)
npm run test:grades       # grade estimate bands and maths (task 2.5)
npm run test:mistakes     # mistake notebook: recording, fixing, reviews, privacy (tasks 3.1, 3.2)
npm run test:review       # spaced-repetition rules, same intervals as the database (task 3.2)
npm run test:daily        # daily question pick, weakest chapter, streaks, privacy (task 3.3)
npm run test:daily-rules  # Cambodia day, weakest chapter and streak rules (task 3.3)
npm run test:study-plan   # plan builder rules (task 3.4)
npm run test:study-plans  # saved plans: privacy and checks; local Supabase (task 3.4)
npm run test:video-quota  # YouTube quota log rules; local Supabase (task 4.1)
npm run test:video-channels # trusted channels: admin-only writes, checks; local Supabase (task 4.3)
npm run test:video-chapters # description chapter parsing (task 4.4)
npm run test:question-match # matching an exercise to the question bank (task 4.5)
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
| 2026-10-13 | `npm run test:exams` (local Supabase) | 12 passed, 0 failed |
| 2026-10-13 | `npm run test:grades` | 12 passed, 0 failed |
| 2026-10-13 | `npm run test:mistakes` (local Supabase) | 9 passed, 0 failed |
| 2026-10-13 | `npm run test:review` | 9 passed, 0 failed |
| 2026-10-13 | `npm run test:daily` (local Supabase) | 8 passed, 0 failed |
| 2026-10-13 | `npm run test:daily-rules` | 12 passed, 0 failed |
| 2026-10-13 | `npm run test:study-plan` | 19 passed, 0 failed |
| 2026-10-13 | `npm run test:study-plans` (local Supabase) | 6 passed, 0 failed |
| 2026-10-13 | `npm run test:video-quota` (local Supabase) | 3 passed, 0 failed |
| 2026-10-13 | `npm run test:video-channels` (local Supabase) | 5 passed, 0 failed |
| 2026-10-13 | `npm run test:video-chapters` | 8 passed, 0 failed |
| 2026-10-13 | `npm run test:question-match` | 8 passed, 0 failed |
| 2026-10-13 | Playwright: photo to solution, online with mock Gemini / browser-only | 8/8, 4/4 |
| 2026-10-13 | Playwright: trusted channels admin page, browser-only / online | 5/5, 6/6 |
| 2026-10-13 | Playwright + API: video finder with mock Gemini and YouTube (incl. server cache, usage, saved lookups, chapter matching, Khmer grouping and trusted channels, chapter start times, limit, phone) — needs a freshly started dev server (cold caches) | 22/22 |
| 2026-10-13 | Playwright: study plan (settings, past date refused, weak first, edit + autosave, reload, links, remake, 320px, delete), online / browser-only | 9/9, 9/9 |
| 2026-10-13 | Playwright: today's question (hub card, starter pick, answer, streak, reload, 320px), online / browser-only | 7/7, 7/7 |
| 2026-10-13 | Playwright: mistake notebook (from an exam, retry right/wrong, due review, fixed view, practice reopens, remove, 320px), online / browser-only | 11/11, 11/11 |
| 2026-10-13 | Playwright: mock exam (start, autosave, hidden answers, resume, hand in, grade estimate, time-out, 320px), online / browser-only | 8/8, 8/8 |
| 2026-10-13 | `npm run test:curriculum` (local Supabase) | 11 passed, 0 failed |
| 2026-10-13 | `npm run test:questions` (local Supabase) | 21 passed, 0 failed |
| 2026-10-13 | Playwright: admin question pages, online / browser-only | 10/10, 9/9 |
| 2026-10-13 | `npm run test:papers` (local Supabase) | 8 passed, 0 failed |
| 2026-10-13 | Playwright: practice by chapter, online / browser-only | 5/5, 5/5 |
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
