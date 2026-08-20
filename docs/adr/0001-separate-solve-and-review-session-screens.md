# ADR 0001: Separate Solve And Review Session Screens

## Status

Accepted

## Context

Aprendo has several student-facing question flows:

- diagnostic exam
- practice sessions
- future simulated exams

These flows share a common lifecycle:

1. The student completes a timed or focused question set.
2. The system records attempts and scores the session.
3. The student reviews results, explanations, and mistakes.
4. The tutor may help the student learn from completed questions, subject to session rules.

The active solving experience and the review experience have different product goals.

During solving, the student should focus on answering questions without answer disclosure or distracting feedback. During review, the student should see correctness, explanations, session-level results, and tutor support.

## Decision

Aprendo will separate active solve screens from review screens.

Practice will use this route shape:

- `/practice`: practice entry point and start screen
- `/practice/$sessionId`: active practice solve mode
- `/practice/$sessionId/review`: completed practice review mode

The review screen should be designed as a reusable session review experience, not as a practice-only page. The same review surface should later support:

- `/diagnostic/$sessionId/review`
- `/simulated-exam/$sessionId/review`

The UI should use a common review contract across session types:

- session type
- session status
- summary score and duration
- ordered questions
- attempts
- correct answer and explanation
- subject/subtopic metadata
- tutor availability for the completed session

## Product Rules

Active solve mode:

- presents one question at a time in a minimal focused interface
- records answers and navigation state
- does not show correct answers
- does not show official explanations
- does not show correctness feedback
- follows tutor availability rules for the session type

Review mode:

- requires a completed session
- shows correctness and selected answers
- shows correct answers and explanations when available
- supports question-by-question navigation
- supports tutor help when the session type allows review tutoring
- can summarize performance across subjects and subtopics

Tutor availability:

- diagnostic solve mode: tutor disabled
- practice solve mode: tutor may provide hints, but must not reveal the answer
- simulated exam solve mode: tutor disabled
- review mode: tutor may explain answers and help with mistakes

## Consequences

This avoids mixing scoring, solving, and learning states in one UI.

It also gives future exam modes a clear implementation path. New session types can provide a specialized solve screen while reusing the shared review screen after completion.

Backend queries and tutor context must preserve this boundary. Correct answers and official explanations should only be returned to client or tutor contexts when the student is in an allowed review state.

## Open Questions

- Whether shared review routes should be implemented as separate route files per session type or as a generic internal component used by multiple routes.
- Whether review sessions need their own persisted `review` session records, or whether review is a presentation mode over a completed diagnostic/practice/simulated-exam session.
- How much subject-level summary belongs in the review screen versus the broader progress dashboard.
