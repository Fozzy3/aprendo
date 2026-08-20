# Aprendo Architecture Spec

## Purpose

This document defines the minimal overall architecture for Aprendo. It describes the major system components, their responsibilities, and the main data flows required to support the product described in [PRODUCT_SPEC.md](/Users/julian/Dev/aprendo/specs/PRODUCT_SPEC.md).

This is an architecture-level spec, not a detailed implementation plan. It should answer:

- What subsystems exist?
- What is the source of truth for each kind of data?
- How does data move through the system?
- What are the minimum architectural requirements for V1?

## Architectural Principles

- Structured state over implicit memory: core product state should live in explicit application data models, not inside opaque LLM memory systems.
- Async enrichment pipeline: extraction, answer inference, and taxonomy tagging should run as background stages.
- Separation of concerns: content ingestion, learner-state tracking, recommendation, and tutoring should remain separate layers.
- Deterministic core, probabilistic helpers: LLMs may enrich and explain content, but scoring, tracking, and recommendation should be driven by structured data.
- Reprocessability: question enrichment should be rerunnable when prompts, models, or taxonomy definitions change.

## High-Level System

The system has five major layers:

1. Web application
2. Convex backend
3. Ingestion and enrichment pipeline
4. Learner-state and recommendation layer
5. LLM tutor layer

## Major Components

### 1. Web application

The web app is the user interface for both admin and student-facing flows.

Responsibilities:

- Admin PDF upload and pipeline monitoring
- Student diagnostic exam flow
- Navigable syllabus (Temario) view, with subtopic-focused practice launch
- Concept lesson view per subtopic (proactive AI teaching)
- Student practice session flow
- Results and progress views
- Review flow after practice
- Tutor chat interface during practice and review

The web app should not own business state beyond normal UI state and cached server data.

### 2. Convex backend

Convex is the application backend and primary transactional store for the product.

Responsibilities:

- Persist source PDFs, extracted questions, and enrichment metadata
- Persist students, sessions, attempts, and learner aggregates
- Expose queries and mutations for the web app
- Run background jobs and asynchronous actions
- Orchestrate content-processing stages

Convex should be the source of truth for:

- Question bank data
- Student progress data
- Session state
- Recommendation inputs and outputs

### 3. Ingestion and enrichment pipeline

The ingestion pipeline converts scanned PDFs into usable question-bank records.

Stages:

1. PDF upload
2. OCR extraction
3. Question extraction
4. Correct-answer inference
5. Topic and subtopic tagging
6. Optional explanation generation and quality checks

Responsibilities:

- Produce renderable question content
- Attach structured metadata needed for diagnostics and recommendations
- Store confidence and provenance for enriched fields
- Mark low-confidence questions as excluded or limited-use

This pipeline is asynchronous and should not block user-facing flows.

### 4. Learner-state and recommendation layer

This layer converts raw student attempts into progress signals and future question recommendations.

Responsibilities:

- Store diagnostic, practice, and review attempts
- Aggregate performance by subject and subtopic
- Track recency, exposure, correctness, timing, and help usage
- Build learner profiles from historical attempts
- Select candidate questions for new sessions

This layer should be deterministic and inspectable.

### 5. LLM tutor layer

The tutor layer provides contextual help during practice and review sessions.

Responsibilities:

- Explain questions and answers
- Give hints
- Answer follow-up conceptual questions
- Suggest what to review next

The tutor should consume structured context from the backend:

- Current question
- Student answer state
- Correct answer and explanation
- Relevant learner weaknesses when useful

The tutor is not the source of truth for scoring, recommendation, or learner progress.

## Core Data Domains

The architecture centers on four data domains:

### Content domain

- PDFs
- OCR artifacts
- Extracted questions
- Question enrichment metadata

### Assessment domain

- Diagnostic exams
- Practice sessions
- Review sessions
- Session question assignments

### Learning domain

- Question attempts
- Subject-level performance
- Subtopic-level performance
- Learner profile summaries

### Tutor domain

- Tutor messages
- Practice/review conversation context
- Optional qualitative observations derived from tutoring

## Source Of Truth

The source of truth for each concern should be explicit:

- Question content and metadata: Convex question records
- Correct answers and taxonomy tags: Convex enrichment fields
- Student history: Convex attempt and session records
- Progress state: Convex learner aggregates derived from attempts
- Recommendations: generated from learner aggregates plus question metadata
- Tutor context: derived from structured backend data, optionally augmented by conversation history

## Main Data Flows

### 1. Content ingestion flow

```text
PDF upload
  -> OCR
  -> question extraction
  -> answer inference
  -> taxonomy tagging
  -> question quality filtering
  -> question bank
```

Output:

- renderable questions
- correct answers
- tags
- enrichment confidence
- eligibility for student-facing use

### 2. Diagnostic flow

```text
student starts diagnostic
  -> backend assembles balanced question set
  -> student answers questions
  -> backend scores results
  -> attempts recorded
  -> learner profile initialized or updated
  -> results view generated
```

Constraint:

- no tutor access during diagnostic completion

### 3. Practice flow

```text
student requests practice
  -> recommendation layer selects questions
  -> session created
  -> student answers questions
  -> tutor available during or after question work
  -> attempts recorded
  -> learner aggregates updated
  -> next recommendations improve
```

### 4. Review flow

```text
completed session
  -> identify mistakes and weak subtopics
  -> show explanations and corrections
  -> allow tutor follow-up
  -> optionally generate next targeted session
```

### 5. Concept lesson generation flow

```text
student opens a subtopic lesson
  -> query reads the cached lesson (conceptLessons by subtopicId)
  -> if absent/stale, a mutation atomically claims generation (status = generating,
       stage = writing) and schedules an action  [policy: decideClaim / aiCache.ts]
  -> action phase 1: LLM writes the text sections + decides if a demo helps;
       internal mutation patches the text (status stays generating, stage = demo)
  -> action phase 2 (only if a demo helps): LLM writes the demo as a themed body
       fragment; internal mutation finalizes (status = ready, demo attached)
  -> each patch streams to the student's subscribed query over the socket, so the
       text appears first and the demo materializes in place
```

Constraints:

- generation runs in an action (LLMs are not allowed in queries/mutations)
- lessons are cached globally per subtopic and reused across students
- `promptVersion` invalidates stale lessons; the `generating` status deduplicates concurrent requests
- progress is communicated purely by patching the row (the `stage` field) — no extra channel; the reactive query is the transport
- the demo is generated as a **body fragment**, not a standalone page: the client wraps it in a document carrying the app's fonts, design tokens and current light/dark theme, so the demo looks native rather than like generic HTML in an iframe. The demo is optional and resilient (a phase-2 failure still ships the text)
- the demo is an **exploratory tool, not an assessment**: the prompt forbids quizzes/questions/graded exercises inside it — practice questions belong to the practice/generation features, not the lesson

This reuses the deterministic-core / probabilistic-helper split: the cache and lifecycle are deterministic structured state; only the content is LLM-generated. The same generate-and-cache lifecycle backs the weekly `CoachSummary`.

## Minimal V1 Architectural Requirements

V1 requires the following capabilities:

- A persistent question bank with renderable content
- Async question enrichment for answers and taxonomy tags
- A way to mark question quality and exclude low-confidence items
- Session creation for diagnostic and practice flows
- Attempt recording per student per question
- Aggregation of learner performance by subject and subtopic
- Deterministic question recommendation based on learner state
- Tutor support in practice and review only

## Recommended Boundaries Between Layers

### Ingestion vs recommendation

The ingestion layer prepares content. It should not decide what a student should see next.

### Attempts vs learner profile

Attempts are raw events. Learner profiles are derived summaries. The raw attempts must remain available as the canonical evidence.

### Recommendation vs tutoring

The recommendation layer chooses the next questions. The tutor helps the student understand those questions. These concerns should remain independent.

### Launchable-question pool as a shared seam

What counts as a *launchable* question (full taxonomy + scored answer key + an eligibility tier the flow draws from) is defined once and reused by both session assembly and the syllabus counts. Keeping this single definition is what guarantees the Temario never advertises a question count a practice session can't actually fulfil. Both consumers go through the same pool helper rather than re-implementing the usability/eligibility filter.

## Suggested Processing Model

The system should use asynchronous stage-based processing for content enrichment:

- Stage 1: OCR and extraction
- Stage 2: answer inference
- Stage 3: taxonomy tagging
- Stage 4: optional explanation generation and quality scoring

Each stage should:

- read from previous stage outputs
- write structured results back to Convex
- record status and confidence
- support retry and reprocessing

## Recommendation Model For V1

The recommendation engine should be rule-based and operate over structured learner data.

Inputs:

- question metadata
- student attempt history
- subject and subtopic aggregates
- recent mistakes
- recency and repetition constraints

Outputs:

- a selected set of questions for the next session
- a reason or rationale category for each selection, such as weak area, recent mistake, or reinforcement

This engine should not depend on free-form LLM reasoning as its primary selection mechanism.

## Progress Tracking Model For V1

Progress should be derived from attempts and aggregated by:

- overall performance
- subject
- subtopic

Minimum tracked signals:

- attempts
- correct answers
- recent accuracy
- response time
- hint usage
- tutor usage
- last seen timestamp

These aggregates should power both analytics and recommendations.

## LLM Usage Boundaries

LLMs are appropriate for:

- OCR-adjacent extraction support
- answer inference
- taxonomy tagging
- explanation generation
- tutor interactions

LLMs should not be the primary mechanism for:

- scoring official results
- storing learner truth
- deciding recommendations without structured ranking logic

## Operational Considerations

The architecture should support:

- background retries for failed enrichment jobs
- prompt/model versioning for reprocessing
- visibility into processing status
- exclusion of low-confidence content
- gradual improvement of enrichment quality without breaking student history

## Out Of Scope For This Document

This document does not define:

- exact Convex schema
- exact query and mutation API
- exact aggregation formulas
- exact recommendation ranking formula
- exact prompt design
- exact UI composition

## Next Design Documents

After this architecture spec, the next useful docs are:

1. Data model spec
2. Content enrichment pipeline spec
3. Learner-state and aggregation spec
4. Recommendation engine spec
5. Tutor integration spec

## Shared-stimulus groups as the unit of selection

Grouped questions ("Responda las preguntas 4 a 7…") are modelled as a
`questionGroups` row plus `questions.groupId` / `groupPosition`.

Seams:

- **Extraction** (`packages/ingest/src/question-extraction-core.ts`) asks the
  model for a `contextKey` repeated identically on every member, plus the stated
  `contextRange`. `question-groups.ts` collapses those repetitions into groups —
  a pure, tested function, which is the only part of the fix testable without an
  LLM. The prompt and the model call now live in **one** place; the Effect CLI
  (`question-extractor.ts`) imports them instead of carrying a byte-identical
  copy that silently missed every prompt change.
- **Persistence** (`pdfPipeline.ts`) inserts groups before questions. A grouped
  question's `bodyMarkdown` is the stem alone; the stimulus is never folded in.
- **Selection** (`questionPool.expandToGroups`) is the single definition of
  "take the whole group or none of it", consumed by every strategy in
  `sessions.ts`. Targets count *members*, not groups.
- **Presentation** (`components/SharedStimulus.tsx`) renders the stimulus once
  above the stem in both solve and review; `tutor.getPracticeQuestionContext`
  passes it to the model so the tutor is not reasoning about a text it cannot
  see.

## Performance levels

`docs/levels.v1.json` + `packages/convex/src/levels.ts` form a contract in the
same shape as the taxonomy: declarative JSON plus pure lookups, free of any
`convex/*` import so the web app can consume it through the
`@aprendo/convex/levels` package export.

Levels are **derived** at read time from learner aggregates and placement
sessions — no stored level, nothing to keep in sync.
