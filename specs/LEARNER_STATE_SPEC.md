# Aprendo Learner State Spec

## Purpose

This document defines how Aprendo should track student progress in V1.

The learner-state layer transforms raw question attempts into structured progress signals that power:

- results views
- weak-area detection
- recommendation inputs
- review flows

## Core Principle

Progress should be computed from explicit student attempts, not inferred from tutor conversations or opaque memory systems.

## Canonical Inputs

The learner-state layer depends on:

- completed `QuestionAttempt` records
- session type (`diagnostic`, `practice`, `review`)
- question taxonomy metadata
- question answer metadata

## Canonical Raw Event

### QuestionAttempt

The `QuestionAttempt` is the primary raw event.

Each completed attempt should capture:

- who answered
- which question was answered
- in which session
- which option was selected
- whether it was correct
- how long it took
- whether hints or tutor help were used
- whether the question was skipped

This is the canonical evidence for all later progress calculations.

## Aggregation Levels

V1 progress should be aggregated at three levels:

1. Overall student performance
2. Subject performance
3. Primary subtopic performance

Secondary subtopics may be added later, but V1 should anchor recommendations to primary subtopics for simplicity.

## Required Metrics

For each aggregate level, the system should track:

- `attemptCount`
- `correctCount`
- `accuracy`
- `recentAttemptCount`
- `recentAccuracy`
- `avgResponseTimeMs`
- `hintRate`
- `tutorRate`
- `lastAttemptAt`

These metrics support both analytics and recommendation logic.

## Evidence Semantics

The system should distinguish weak performance from low evidence.

Examples:

- low accuracy with many attempts means likely weakness
- low accuracy with very few attempts means insufficient evidence
- high accuracy with heavy hint usage may indicate shallow mastery

V1 should expose an `evidenceLevel` or similar field on aggregates.

## Mastery Signal

V1 should compute a simple derived `masteryScore` for each subject and subtopic.

This score should be a blended operational measure, not a formal psychometric claim.

The score should reflect:

- recent accuracy
- overall accuracy
- amount of evidence
- help dependence

The exact formula can evolve later, but the architecture should assume `masteryScore` exists as a first-class derived field.

## Diagnostic Role

The diagnostic exam initializes the learner model.

After a diagnostic session, the system should produce:

- baseline overall performance
- baseline subject performance
- initial subtopic signals where enough evidence exists

Because diagnostics are relatively short, early subtopic conclusions should be conservative.

## Practice Role

Practice sessions should update learner state more frequently than diagnostics.

Practice attempts should:

- reinforce or weaken subtopic mastery estimates
- surface repeated mistake patterns
- track whether progress is improving over time

Practice attempts with tutor usage are still valid, but help usage should influence interpretation.

## Review Role

Review sessions should count as learning interactions, but they should not overpower diagnostic and standard practice performance signals.

V1 guidance:

- include review attempts in history
- keep session type visible in raw data
- allow later weighting differences in aggregate formulas

## Update Model

The learner-state layer should update after every completed question attempt or after each completed session.

V1 recommendation:

- persist the raw attempt immediately
- recompute affected subject and subtopic aggregates shortly after

This keeps the system responsive without forcing heavy recomputation on every UI request.

## Required Read Models

The backend should support these read patterns:

- student baseline after diagnostic
- current overall summary
- current subject breakdown
- current weakest subtopics
- recent mistakes
- trend snapshots for results views

## Weakness Detection

V1 should identify weak areas using a combination of:

- low mastery score
- sufficient evidence
- recent incorrect attempts

The system should avoid declaring a subtopic weak based on a tiny sample.

## Improvement Detection

The system should also identify positive change.

Useful V1 signals:

- recent accuracy improves over overall accuracy
- response time decreases while correctness stays stable
- hint usage declines in a previously weak area

These can support product copy like:

- "You are improving in algebra"
- "Reading inference is still weak"

## Tutor Usage Semantics

Tutor usage should not invalidate attempts, but it should remain visible in the learner model.

V1 tracked signals:

- `usedTutor`
- `tutorMessageCount`
- `usedHint`
- `hintCount`

This matters because correctness achieved only with frequent help should not be treated the same as independent correctness.

## History Retention

The system should keep raw attempt history, not only rolling aggregates.

This is required for:

- debugging recommendation behavior
- recomputing aggregates later
- building future trend and mastery models

## Out Of Scope

This document does not define:

- the exact mastery formula
- exact recent-window size
- final dashboard visualizations
- psychometric calibration or IRT

## ICFES performance level

Alongside `masteryScore`, the learner state exposes a **performance level per
area** using the official ICFES scale (levels 1-4; CEFR bands for Inglés).

It is derived, not stored:

- score = the subject aggregate's accuracy on the 0-100 scale
- band = `levels.getLevelForScore(subjectId, score)`
- baseline = the most recent completed `nivelacion` for that area, falling back
  to `diagnosticBaseline` for students placed before per-area levelling

The evidence rule from this document applies directly: below
`MIN_ATTEMPTS_FOR_LEVEL` graded attempts in an area, **no level is claimed**.
`masteryScore` stays the recommendation signal; the level is the
student-facing language.
