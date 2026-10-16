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
