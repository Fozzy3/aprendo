# Initial Milestone Tracker

## Purpose

This document tracks the work required for the first meaningful student-facing milestone of Aprendo.

This milestone should deliver:

- a completed PDF pipeline with the missing enrichment steps
- a minimal student auth system based on email only
- a diagnostic exam page connected to the backend
- a student progress page

This milestone explicitly excludes:

- tutor features
- practice session generation
- advanced admin tooling
- robust production authentication

## Planning Inputs

This task list is based on:

- [PRODUCT_SPEC.md](/Users/julian/Dev/aprendo/specs/PRODUCT_SPEC.md)
- [ARCHITECTURE_SPEC.md](/Users/julian/Dev/aprendo/specs/ARCHITECTURE_SPEC.md)
- [DATA_MODEL_SPEC.md](/Users/julian/Dev/aprendo/specs/DATA_MODEL_SPEC.md)
- [CONTENT_ENRICHMENT_SPEC.md](/Users/julian/Dev/aprendo/specs/CONTENT_ENRICHMENT_SPEC.md)
- [LEARNER_STATE_SPEC.md](/Users/julian/Dev/aprendo/specs/LEARNER_STATE_SPEC.md)
- [TAXONOMY_SPEC.md](/Users/julian/Dev/aprendo/specs/TAXONOMY_SPEC.md)
- [RECOMMENDATION_ENGINE_SPEC.md](/Users/julian/Dev/aprendo/specs/RECOMMENDATION_ENGINE_SPEC.md)
- [convex-actions-scheduling SKILL.md](/Users/julian/Dev/aprendo/.agents/skills/convex-actions-scheduling/SKILL.md)
- official AI SDK file-parts guidance: [Prompts / File Parts](https://ai-sdk.dev/docs/foundations/prompts#file-parts)

## Status Legend

- `not_started`
- `in_progress`
- `blocked`
- `done`

## Milestone Summary

Current milestone status: `in_progress`

Target outcome:

- admins can upload PDFs and the pipeline can produce enriched, tagged, diagnostic-eligible questions
- students can identify themselves with a minimal email-only auth flow
- students can take a diagnostic exam
- the backend stores attempts and computes progress summaries
- students can view their progress after diagnostic completion

## Current Implementation Snapshot

Last updated: `2026-03-14`

Implemented in this pass:

- Convex schema expanded for students, sessions, session questions, attempts, learner aggregates, and richer question enrichment state
- PDF pipeline extended with async answer inference, taxonomy tagging, and eligibility evaluation
- Question enrichment uses structured AI outputs and is designed to support file-part style multimodal inputs later
- Minimal email-only student entry flow added in the web app
- Diagnostic session creation, answer submission, completion, and scoring implemented
- Progress aggregation and student progress queries implemented
- New student-facing diagnostic and progress routes added
- Existing upload/question browser pages updated to expose enrichment state for debugging

Verified in this pass:

- [x] `bun convex dev --once`
- [x] `bun run typecheck`
- [x] web production build

Still needs manual QA:

- [ ] upload a fresh PDF and confirm it reaches diagnostic-ready question state
- [ ] complete a browser-based student flow: email entry -> diagnostic -> progress
- [ ] inspect a few enriched questions manually for answer/tag quality

## Workstream A. Pipeline Completion

Goal:

- extend the current OCR and question extraction pipeline with answer inference, taxonomy tagging, and student-facing eligibility

Status: `done`

### A1. Extend the domain model for enrichment

Status: `done`

- [x] add answer-enrichment state to the backend model
- [x] add taxonomy-enrichment state to the backend model
- [x] add question-quality or eligibility state
- [x] version answer and taxonomy enrichment outputs

### A2. Implement answer inference stage

Status: `done`

- [x] define the internal action contract for answer inference
- [x] decide chunking strategy for question batches per PDF
- [x] implement Convex-scheduled background execution for answer inference
- [x] use AI SDK messages in a way that can support file parts for multimodal input where needed
- [x] store inferred correct option, confidence, status, and optional solution text
- [x] persist failures without breaking the entire upload record

### A3. Implement taxonomy tagging stage

Status: `done`

- [x] define tagging action input/output around the canonical taxonomy contract
- [x] validate output against [TAXONOMY_SPEC.md](/Users/julian/Dev/aprendo/specs/TAXONOMY_SPEC.md)
- [x] schedule tagging as a follow-on background stage after answer inference or after normalized extraction
- [x] store primary subtopic, secondary subtopics, dimensions, confidence, and version metadata
- [x] persist failures and allow reprocessing

### A4. Implement question quality and eligibility stage

Status: `done`

- [x] define diagnostic eligibility rules
- [x] define practice eligibility rules, even if practice UI is out of scope for this milestone
- [x] exclude malformed, low-confidence, or incompletely tagged questions
- [x] expose eligibility in backend queries

### A5. Surface pipeline progress for debugging

Status: `done`

- [x] extend upload and question inspection queries to show enrichment state
- [x] expose counts for extracted, answer-completed, tagged, diagnostic-eligible, and excluded questions
- [x] keep admin visibility simple and functional, not polished

## Workstream B. Minimal Student Auth

Goal:

- let students identify themselves with only an email address, without passwords, OTPs, or magic links

Status: `done`

### B1. Define the auth model

Status: `done`

- [x] add a minimal student identity model keyed by email
- [x] decide how session persistence works in the browser
- [x] define how a returning user is recognized

### B2. Implement the minimal auth flow

Status: `done`

- [x] build a simple login or entry page that asks only for email
- [x] create or fetch the student record on submit
- [x] persist the student session locally in a minimal but consistent way
- [x] add logout or switch-student behavior

### B3. Protect student routes lightly

Status: `done`

- [x] gate diagnostic and progress routes behind the email-based student identity
- [x] redirect unauthenticated users to the email-entry flow
- [x] keep the implementation deliberately simple for this milestone

## Workstream C. Diagnostic Backend

Goal:

- support diagnostic session creation, question delivery, answer submission, scoring, and completion

Status: `done`

### C1. Define diagnostic session entities

Status: `done`

- [x] add session records for diagnostic sessions
- [x] add session-question assignment records
- [x] add question-attempt records

### C2. Implement diagnostic assembly

Status: `done`

- [x] define the first diagnostic question count
- [x] assemble only diagnostic-eligible questions
- [x] balance the diagnostic across the five subjects
- [x] avoid repeated or low-quality questions

### C3. Implement answer submission and scoring

Status: `done`

- [x] save selected option per question
- [x] compute correctness from stored answer enrichment
- [x] support session completion and scoring summary
- [x] prevent tutor/help features from appearing in this flow

### C4. Implement progress aggregation trigger

Status: `done`

- [x] update learner aggregates after a completed diagnostic
- [x] compute overall, subject, and subtopic summaries
- [x] store enough summary state for fast results loading

## Workstream D. Diagnostic UI

Goal:

- build the student-facing diagnostic experience and connect it to backend session APIs

Status: `done`

### D1. Diagnostic route and page shell

Status: `done`

- [x] add a dedicated diagnostic route
- [x] build the main diagnostic page layout
- [x] support one-question-at-a-time navigation

### D2. Diagnostic interaction flow

Status: `done`

- [x] fetch or create the student's current diagnostic session
- [x] show question body and answer options
- [x] save answers as the student progresses
- [x] support previous/next navigation and completion

### D3. Diagnostic UX guardrails

Status: `done`

- [x] do not show tutor UI
- [x] do not show answer explanations during the exam
- [x] keep the UI focused, calm, and exam-oriented

## Workstream E. Progress Page

Goal:

- show the student's post-diagnostic performance and current baseline

Status: `done`

### E1. Progress queries

Status: `done`

- [x] create backend queries for overall progress summary
- [x] create backend queries for subject-level breakdown
- [x] create backend queries for subtopic-level weak areas

### E2. Progress UI

Status: `done`

- [x] add a dedicated progress route
- [x] show overall summary
- [x] show subject-level performance
- [x] show key weak areas or weakest subtopics
- [x] show simple actionable copy for what to work on next

### E3. Empty and early-state handling

Status: `done`

- [x] handle students who have not taken a diagnostic yet
- [x] handle low-evidence subtopic states conservatively

## Workstream F. Glue Work And Validation

Goal:

- make the milestone coherent end to end

Status: `in_progress`

### F1. Routing and navigation

Status: `done`

- [x] connect email entry, diagnostic, and progress routes
- [x] update header or navigation for the new student flows

### F2. QA and manual validation

Status: `in_progress`

- [ ] validate that a new PDF can reach diagnostic-eligible question state
- [ ] validate that a student can enter with email, take diagnostic, and see progress
- [x] validate that no tutor or practice affordances leaked into this milestone

### F3. Documentation follow-up

Status: `in_progress`

- [x] update this tracker as work progresses
- [ ] update relevant specs only if implementation forces a real architectural change

## Suggested Execution Order

1. Workstream A: pipeline completion
2. Workstream B: minimal student auth
3. Workstream C: diagnostic backend
4. Workstream D: diagnostic UI
5. Workstream E: progress page
6. Workstream F: glue work and validation

## Notes

- The current milestone should not implement tutor chat or practice recommendation flows.
- The recommendation and tutor specs remain relevant because they shape future-compatible data contracts, but they are not in active scope for this milestone.
- The Convex scheduling guidance is especially relevant for pipeline orchestration because external API calls and background stages belong in actions, with reads and writes done through `ctx.runQuery` and `ctx.runMutation`.
- The AI SDK file-parts guidance matters for any multimodal answer-inference or tagging step that needs to send files or binary content as part of user messages. Even if the first implementation remains text-first, the stage contracts should not block later multimodal input.
