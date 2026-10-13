# Decisions

Short records of choices that shape the code. Newest first.

## 2026-10-13 — Maths with KaTeX, loaded on demand; Khmer stays Noto Sans Khmer

KaTeX renders LaTeX in question text (`MathText`). It is imported only when
a text actually contains maths, so pages without maths do not download it
(about 280 kB of script plus fonts); until it arrives the formula shows as
written. Settings for untrusted text: `trust: false` (no `\href`, `\url`,
`\includegraphics`, HTML commands), `throwOnError: false`, `maxExpand`
and `maxSize` limits. Only KaTeX's output is set as HTML.

The roadmap suggested Kantumruy Pro. The app already ships Noto Sans Khmer
(Google Fonts, Khmer subset only downloaded when a page has Khmer), which
renders Khmer and sits well beside KaTeX, so it stays: no second Khmer font
to download on phones and no change to the look.

## 2026-10-13 — Solutions in their own table, readable by everyone for now

Answers and worked steps live in `question_solutions`, not on the question.
For practice they are meant to be seen, so they are public today. Before mock
exams (roadmap 2.4) they must be held back during an attempt — by a select
policy tied to an exam session or by marking in a server function — never by
hiding them in the browser. `isCorrect()` in `src/lib/questions.ts` is for
practice feedback only; exam scores are computed on the server.

## 2026-10-13 — The database guards question integrity

Subject from chapter, topic in chapter, choice ids, https-only images, size
limits, "verified needs a source", demo never verified, past papers need a
year and source, creator and verifier from the session, edits to verified
content send it back to review, no type change once a solution exists, no
moving chapters or topics that have questions. All in triggers and checks in
`schema.sql`, because the admin form (1.4) and any import script go through
the same rules.

Accepted from the security review: `public.stamp_verification()` can be
called over the API. It only returns the caller's own id and the time, and
the triggers need it callable by signed-in users, so it stays.

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
