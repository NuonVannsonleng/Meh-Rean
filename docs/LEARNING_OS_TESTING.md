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
| 2026-10-16 | UI regressions after events (practice, mistakes, exam, daily, plan both backends; watched browser-only) | all pass |
