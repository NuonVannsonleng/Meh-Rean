# Decisions

Short records of choices that shape the code. Newest first.

## 2026-10-13 — Curriculum lives in JSON, seeded into Postgres

The curriculum is edited as nested, bilingual JSON in
`src/data/curriculum/` and loaded into five tables by a generated, idempotent
SQL seed. Why: one source for both backends; easy for a curriculum reviewer to
edit; the database still enforces structure, RLS and "no verified without a
source". The seed never deletes rows, so questions linked to a chapter are not
lost when an entry is renamed or removed; deletions are done by hand.

Ids are stable slugs (`kh-grade12-science-mathematics-integrals`), not UUIDs,
so seeds, URLs and questions can refer to them across environments.

## 2026-10-13 — Unverified curriculum is labelled, not withheld

No official MoEYS source was available, so Grade 12 Science Mathematics is
seeded as a **provisional** outline. Every entry carries `verification`
(`verified` / `provisional` / `needs-review`) and a `source`; the database
refuses `verified` without a source. The UI must show provisional content as
such.

## 2026-10 — AI provider: Gemini by default, Claude optional

The video finder uses Google Gemini's free tier unless `ANTHROPIC_API_KEY` is
set. Models fall back in order when busy or out of quota, within a 50-second
budget. Why: the owner chose a free option; Claude stays available for higher
quality.

## 2026-10 — Official logos are hotlinked through wsrv.nl

Logos not on Wikimedia Commons are loaded live from schools' own sites through
the wsrv.nl image CDN, never copied into the repository. Why: avoid
republishing copyrighted files while keeping small, fast images.
