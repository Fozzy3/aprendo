# ADR 0002: Immediate Feedback And The Guided Path

## Status

Accepted. Narrows two rules of ADR 0001; the rest of it stands.

## Context

ADR 0001 says active solve mode does not show correct answers, explanations or correctness feedback, and that review mode shows them.

Two things in the product already go past that, or do so on purpose now:

- Practice kinds support `feedbackMode: 'inmediata'` ("Comprobar"), which has graded a question during solve since the first practice work (F31).
- A student who was told the answer at once stayed passive. Plan F56 replaces that moment with the guided path: after a wrong answer the app asks instead of telling.

Neither was written down, and the first is what makes the second possible.

## Decision

### Exception 1: `inmediata` practice

Where `canCheckAnswers(session)` is true, solve mode may grade one answered question at a time. The student has to ask for it ("Comprobar"), and doing so locks that answer.

`canCheckAnswers` requires both the stored `feedbackMode` and the kind's `allowsImmediateFeedback`. The kind decides, so a forged mode cannot open an exam.

### Exception 2: the guided path

On those same kinds a wrong answer does not show the correct option or the explanation. It opens a path:

1. "Todavía no", with no key.
2. The diagnosis: why the student chose that option, with tappable reasons.
3. Up to three tappable questions, fewer as mastery rises.
4. One retry.
5. The answer, only at the end or after "Muéstrame", which appears after the first step.

`sessions.checkAnswer` returns `correctOption: null` and `guidedPathOpen: true` while the path is open. `getSession` keeps the question sealed until `guidedPathEnded`. The path's progress lives on the attempt, so a reload resumes it and no step can be requested out of turn.

Only the first answer is evidence. The path records `guidedOutcome` and never writes `selectedOption` or `isCorrect`.

A right answer given as `unsure` or `guess` gets one "¿por qué?" question. A right answer given with confidence moves on.

### Review keeps the answer, one tap later

ADR 0001 still holds: review shows the correct answer. On a wrong item that has a guide, it first offers "Descúbrelo", with "Ver la respuesta" one tap away. An item with no guide shows the answer at once.

## What does not change

- Exams and the reto keep their seals. `nivelacion`, `diagnostic`, `simulacro`, `reto`, `prueba` and any session in `al_final` disclose nothing before the close: no correctness, no guides, no hints, no XP.
- An item a live exam of the same student is asking stays sealed in every other session, because the bank is shared.
- The tutor does not name the option before the path ends.

## Consequences

The solve screen has two modes behind one component. The client rule in `apps/web/src/lib/solve-view.ts` keeps a sealed session on `answering` whatever its cache holds, but the server remains what enforces the seal.

Backend queries and tutor context must keep treating "the path is open" as "the key is sealed".
