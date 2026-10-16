# AI Learning OS — algorithms

Every rule here is deterministic, configurable and tested. Estimates are
labelled as estimates; none is a validated measure of ability.

## Existing rules reused

- Weakest chapter (daily question): lowest (right + 1) / (answered + 2).
- Reviews: 1, 3, 7, 14 days; wrong → tomorrow; right when due → next interval.
- Study plan weights: weak chapters × 2, others by target grade.

## Learning profile indicators (1.4)

- A chapter is described only after **3** marked answers in it.
- Smoothed share right = (right + 1) / (answered + 2). **≥ 0.75**: "going
  well"; **≤ 0.5**: "worth more practice"; ties sorted by more evidence.
- Activity: the last 7 days of the student's own answer events (practice,
  reviews, exams); self-reported marks and ticks are not answers.
- Rules in `PROFILE_RULES` (`src/lib/learningProfile.ts`), tested by
  `npm run test:learning-profile`.

## Knowledge graph (2.1)

- Prerequisites and dependents: breadth-first, nearest first, at most 10 steps.
- Study order: topological (Kahn) with ties broken by curriculum order.
- Map level: longest chain of prerequisites before a topic.
- Missing prerequisites: those whose status is unknown (< 3 answers) or
  "worth more practice".
- Topic results: only the first attempt at each question per Cambodia day
  counts (SQL `my_topic_results()`, TS `topicResultsFromEvents()`).

## Mastery (Phase 3 — draft, to be finalised with tests)

- Unknown until the first marked answer on a topic.
- Only the first attempt at a question per day counts as evidence, so
  retrying a question until it is right does not inflate the estimate.
- Score 0–100, updated per marked answer: `score += k × (target − score)`,
  target 100 when right, 0 when wrong; `k` shrinks as evidence grows (one
  answer cannot swing it far) and depends on difficulty (a right answer to a
  hard question, or a wrong one to an easy question, moves it more).
- Evidence count and confidence stored; confidence falls with time since the
  last practice. Videos and notes are never evidence.
- Labels: 0–24 Needs foundation · 25–49 Developing · 50–74 Practising ·
  75–89 Strong · 90–100 Consistently strong — product labels, not standards.

## Recommendations (Phase 4 — to be designed)

Candidates scored by weakness, prerequisite readiness, review urgency,
exam proximity and time available; each with a reason.
