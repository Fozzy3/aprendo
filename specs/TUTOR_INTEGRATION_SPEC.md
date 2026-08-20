# Aprendo Tutor Integration Spec

## Purpose

This document defines how the AI tutor should integrate into Aprendo in V1.

The tutor is a learning aid that helps students during practice and review sessions. It is not part of the scoring or recommendation core.

## Product Role

The tutor should help students:

- understand a question
- get hints without immediately receiving the answer
- review mistakes after answering
- ask conceptual follow-up questions
- request similar problem-solving guidance

The tutor should not:

- participate in the diagnostic exam
- replace formal scoring logic
- become the source of truth for learner progress

## Availability Rules

### Diagnostic

- tutor disabled
- no hints
- no answer explanations during active completion
- tutor may be enabled in post-diagnostic review if the product allows review tutoring

### Practice

- tutor enabled
- hints allowed before answering
- no direct answer disclosure during active completion
- full answer explanations allowed in post-practice review

### Simulated exam

- tutor disabled during active completion
- no hints
- no answer explanations during active completion
- tutor may be enabled in post-exam review

### Review

- tutor enabled
- explanations and conceptual follow-up are first-class features
- review mode is a post-completion state over a scored session, not the active solving surface

## Context Contract

The tutor should receive structured backend context rather than reconstructing state from raw UI text.

Minimum question context:

- question body
- answer options
- correct answer, when appropriate for the stage
- stored explanation or solution if available
- taxonomy metadata

Minimum learner context:

- whether the student has already answered
- selected option, if any
- whether the student is in practice or review mode

Optional learner context:

- weak subtopics
- recent mistakes
- prior tutor interactions in the same session

## Tutor Modes

The tutor should support at least these interaction modes:

- `hint`
- `explanation`
- `concept_help`
- `strategy_help`
- `similar_problem_guidance`

These do not need separate UI surfaces in V1, but the system should distinguish them conceptually.

## Behavioral Guardrails

Before the student answers:

- prefer scaffolding over disclosure
- do not immediately reveal the correct option unless the product explicitly allows it

After the student answers:

- explain why the correct answer is correct
- explain why the student's answer was wrong when applicable
- connect the mistake to the relevant concept or subtopic

During review:

- allow fuller explanation
- allow broader concept questions derived from the completed session

## Tutor Data Model Requirements

The backend should store:

- tutor thread per session or per review flow
- tutor messages
- question association for question-specific turns
- timestamps

This enables:

- conversation continuity
- later analytics on help usage
- optional qualitative memory later

## Relationship To Learner State

Tutor activity should inform learner interpretation, but should not directly rewrite mastery state.

V1 usage signals that should flow into learner tracking:

- hint used
- hint count
- tutor used
- tutor message count

The content of tutor messages does not need to be parsed into learner state in V1.

## Relationship To Recommendation

The tutor may suggest what to study next in natural language, but the canonical next session should still come from the recommendation engine.

This preserves:

- consistency
- debuggability
- alignment with tracked learner weaknesses

## Explanation Sources

The tutor may use:

- stored solution or explanation generated during enrichment
- current question content
- student answer state
- lightweight model reasoning at response time

Preferred order:

1. use stored structured context when available
2. add dynamic explanation only where needed

This keeps responses grounded in the question bank.

## Safety And Product Constraints

The tutor should:

- remain aligned to the current question or study context
- avoid hallucinating unsupported answer justifications
- clearly explain reasoning in student-friendly language

The tutor should not:

- fabricate official scoring claims
- override stored answer keys
- infer progress state independently of backend data

## V1 Success Criteria

Tutor integration is successful when:

- students can request hints in practice
- students can ask for explanations after answering
- students can discuss mistakes during review
- tutor usage is captured as structured analytics signals

## Out Of Scope

This document does not define:

- the exact chat UI
- model/provider selection
- the final tutor prompt
- long-term cross-session memory behavior
