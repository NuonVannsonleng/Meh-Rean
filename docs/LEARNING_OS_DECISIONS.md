# AI Learning OS — decisions

## 2026-10-16 — Topics are the concepts, for now

The prompt proposes a `learning_concepts` table. Today it would copy
`curriculum_topics` one-to-one (34 provisional topics). Inventing finer
concepts would mean writing curriculum facts nobody has checked. So topics
are the concept nodes; questions already carry `topic_id`. A concept table
is added when checked concept-level content exists.

## 2026-10-16 — Reuse the existing specialists

Fourteen `meh-rean-*` agents already cover architecture, frontend, backend,
database, AI, testing, debugging, security, design, performance, curriculum
and documentation. Duplicating them as `learning-os-*` would split
instructions. Only the orchestrator, learning-intelligence and
knowledge-graph roles were added.

## 2026-10-16 — Limits that protect students from floods (security review)

Self-reported events ≤ 200 a day, practice answers ≤ 500 a day, live-game
joins ≤ 30 per 10 minutes, ≤ 50 live quizzes, ≤ 5 topics per note. These
are well above normal use and stop one account (or a script) filling the
free-tier database or burying a student's own history. Live quiz players
see a per-game id, never each other's accounts, because many are minors.

## 2026-10-16 — Practice answers carry a request id

A phone on a weak connection may send the same answer twice. The practice
function now takes an optional request id and claims it as the event's
idempotency key before marking: the duplicate returns the first result and
changes nothing (mistake count, review stage, chapter results, events).
Older clients that send no id still work; each call is then its own answer.

## 2026-10-16 — The database writes learning events

Events come from the functions that already mark answers (`note_answer()`
and friends), with idempotency keys, so a browser cannot invent activity
and a retry cannot count twice. Self-reported actions are recorded as such
and are not mastery evidence.

## 2026-10-16 — The links seed follows the file only for untouched drafts

A link that is still provisional with the draft's source is the seed's to
change: re-running `supabase/setup-all.sql` adds new links, updates the
source and removes links dropped from the file. A link an admin added
(empty source) or checked (any other status or source) is left alone, so a
teacher's review is never undone by a deploy.

## 2026-10-16 — Mastery is computed by the database, replayed per topic

Estimates are stored by the database, never sent by the browser (AGENTS
rule 4). Each marked answer replays that student's evidence on that topic
from the start rather than applying one step, so late or out-of-order
events and rule changes cannot leave a drifting value; a topic has at most
a few hundred answers, so this stays cheap. The SQL and `src/lib/mastery.ts`
implement the same rules and a test holds them equal; the numbers come
from one JSON file through the seed. Confidence and labels depend on
today's date and are worked out when read.
