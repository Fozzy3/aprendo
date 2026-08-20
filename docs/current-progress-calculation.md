# Current Progress Calculation

## Purpose

This document explains how Aprendo currently calculates student progress in the codebase.

It describes the implementation that exists today, not the ideal future mastery model.

The current logic lives mainly in [progress.ts](/Users/julian/Dev/aprendo/packages/convex/src/progress.ts) and is triggered from [diagnostics.ts](/Users/julian/Dev/aprendo/packages/convex/src/diagnostics.ts) when a diagnostic session is completed.

## High-Level Flow

Current progress calculation works like this:

1. A student completes a diagnostic session.
2. Each answered question is stored as a `questionAttempts` record.
3. When the diagnostic is completed, the backend calls `rebuildStudentProgress`.
4. `rebuildStudentProgress` reads all completed attempts for that student.
5. It joins each attempt with the corresponding question metadata.
6. It recomputes:
   - overall summary
   - subject-level aggregates
   - primary-subtopic aggregates
   - learner profile snapshot

The system does not currently update progress incrementally per field. It rebuilds the student's derived progress state from raw attempts.

## Source Of Truth

The canonical source of truth is:

- `questionAttempts`

Derived progress state is computed from those attempts and stored in:

- `learnerSubjectAggregates`
- `learnerSubtopicAggregates`
- `learnerProfileSnapshots`

## Which Attempts Count

An attempt is included in progress rebuilding only if:

- `isCorrect` is not null
- `answeredAt` is not null

Attempts are also ignored if the related question is missing required taxonomy metadata:

- `subjectId`
- `categoryId`
- `primarySubtopicId`

This means progress currently depends on both:

- completed attempts
- successful taxonomy tagging

## Aggregation Levels

The current implementation computes progress at three levels:

### 1. Overall

Built from all valid completed attempts for the student.

Used to populate:

- `learnerProfileSnapshots.overallSummary`

### 2. Subject

Attempts are grouped by `question.subjectId`.

Used to populate:

- `learnerSubjectAggregates`

### 3. Primary subtopic

Attempts are grouped by:

- `question.subjectId`
- `question.primarySubtopicId`

Used to populate:

- `learnerSubtopicAggregates`

Note:

- only the primary subtopic is currently used for aggregation
- secondary subtopics are not yet used in progress calculations

## Metrics Currently Computed

For both subject and subtopic aggregates, the backend computes:

- `attemptCount`
- `correctCount`
- `accuracy`
- `recentAttemptCount`
- `recentAccuracy`
- `avgResponseTimeMs`
- `hintRate`
- `tutorRate`
- `lastAttemptAt`
- `masteryScore`
- `evidenceLevel`

## Metric Definitions

### `attemptCount`

Total number of included attempts in the group.

### `correctCount`

Number of attempts where `isCorrect === true`.

### `accuracy`

Calculated as:

```text
correctCount / attemptCount
```

If `attemptCount` is `0`, accuracy is `0`.

### `recentAttemptCount`

Number of attempts in the recent window.

Current recent window:

- the last 5 attempts in chronological order

### `recentAccuracy`

Calculated only over the recent window:

```text
recentCorrectCount / recentAttemptCount
```

If `recentAttemptCount` is `0`, recent accuracy is `0`.

### `avgResponseTimeMs`

Average of positive finite `responseTimeMs` values in the group.

If there are no valid times, the value is `0`.

### `hintRate`

Calculated as:

```text
attempts_with_usedHint / attemptCount
```

### `tutorRate`

Calculated as:

```text
attempts_with_usedTutor / attemptCount
```

At the moment, tutor usage is always `false` in the diagnostic flow, so this will normally be `0` right now.

### `lastAttemptAt`

Timestamp of the most recent attempt in the group.

### `evidenceLevel`

Current rule:

- `high` if `attemptCount >= 6`
- `medium` if `attemptCount >= 3`
- `low` otherwise

This is a simple heuristic to distinguish weak performance from low evidence.

## Current Mastery Score

The current implementation uses a lightweight blended score:

```text
masteryScore =
  recentAccuracy * 0.55
  + accuracy * 0.4
  + evidenceBoost
  - hintRate * 0.08
  - tutorRate * 0.04
```

Where:

```text
evidenceBoost = min(attemptCount / 6, 1) * 0.05
```

The final value is clamped between `0` and `1`.

Interpretation:

- recent performance matters slightly more than overall performance
- more evidence gives a small boost
- heavy help usage slightly reduces the score

This is an operational heuristic, not a psychometric or IRT model.

## How Weak Areas Are Derived

Weak areas are currently derived by sorting aggregates by `masteryScore`.

For example:

- weakest subjects are the subjects with the lowest mastery score
- weakest subtopics are the subtopics with the lowest mastery score

The progress page currently shows:

- overall baseline summary
- subject-level performance
- the weakest subtopics

## Learner Profile Snapshot

After rebuilding aggregates, the backend writes a `learnerProfileSnapshots` document containing:

- `strongestSubjectIds`
- `weakestSubjectIds`
- `weakestSubtopicIds`
- `diagnosticBaseline`
- `overallSummary`

The diagnostic baseline is taken from the latest completed diagnostic session summary, if one exists.

## Important Current Limitations

The current progress model is intentionally simple.

Limitations:

- it is currently driven only by diagnostic attempts
- it does not yet include practice attempts
- it uses only primary subtopics
- it fully rebuilds aggregates instead of incrementally updating them
- it does not weight session type differently
- it does not account for question difficulty
- it does not use longitudinal trend windows beyond the last 5 attempts

## Practical Reading Of The Current Output

Today, progress should be interpreted as:

- an initial baseline after the diagnostic
- an approximate subject/subtopic signal
- a useful but still coarse ranking of strengths and weaknesses

It should not yet be interpreted as:

- a mature mastery model
- a stable long-term proficiency estimate
- a recommendation-quality signal for adaptive practice beyond simple prioritization

## Related Files

- [progress.ts](/Users/julian/Dev/aprendo/packages/convex/src/progress.ts)
- [diagnostics.ts](/Users/julian/Dev/aprendo/packages/convex/src/diagnostics.ts)
- [LEARNER_STATE_SPEC.md](/Users/julian/Dev/aprendo/specs/LEARNER_STATE_SPEC.md)
