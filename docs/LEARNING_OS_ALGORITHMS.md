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
- Missing prerequisites: those not yet labelled (< 3 answers), "Needs
  foundation" or "Developing" (`needsWork` in `src/lib/mastery.ts`).
- Topic results: only the first attempt at each question per Cambodia day
  counts (SQL `my_topic_results()`, TS `topicResultsFromEvents()`).

## Mastery (3.1)

Code: `src/lib/mastery.ts`. Numbers: `src/data/learning/mastery-rules.json`
(version 1; a change to a number bumps the version). Tests: `npm run test:mastery`.

- **Evidence:** marked answers from practice, the daily question, mock exams
  and notebook reviews. Only the first attempt at a question per Cambodia day
  counts, so retrying until right does not inflate it. Videos, notes and
  self-reported marks are never evidence. Duplicate events count once;
  answers are applied oldest first.
- **Unknown** until the first answer (no score shown).
- **Update:** `score += step × (target − score)`, from a prior of 50; target
  100 when right, 0 when wrong.
  - `step = max(0.1, 1/(n+2))` where n is earlier evidence: the first answer
    gives 75 or 25, then it behaves like a smoothed share right, and the 0.1
    floor keeps recent answers counting (recency).
  - Difficulty (1–5, missing = 3): `step × (1 + 0.15 × s)`, where s is
    `difficulty − 3` for a right answer and `3 − difficulty` for a wrong
    one, so a hard right answer or an easy wrong one moves it more. Capped
    at 0.6.
- **Confidence (0–1):** `n/(n+5) × 0.5^(days since last answer / 30)`.
  Below 0.34 is low, below 0.67 medium, otherwise high. Time lowers
  confidence, never the score.
- **Stored (3.3):** `topic_mastery` keeps score, evidence, right answers,
  last answer and rule version; `refresh_topic_mastery()` in
  `supabase/schema.sql` mirrors the update above.
- **Labels** (version 2: none before 3 answers, "Not enough answers yet"):
  0–24 Needs foundation · 25–49 Developing · 50–74 Practising ·
  75–89 Strong · 90–100 Consistently strong (needs at least 6 answers) —
  product labels, not standards.

## Recommendations (4.1, 4.2)

Code: `src/lib/recommend.ts`. Numbers: `src/data/learning/recommendation-rules.json`
(version 1). Tests: `npm run test:recommend`. Score = weight of the kind ×
strength (0–1, reviews up to 1.5):

| Kind | Weight | Strength |
| --- | --- | --- |
| Due reviews | 3 | `min(1, due/3) + 0.5 × min(1, days overdue/7)` |
| Weak prerequisite of a weak topic | 2.5 | `(1 − topic score/100) × (0.5 + 0.5 × prerequisite weakness)`; no estimate counts as 0.5 |
| Weak topic ("Needs foundation", "Developing") | 2 | `(1 − score/100) × (0.5 + 0.5 × share of its prerequisites in place)` |
| Too few answers for an estimate | 1.5 | `answers / 3` |
| Not practised for 14+ days (labelled) | 1 | `min(1, days/28)` |
| New, prerequisites in place, in study order | 1 | `1/(1 + position)` |

- Exam within 60 days: reviews, prerequisites and weak topics × `1 + 0.5 ×
  (1 − days/60)`, with the reason.
- Practised today (Cambodia day) and no reviews due: × 0.5.
- One recommendation per topic (strongest kind, all reasons); ties in
  curriculum order; at most 2 per chapter and 5 in all.
