# Decisions

Short records of choices that shape the code. Newest first.

## 2026-10-13 — Question images are stored by path, not URL

`questions.images` keeps only `{ path, alt }`; the app builds the address
from the path with the storage bucket's public URL. The database accepts only
`<admin id>/questions/<uuid>.(png|jpg|webp|gif)` paths for newly added
images, and storage policies let only admins upload there, only those
extensions. Why: no URL (javascript:, data:, another site) can ever be
stored; a non-admin cannot swap a picture in a checked question; and images
survive a change of project address. Deleting a question leaves its files in
storage (harmless; can be cleaned up later).

## 2026-10-13 — Questions are saved by one database function

`save_question(target, question, solution)` writes both rows in one
transaction as the calling admin (security invoker), so a question never
exists without its answer and every policy and trigger still applies. It is
the only write path the app uses for questions.

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

## 2026-10-13 — Video caching without a service key

A shared database cache of YouTube results would have to be writable with a
student's session (there is no server-only key, by design), letting anyone
plant fake titles for others. So the shared cache is in the server's memory
(reused while a Vercel instance is warm), and each student's own recent
lookups are cached in their browser. The quota count does use the database:
students can only add their own rows of 1–2 searches, so the worst misuse is
making the display look busier, never hiding real use.

## 2026-10-13 — Study plans are built in the browser and owned by the student

Unlike scores, a study plan is the student's own notes: nothing is gained by
forging one, and they must be free to change every item. So the plan is
generated in the browser (`src/lib/studyPlan.ts`, rules in
`src/data/study-plan.json`) and the student writes their own row in
`study_plans` under RLS; the database checks only settings ranges, size, and
that a newly chosen exam date is ahead. No BacII date is assumed or
suggested: the student types the date announced by MoEYS. The weights (weak
chapters ×2, other chapters by target grade) are Meh Rean rules of thumb and
the page says the plan is a suggestion, not an official schedule.

## 2026-10-13 — Daily question: weakest chapter by smoothed accuracy; gentle streak

"Weakest chapter" is the lowest (right + 1) / (answered + 2) over the
student's marked answers, kept per chapter in `chapter_progress` (also the
base for later progress pages). Smoothing stops one lucky or unlucky answer
from deciding, and makes an untried chapter count as half right, so known
weaknesses come first. The pick happens once per day on the server and is
stored, so reloading or a second device shows the same question. Days follow
Asia/Phnom_Penh. The streak counts days answered, right or wrong — it rewards
showing up; there are no notifications or loss warnings.

## 2026-10-13 — Spaced repetition: fixed steps, scheduled on the server

A simple Leitner-style schedule rather than an adaptive algorithm (SM-2 and
similar): reviews 1, 3, 7 and 14 days apart, as the roadmap asks. A wrong
answer starts again from tomorrow; a right answer passes a review only when
one is due, because retrying straight after reading the solution shows
little. After the fourth review the question counts as learned. The schedule
is set in `note_answer` (server clock, not the browser); the browser-only
store and the page use the same rules from `src/lib/review.ts`, and
`npm run test:review` fails if the two lists of intervals differ.

## 2026-10-13 — The mistake notebook is written by the server

Mistakes come from marking, so they are recorded where marking happens:
`mark_exam_attempt` and `record_practice_answer`, both using
`answer_matches`. Students can read and delete their entries but not write
them. Practice keeps instant feedback from the (public) answer key and then
records on the server; the server's verdict wins if they differ. A blank
mock-exam answer counts as a mistake (worth reviewing); worked problems never
do, since nobody marked them. `record_practice_answer` refuses questions on
the student's running mock exam so it cannot be used to test exam answers.
One row per student and question (times wrong counts repeats); answering
right sets `fixed_at`, getting it wrong again clears it.

## 2026-10-13 — Grade estimates use labelled practice bands

No official BacII grade boundaries were available to cite, so the bands in
`src/data/grade-scale.json` are Meh Rean's own (A 90, B 80, C 70, D 60,
E 50, F below), marked `provisional` with no source. The UI calls the result
a practice estimate whenever the scale is not verified with a source. Only
automatically marked points count; worked problems are named as left out.
Percentages are floored to one decimal so a grade never sits next to a
percent that looks like the band above. Estimating runs in the browser: it
only interprets a score the database already computed.

## 2026-10-13 — Mock exams are timed and marked by the database

The browser shows a clock but decides nothing. `start_exam` sets the
deadline from the server clock; `save_exam_answer` refuses answers after it
(and closes the attempt, returning `'time-up'` instead of raising, so the
marking is not rolled back); `mark_exam_attempt` scores from the answer key
and cannot be called directly. Students cannot write attempt or answer rows.

During a student's own running attempt, the select policy on
`question_solutions` hides that paper's answer key from them everywhere
(practice and paper pages too). Admins are exempt, so editing a question
mid-exam cannot lose its solution. This stops casual peeking; it is not exam
security (a signed-out window still shows solutions), which is acceptable
for a practice tool.

Durations: only a paper's `duration_minutes` with a `duration_source` counts
as official. Otherwise the student chooses a practice time, labelled as
such. Worked problems are not auto-marked; they are counted as "to check
yourself" and left out of the score and the maximum.

## 2026-10-13 — Solutions in their own table, readable by everyone for now

Update (2.4): now hidden during the student's own mock exam; see above.

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
