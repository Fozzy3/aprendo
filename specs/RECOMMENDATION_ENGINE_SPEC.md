# Aprendo Recommendation Engine Spec

## Purpose

This document defines the minimal V1 recommendation engine for Aprendo.

The engine should select the next questions a student should practice based on:

- learner progress
- taxonomy metadata
- recent mistakes
- repetition constraints
- question eligibility

## Core Principle

The recommendation engine should be rule-based and inspectable in V1.

It should use structured data, not free-form LLM reasoning, as the primary decision mechanism.

## Inputs

The engine consumes:

- student learner aggregates
- recent question attempts
- current question-bank eligibility state
- taxonomy tags
- optional difficulty metadata if available

## Outputs

The engine produces:

- a new `Session`
- an ordered set of `SessionQuestion` records
- a selection rationale for each question

## Recommendation Goals

V1 recommendations should:

- address weak areas
- reinforce recent mistakes
- maintain question diversity
- avoid excessive repetition
- include some confidence-building items

## Session Types

The engine should support at least:

- mixed practice
- targeted practice
- review-driven practice

### Mixed practice

Used after diagnostic or as the default recommendation mode.

Suggested composition:

- majority from weak subtopics
- some from medium-strength areas
- small number from stronger areas

### Targeted practice

Used when the student explicitly wants one subject or subtopic.

Suggested composition:

- heavily concentrated in the requested area
- still avoid near-duplicate repetition

### Review-driven practice

Used after a recent session with mistakes.

Suggested composition:

- recent incorrect questions or close variants
- same subtopic reinforcement
- one or two confidence-building items

## Candidate Filtering

Before ranking, the engine should filter out questions that are not suitable.

Hard filters:

- not student-facing eligible
- missing valid answer enrichment
- missing valid taxonomy enrichment
- recently seen too recently
- already answered too many times within a short horizon

Soft filters:

- same source cluster as very recent questions
- overly similar question patterns
- out-of-band difficulty

## Selection Signals

V1 selection should prioritize:

- low mastery subtopics with enough evidence
- recent mistakes
- under-practiced but important areas
- moderate novelty

Signals that should influence score:

- subtopic mastery score
- subtopic evidence level
- recent incorrect count
- recency since last seen
- prior exposure count
- hint/tutor dependence in that area

## Selection Rationale Categories

Each recommended question should carry a rationale category:

- `weak_subtopic`
- `recent_mistake`
- `reinforcement`
- `confidence_building`
- `balanced_coverage`

This supports debugging and later product explanations.

## Diagnostic Assembly

The diagnostic exam is not a recommendation problem in the normal sense, but it uses the same question-bank foundation.

Diagnostic assembly should:

- use only diagnostic-eligible questions
- balance across the five main subjects
- avoid overly narrow clustering inside one subject
- prefer clean, medium-confidence, representative questions

The tutor must be disabled during diagnostic sessions.

## Anti-Repetition Rules

V1 should avoid:

- serving the exact same question too frequently
- serving multiple near-duplicate questions back-to-back
- overfocusing on one subtopic when evidence is still low

The engine should include a cooldown concept, even if simple.

## Cold Start Behavior

Before enough learner data exists:

- use the diagnostic exam to initialize state
- if no diagnostic exists, fall back to balanced mixed practice
- avoid over-targeting based on one or two attempts

## Minimal Session Construction Strategy

For a standard V1 practice session, the engine should:

1. identify the weakest eligible subtopics
2. gather recent mistake candidates
3. gather reinforcement candidates from medium areas
4. gather a small number of confidence-building candidates
5. rank and deduplicate candidates
6. assemble the final ordered session

## Recommendation Explainability

The system should be able to answer:

- why was this session recommended?
- why was this question selected?
- which weak areas is this session trying to improve?

This does not require full user-facing explanations in V1, but the backend should preserve enough metadata to support them.

## Failure Handling

If there are not enough questions in a desired weak area, the engine should:

- broaden to the parent subject
- use adjacent categories or medium-strength areas
- avoid failing the session request unless inventory is critically low

## Out Of Scope

This document does not define:

- the exact ranking formula
- advanced adaptive testing
- contextual bandits
- reinforcement learning
- LLM-generated recommendation reasoning

