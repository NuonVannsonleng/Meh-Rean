# AI Learning OS — release readiness (Phase 11)

Checked 2026-10-17. Results of every check are in
[LEARNING_OS_TESTING.md](LEARNING_OS_TESTING.md); task notes in
[LEARNING_OS_PROGRESS.md](LEARNING_OS_PROGRESS.md).

## What is in this release

For signed-in students, from the BacII page → **My learning** (`/learning`):

| Page | What it does |
| --- | --- |
| My learning `/learning` | Today's focus, Study next, topics by estimate, revision, journey, readiness, quick actions |
| Study next (BacII page) | Up to 5 suggestions with reasons in Khmer or English, one thing to do each, "Not now" |
| Topic page / topic map | Prerequisites, what a topic opens up, the student's estimate and how it changed |
| Adaptive practice `/learning/practice` | Six modes; one question at a time; difficulty moves with each marked answer |
| Revision `/learning/revision` | Due notebook reviews, most useful first; postpone 1, 3 or 7 days (at most 5 times) |
| My journey `/learning/journey` | Every topic as done / next / in progress / ready / builds on earlier; milestones; nothing locked |
| Exam readiness `/learning/readiness` | Coverage, estimate and mock exam trends, consistency, this week; a level, never a predicted result |
| Study companion `/learning/companion` | Summary, why the suggestions, a session plan — by rules; optional AI version, labelled |
| Learning history `/learning/history` | Every recorded event; delete one or all |
| Flashcards `/learning/flashcards` | Your own cards (formulas allowed), reviewed after 1, 3, 7 and 14 days |
| Admin → Topic links | Add, check and remove prerequisite and related links |

All of it works in both the online version and the browser-only preview,
except the AI companion, which needs the server and says so.

## Deployment checklist

1. **Database.** Run the latest `supabase/setup-all.sql` in the Supabase SQL
   editor (safe to run again; never deletes users, posts or messages). It was
   run on production at 414d2da on 2026-10-17 (flashcards). After any later schema change, run it again. Then run the read-only
   check below.
2. **Vercel environment** (Project → Settings → Environment Variables; never
   in code or chat):
   - `GEMINI_API_KEY` — already used by the video finder and photo to
     solution; the AI companion uses the same key.
   - `YOUTUBE_API_KEY` — video finder.
   - Optional: `BACII_DAILY_LIMIT` (lookups, default 20), `BACII_COMPANION_LIMIT`
     (AI companion requests, default 10).
3. **Admin account.** At least one profile with `is_admin = true` (needed for
   topic links, videos, channels, questions).
4. **Deploy.** Push to `main`; Vercel builds `npm run build` (type-check
   included).
5. **Smoke test on the live site** (one pass, not repeatedly — Vercel's
   checkpoint blocks rapid automated traffic): sign in → BacII → My learning;
   answer one practice question; check Study next, the topic page estimate,
   revision and history; ask the companion once.

Read-only check after running `setup-all.sql`:

```sql
select
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) as tables_without_rls,   -- 0
  (select string_agg(version || ':' || active, ',') from public.mastery_rules where active) as mastery_rules, -- 2:true
  (select count(*) from public.concept_links) as topic_links,                                                -- 40
  (select count(*) from pg_proc where proname in ('postpone_review', 'delete_my_learning_events', 'refresh_topic_mastery')) as functions, -- 3
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'companion_requests') as companion_table; -- 1
```

## Security and data isolation

- **Isolation audit** (`npm run test:learning-privacy`, 8/8): another student,
  an admin and a visitor cannot read, change, delete or forge rows in any of
  the 12 private tables (notebook, chapter progress, daily questions, exam
  attempts and answers, study plans, video marks, learning events, learning
  profile, YouTube log, lookups, topic mastery, companion requests), and
  cannot postpone another student's reviews or delete their history.
- **Database audit** (local, after an upgrade from the old production
  schema): every table has row level security; every `security definer`
  function pins `search_path`; students cannot write `learning_events`,
  `topic_mastery` or `mastery_rules` at all — only the database does, from
  real actions.
- **Scores, dates and ownership** are set by the database: answers are marked
  by `record_practice_answer`, estimates by `refresh_topic_mastery`, review
  dates by `postpone_review`, deletions by `delete_my_learning_events` (own
  rows only).
- **AI input.** The companion reads the student's own rows on the server with
  their session; the browser only names topics and reason codes, both
  checked against fixed lists. No name, email, account id or typed text is
  sent to the model (checked by a test). Output is shown as plain text,
  labelled AI-generated and unchecked; plans are kept only when sound.
- **Hardened (11.2):** the messaging and account functions can no longer be
  called by visitors at all (they already scoped their work to `auth.uid()`).
  What visitors can still call: policy helpers, search, the sign-up username
  check, the live quiz clock and two validation helpers.
- **Accepted:** deleting your own history also lowers the count the 500
  answers-a-day limit uses; it affects only the student's own data.

## Performance (slow phone)

Production build, local Supabase, 360×740, ~50 KB/s each way with 400 ms
latency, CPU slowed 4×, a student with 600 answers. Time until the main
content shows:

| Page | First visit | Cached | API data |
| --- | --- | --- | --- |
| BacII + Study next | 10.6 s | 3.8 s | 48 KB |
| My learning | 10.1 s | 4.4 s | 48 KB |
| Topic page | 9.3 s | 3.8 s | 44 KB |
| Adaptive practice (first question) | 13.7 s | 6.8 s | 168 KB |
| Exam readiness | 13.2 s | 6.9 s | 224 KB |

No page scrolls sideways at 320–375 px. Fixed in this phase: My learning no
longer downloads the event history (224 → 48 KB of API data); practice reads
only the last 30 days. Local Supabase does not compress API responses; the
hosted one does, so live transfers are smaller. Learning pages are separate
chunks of 2–4 KB gzipped.

## AI cost review

No new provider or paid service. Every AI call uses the existing Gemini key
(free tier) or Claude only if `ANTHROPIC_API_KEY` is set.

| Feature | AI calls per use | Allowance |
| --- | --- | --- |
| Video finder | 2 (read + rank) + up to 2 YouTube searches (100 units each, cached 24 h) | `BACII_DAILY_LIMIT` (20) lookups a day per student, shared with photo to solution |
| Photo to solution | 1 to read, 1 to solve | same allowance |
| Video quiz drafts | 1 | admins only |
| AI companion | 1 (≈1–2k tokens in, ≤300 out) | `BACII_COMPANION_LIMIT` (10) a day per student |
| Everything else in the Learning OS | 0 — rules only | — |

Worst case per active student per day: about 50 AI calls (20 lookups × 2 +
10 companion). Gemini's free tier has per-model daily limits (see Google AI
Studio for the current numbers); when one model is out of quota the function
tries the next free model, then tells the student and the companion falls
back to its rules version. YouTube's 10,000 units a day cover about 50
uncached lookups across all students. Lower the two limits in Vercel if
usage grows before any paid plan is considered (owner approval needed).

## Known limitations

- **Content.** 12 demo questions (9 automatically marked) — adaptive practice,
  readiness and estimates are thin until real, checked questions are added.
  The curriculum outline and the 40 topic links are provisional.
- **Khmer wording** written by Meh Rean (not checked): topic names flagged in
  the curriculum review, Study next reasons, page titles (My learning,
  adaptive practice, journey, revision, readiness, companion, history).
- **Estimates are product rules**, not a validated measure; readiness is never
  a BacII prediction. Trends and history use the latest 1000 events.
- **"Not now"** on Study next is remembered per device only.
- **Bundle.** The main chunk is 780 kB (232 kB gzipped), slightly up from
  ~756 kB before the Learning OS; splitting it is a separate task.
- **My learning is not the site's Home**; the Home feed is unchanged (owner
  decision).
- **Tests.** Playwright checks are run by hand against local servers (see
  TESTING.md); the accounts suite's realtime check needed a settle time after
  a cold local Realtime start (fixed in the test).

## Owner decisions open

1. Make My learning the home page for students.
2. A native Khmer speaker (ideally a teacher) to check the Khmer wording and
   the provisional curriculum and topic links.
