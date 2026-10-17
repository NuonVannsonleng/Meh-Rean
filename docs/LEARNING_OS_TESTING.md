# AI Learning OS — testing

All existing suites stay green ([TESTING.md](TESTING.md)). Learning OS suites
are added per task and listed here with their latest results.

| Date | Check | Result |
| --- | --- | --- |
| 2026-10-16 | Phase 0 (documentation only; no code changed) | — |
| 2026-10-16 | `npm run test:concept-links` (unit + local Supabase) | 6 passed, 0 failed |
| 2026-10-16 | `npm run test:resource-topics` (local Supabase) | 3 passed, 0 failed |
| 2026-10-16 | Playwright: note topics + videos by topic, browser-only / online | 3/3, 3/3 |
| 2026-10-16 | `npm run test:learning-events` (local Supabase) | 6 passed, 0 failed |
| 2026-10-16 | `npm run test:learning-profile` (unit + local Supabase) | 6 passed, 0 failed |
| 2026-10-16 | Playwright: learning profile, browser-only / online | 4/4, 4/4 |
| 2026-10-16 | `npm run test:learning-privacy` (local Supabase) | 7 passed, 0 failed |
| 2026-10-16 | Full suite (25 scripts) on a database upgraded from the pre-BacII schema via `setup-all.sql` | all pass |
| 2026-10-16 | `npm run test:knowledge-graph` (unit + local Supabase) | 7 passed, 0 failed |
| 2026-10-16 | Playwright: topic page (visitor, results, check-first, 320px), browser-only / online | 4/4, 4/4 |
| 2026-10-16 | Playwright: concept map (desktop map, chain highlight, keyboard, phone list, 320px), browser-only / online | 4/4, 4/4 |
| 2026-10-16 | UI regressions after events (practice, mistakes, exam, daily, plan both backends; watched browser-only) | all pass |
| 2026-10-16 | `npm run test:concept-links` (incl. seed rerun keeps admins' work) | 7 passed, 0 failed |
| 2026-10-16 | Playwright: topic links admin (add, loop refused, check needs source, remove, 320px), browser-only / online | 4/4, 4/4 |
| 2026-10-17 | `npm run test:mastery` (unit + local Supabase: stored = app to 1e-9, privacy, version change) | 20 passed, 0 failed |
| 2026-10-17 | Playwright: mastery label, meter, history, profile list, map legend, 320px, browser-only / online | 5/5, 5/5 |
| 2026-10-17 | `npm run test:recommend` (incl. 300 random students) | 15 passed, 0 failed |
| 2026-10-17 | Playwright: Study next (visitor, Khmer reasons, due review first, Not now, English, 320px), browser-only / online | 7/7, 7/7 |
| 2026-10-17 | `npm run test:adaptive` (selection, difficulty, modes) | 13 passed, 0 failed |
| 2026-10-17 | `npm run test:readiness` | 7 passed, 0 failed |
| 2026-10-17 | Playwright: exam readiness (no data; level, parts, coverage, trend, week; 320px), browser-only / online | 3/3, 3/3 |
| 2026-10-17 | Playwright: AI companion with mock Gemini (label, prompt facts, no identifying data, plan kept/dropped, daily limit, 320px), online / browser-only | 6/6, 2/2 |
| 2026-10-17 | Regression after the companion task: video finder e2e / photo to solution, online | 22/22, 8/8 |
| 2026-10-17 | `npm run test:companion` | 6 passed, 0 failed |
| 2026-10-17 | Playwright: study companion without AI (summary, reasons, plan, break, review first, 320px), browser-only / online | 4/4, 4/4 |
| 2026-10-17 | `npm run test:learning-history` (local Supabase) | 4 passed, 0 failed |
| 2026-10-17 | Playwright: learning history (empty, entries, delete one, delete all, notebook kept, 320px), browser-only / online | 5/5, 5/5 |
| 2026-10-17 | `npm run test:revision` (unit + local Supabase postpone rules) | 6 passed, 0 failed |
| 2026-10-17 | Playwright: revision queue (empty, order and reasons, postpone, review clears it, 320px), browser-only / online | 5/5, 5/5 |
| 2026-10-17 | `npm run test:journey` | 6 passed, 0 failed |
| 2026-10-17 | Playwright: learning journey (sign-in, new student, never locked, done/review/milestones, 320px), browser-only / online | 5/5, 5/5 |
| 2026-10-17 | Playwright end to end: adaptive practice (sign-in, picker, empty weak mode, difficulty up/down, no repeats, skip, results before/now, marked by the backend, quick five, Study next link, 320px), browser-only / online | 9/9, 9/9 |
