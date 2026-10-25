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

## 2026-10-15 — Live quiz: the database keeps the clock and the score

Players' phones are not trusted with time or answers. The quiz (with answers)
is readable only by its owner; a running game copies the questions into a
host-only row, and players see a separate state row that gets the right
answer only at the reveal. `live_answer` checks the deadline against the
server clock and scores immediately; points join the scores at the reveal,
and players cannot read whether they were right until then (column-level
grants). Phones show a countdown corrected by a measured server-clock
offset. Realtime pushes changes; a slow poll covers flaky connections.
Anyone signed in may host (the owner's choice); a host keeps one open game
at a time, and games cap at 200 players.

## 2026-10-13 — Video quizzes: admin-supplied transcripts, never stored

"An authorised transcript" can only come from a person who has the right to
use it, so quiz making is an admin task with a required permission note that
students see. The transcript goes to the AI once to draft questions and is
not stored (no copyright copy kept, nothing to leak). AI drafts are never
published unchecked by default: the admin edits them and the quiz shows
whether it was checked. The draft task sits in `api/bacii-videos.ts`, guarded
by `is_admin` with the caller's own token.

## 2026-10-13 — Photo to solution: the student checks the reading; the bank comes first

OCR of handwritten Khmer and maths will make mistakes, so the transcript is
always shown for the student to correct (with a rendered preview) before
anything uses it. Solutions written for Meh Rean's question bank are offered
before any AI one, since they are written for students and can be checked;
matching is plain trigram similarity in the browser, which needs no server
and works for Khmer and LaTeX alike. AI solutions are a last resort, cost a
daily lookup, and are always labelled as unchecked AI output (AGENTS rule
6). The read and solve tasks live in `api/bacii-videos.ts` rather than a new
function, so Vercel has no shared modules to bundle.

## 2026-10-13 — Timestamps only from creators' own chapter lists

No captions or transcripts are fetched: the Data API's captions.download
needs the owner's authorisation and scraping breaks YouTube's terms. The
chapter times creators publish in a video's description are public metadata
from the official API (`videos.list`, 1 unit for up to 50 videos), so those
are parsed and offered to the ranker, which may only choose one of them. The
1-unit calls are not added to the quota display (it counts the 100-unit
searches that matter).

## 2026-10-13 — Trusted channels are chosen by people, not seeded

Which YouTube channels teach BacII well is a judgement Meh Rean should not
invent, so `video_channels` starts empty and admins add channels they have
checked. Trust only reorders within a match level (an exact match from an
unknown channel still beats a related video from a trusted one). Language is
detected from Khmer script in the title or description; students choose
whether Khmer or English videos come first.

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

## 2026-10-19 — The paper exam timer runs on the device, with provisional lengths

The timer is a personal stopwatch for paper practice: it keeps no score the
app relies on, so it runs entirely in the browser (from the wall clock,
saved in `localStorage`) and needs no sign-in or database — unlike mock
exams, whose timing and marking stay in the database. BacII paper lengths
are data with their sources and `provisional` status, because the official
timetable could not be read; a teacher or the Ministry's document should
confirm them before they are marked verified.

## 2026-10-19 — Real past papers are typed exercises from two copies, never the copies' answers

The Ministry's original papers are not online, so real papers are typed from
copies shared online and cross-checked against a second, independent copy
wherever one exists. Only the exercises are kept: the copies' worked
solutions are the compilers' own work (and contain mistakes), so no answer
key is published until a teacher writes or checks one. Papers are
`official` but `needs-review`, name their copies, and record any place the
copies disagree and which reading is used. Each paper keeps the length and
points printed on it, which the timer uses when a student does it on paper.

## 2026-10-19 — Subjects added for their past papers get one labelled chapter

Every question belongs to a curriculum chapter, but only mathematics has a
mapped Grade 12 curriculum. Rather than invent chapter lists for literature,
history, the sciences and languages, each such subject gets one chapter,
"BacII exam questions (not yet sorted into chapters)", marked provisional
like the rest of the curriculum. A teacher can later add the real chapters
and move the questions; nothing else depends on there being only one.

## 2026-10-19 — Past-paper figures ship with the app, not in storage

Question images are normally admin uploads in Supabase Storage, so that no one
else can swap a file under a checked question. Figures of the real past papers
are cropped from the copies and committed in `public/past-papers/` instead:
they are reviewed with the code, cannot be replaced by any user, need no
upload step, and reach the live site with each deploy. The database accepts
only `past-papers/<name>.(png|jpg|webp)` for these, and the app builds the
same-origin address itself, so no outside URL can be stored.

## 2026-10-23 — No email confirmation at sign-up

The owner found the confirmation email annoying for new students, so
**Confirm email** is switched off in the live Supabase project: sign-up
returns a session and the student is signed in at once. The trade-off: an
address is not proven to belong to the person, so a typo or someone else's
address can be used, and password-reset emails only reach a real address.
Usernames, row level security and admin checks do not depend on a confirmed
email. The app supports both settings (`signUp` in `supabaseApi.ts` asks for
confirmation only when no session comes back), so this can be reversed in
the dashboard at any time.

## 2026-10-24 — Neutral look, green only as a highlight

The owner asked for a plain look like other social apps (Instagram keeps its
colour for highlights): white pages and cards, grey lines, near-black ink in
light mode and black/dark grey in dark mode. The logo green stays as the one
signature colour, for primary buttons, active items, links, icons and the
focus ring; it is no longer used as a background. Done through the tokens in
`src/index.css`: the "-50" shades are neutral greys, the teal second colour
became neutral chips (saved state in green), the notebook rules and bookmark
decorations were dropped, and note cards lost their coloured spine (a subject
keeps only its dot). The owner chose to keep green over the purple of their
mockup. The logo itself is unchanged.

## 2026-10-25 — English-only interface until languages arrive

The owner asked for the interface in English only, with other languages to
come. Khmer labels shown beside English (page subtitles, "Title · ខ្មែរ"
headings, the Khmer line on BacII tool cards, timer warnings) are removed,
and places that showed a Khmer name (topics, chapters, subjects, tracks,
paper titles) show the English one. Study next, recommendation reasons and
the companion summary always use English; the learning profile's
"Explanations in" choice is hidden, though the stored preference stays. The
Khmer strings stay in `en.ts` and the curriculum data, ready for a proper
language switch. Khmer content is unchanged: past-paper questions are the
real exam text, and video searches still use Khmer chapter names because
they find Khmer lessons.
