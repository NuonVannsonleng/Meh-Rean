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
- Not now (4.4): skipped until it expires unless `reasonSignature()` —
  kind, main reason and its review count, label or topic — changes.
- Action (4.3): reviews due → the notebook; else practice questions; else
  a checked video; else a linked note; nothing → skipped (takes no place).

## Adaptive practice (5.1)

Code: `src/lib/adaptive.ts`. Numbers: `src/data/learning/adaptive-rules.json`
(version 1). Tests: `npm run test:adaptive`.

- Start: `1 + floor(estimate/25)` within 1–5; no estimate → 2.
- After each answer: +1 when right, −1 when wrong, within 1–5.
- Next question: multiple-choice or numeric, on a target topic, not yet
  asked this session; score `3 × 1/(1 + topic position) + 2 × (1 − |difficulty − target|/4)
  + 1 × freshness` (never answered 1, else days since/30, at most 1);
  answered within 3 days only when nothing else is left; ties by id.
- Modes (5.2, rules version 2): recommended 10 and quick 5 (Study next
  ranking), weak 10 (weakest first, stays on a topic), prerequisites 8
  (nearest first), mixed 10 (chapters in turn), exam 15 (all topics weakest
  first, difficulty +1). With spreading, the next pick prefers topics asked
  less this session.

## Learning journey (6.1)

Code: `src/lib/journey.ts`. Numbers: `src/data/learning/journey-rules.json`
(version 1). Tests: `npm run test:journey`.

- Done: label Strong or Consistently strong. Next up: the first 3 of the
  Study next ranking that are not done. In progress: any answer. Ready: no
  answers, direct prerequisites in place. Builds on earlier topics: a direct
  prerequisite not yet labelled, Needs foundation or Developing — shown,
  never enforced.
- Milestones: first answer; 1, 5, 10, 20 topics practised; 1, 5, 10
  strong; every topic of a chapter practised; no reviews waiting (once there
  has been a mistake). Worked out each time.

## Revision queue (7.1, 7.2)

Code: `src/lib/revision.ts`. Numbers: `src/data/learning/revision-rules.json`
(version 1). Tests: `npm run test:revision`.

- Due: notebook entries whose review date has passed. Priority = 1 + 2 ×
  min(1, days overdue/7) + 1.5 × min(1, (times wrong − 1)/2) + 1.5 ×
  weakness of its topic when "Needs foundation"/"Developing" + 1 when its
  topic is a direct prerequisite of such a topic; × (1 + 0.5 × (1 −
  days/60)) when the exam is within 60 days. Ties: earlier due, then id.
- Coming up: due within 7 days, by date.
- Postpone (database `postpone_review`): 1, 3 or 7 days from the later of
  now and the due date; at most 5 times per entry.

## Study companion without AI (8.1)

Code: `src/lib/companion.ts`, `src/lib/companionText.ts`. Numbers:
`src/data/learning/companion-rules.json` (version 1). Tests: `npm run test:companion`.

- Plan for N minutes (rounded to 5; default 30): reviews first, 3 minutes
  each, rounded to 5, at most 40% of the time; then up to 3 Study next
  topics in order (notebook-only ones are covered by the review step):
  video 10 minutes, note 10, practice shares what is left in 5-minute
  steps; with nothing to practise the time goes to reviews or free
  practice; from 45 minutes a 5-minute break in the middle. Steps always
  add up to N.
- Summary facts: topics practised and done (Strong+), last 7 days'
  answers, share right and active days, the 3 weakest labelled topics and 3
  strongest, reviews due, days to the exam.
