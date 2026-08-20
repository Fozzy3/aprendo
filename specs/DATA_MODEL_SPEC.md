# Aprendo Data Model Spec

## Purpose

This document defines the minimal V1 data model required to support:

- question-bank ingestion and enrichment
- diagnostic and practice session delivery
- progress tracking
- recommendation generation
- tutor-assisted review

This is a domain-model spec. It defines the entities and their responsibilities, not the final Convex schema syntax.

## Design Principles

- Raw events first: learner truth starts from attempts, not from derived summaries.
- Enrichment is versioned: answer inference and taxonomy tagging are not immutable facts.
- Student-facing eligibility is explicit: not every extracted question should be usable.
- Derived state is allowed: learner aggregates and recommendation summaries may be denormalized for performance.

## Core Domains

The V1 model is organized into five domains:

1. Source content
2. Question bank
3. Sessions and attempts
4. Learner aggregates
5. Tutor interactions

## 1. Source Content Domain

### PdfUpload

Represents a source PDF uploaded for ingestion.

Responsibilities:

- store source metadata
- track pipeline state
- link to debug artifacts and extracted questions

Key fields:

- `id`
- `fileName`
- `slug`
- `pdfStorageId`
- `status`
- `createdAt`
- `updatedAt`
- `pageCount`
- `assetCount`
- `questionCount`
- `errorMessage`
- `ocrArtifactStorageId`
- `rawExtractionStorageId`

### PdfProcessingRun

Represents a processing or reprocessing run for a PDF.

Responsibilities:

- track each pipeline execution independently
- store pipeline versions and model versions
- support retries and auditability

Key fields:

- `id`
- `pdfUploadId`
- `runType` (`initial`, `retry`, `reprocess`)
- `pipelineVersion`
- `status`
- `startedAt`
- `completedAt`
- `errorMessage`

V1 note:

- This may be omitted from the first implementation if `PdfUpload` temporarily carries enough status, but the architecture should leave room for it.

## 2. Question Bank Domain

### Question

Represents the canonical student-facing question record.

Responsibilities:

- hold renderable content
- hold student-facing eligibility state
- hold pointers to enrichment output

Key fields:

- `id`
- `pdfUploadId`
- `sourceQuestionNumber`
- `sequence`
- `bodyMarkdown`
- `options[]`
- `createdAt`
- `contentStatus` (`active`, `excluded`, `needs_review`)
- `eligibility` (`diagnostic`, `practice_only`, `excluded`)

Optional future fields:

- `sourcePageRange`
- `dedupeClusterId`
- `difficultyBand`

AI-generated questions:

- Questions authored by AI (subtopic generation) are stored as ordinary `Question` rows with `eligibility = practice_only`, full taxonomy, and a completed answer/solution. They are attached to a single synthetic "AI generated" `PdfUpload` (slug `ai-generated`) so they need no schema change and flow through the normal selection, session, and review machinery.

### QuestionGroup

Represents a shared stimulus that a run of questions depends on — the text,
table, map or excerpt behind "RESPONDA LAS PREGUNTAS 4 A 7 DE ACUERDO CON LA
SIGUIENTE INFORMACIÓN".

Responsibilities:

- store the stimulus **once**, instead of concatenating it into every member's
  `bodyMarkdown`
- keep the questions that share it linked, so they are selected and presented
  together

Key fields:

- `pdfUploadId`
- `contextKey` (the extractor's stable key for this stimulus, unique per upload)
- `contextMarkdown`
- `contextImages[]`
- `firstNumber`, `lastNumber` (the range stated in the source instruction)
- `memberCount` (members actually extracted; may be fewer than the range)
- `createdAt`

V1 notes:

- `Question.groupId` and `Question.groupPosition` are **optional**: questions
  ingested before grouping existed simply have no group, so no destructive
  migration is needed. Recovering the structure for those rows requires
  reprocessing the PDF (`pdfs.retryPdfUpload`).
- A grouped question's `bodyMarkdown` is the stem alone. Folding the stimulus in
  is what destroyed the group previously: every member became a standalone
  question, the first carrying a "responda las preguntas 4 a 7" banner and the
  rest with no text at all.
- Selection pulls **whole groups** (`questionPool.expandToGroups`); a group that
  does not fit the remaining slots is dropped rather than split.
- A group may span subtopics. Subtopic-focused practice accepts the whole group
  anyway — a question without its text is worse than a slightly off-topic one.

### QuestionOption

Embedded inside `Question`.

Key fields:

- `label`
- `bodyMarkdown`

### QuestionAnswerEnrichment

Represents inferred or attached answer metadata for a question.

Responsibilities:

- store answer key output separately from the canonical content
- support reprocessing
- retain confidence and provenance

Key fields:

- `id`
- `questionId`
- `status` (`pending`, `completed`, `failed`, `needs_review`)
- `correctOption`
- `solutionMarkdown`
- `confidence`
- `source` (`llm_inferred`, `manual`, `imported`)
- `modelId`
- `promptVersion`
- `startedAt`
- `completedAt`
- `errorMessage`

### QuestionTaxonomyEnrichment

Represents taxonomy tagging output.

Responsibilities:

- assign taxonomy fields defined by [TAXONOMY_SPEC.md](/Users/julian/Dev/aprendo/specs/TAXONOMY_SPEC.md)
- keep tagging versioned and replaceable

Key fields:

- `id`
- `questionId`
- `status`
- `taxonomyVersion`
- `taxonomyRelease`
- `subjectId`
- `categoryId`
- `primarySubtopicId`
- `secondarySubtopicIds[]`
- `secondaryDimensions`
- `confidence`
- `modelId`
- `promptVersion`
- `startedAt`
- `completedAt`
- `errorMessage`

### QuestionQualityAssessment

Represents operational quality checks for student-facing use.

Responsibilities:

- centralize eligibility and confidence gating
- capture whether a question can appear in diagnostics or only in practice

Key fields:

- `questionId`
- `overallStatus` (`usable`, `practice_only`, `excluded`)
- `exclusionReasons[]`
- `diagnosticEligible`
- `practiceEligible`
- `lastEvaluatedAt`

## 3. Sessions And Attempts Domain

### Student

Represents the learner.

Minimal V1 responsibilities:

- identify a learner across sessions
- anchor attempts and progress records

Key fields:

- `id`
- `createdAt`
- `displayName` or external auth reference

### Session

Represents a single student-facing question set.

Responsibilities:

- group assigned questions
- define session purpose
- record lifecycle state

Key fields:

- `id`
- `studentId`
- `kind` (`diagnostic`, `nivelacion`, `recommended`, `topic`, `simulacro`, `repaso`) — review is a stage of any kind, not a separate kind. `repaso` resurfaces previously-missed questions for spaced review
- `status` (`created`, `in_progress`, `completed`, `abandoned`)
- `recommendationSource` (`diagnostic_plan`, `rule_based`, `review_mistakes`, `manual`)
- `subjectId` — set for `topic` and `nivelacion` sessions (the chosen subject), and for a **per-area `simulacro`**
- `subtopicId` — only set for `topic` sessions launched from the syllabus (the chosen subtopic; narrows selection to that subtopic)
- `simulacroSessionNumber` — only set for a **full** `simulacro` (the two official sittings); a per-area simulacro sets `subjectId` instead, and setting both is rejected
- `startedAt`
- `completedAt`
- `questionCount`
- `summary`

### SessionQuestion

Represents a question assigned into a specific session.

Responsibilities:

- preserve order and per-session selection rationale
- allow a question to appear in more than one session over time

Key fields:

- `id`
- `sessionId`
- `questionId`
- `position`
- `selectionReason` (`balanced_diagnostic`, `balanced_coverage`, `weak_subtopic`, `recent_mistake`, `reinforcement`, `confidence_building`, `topic_focus`)
- `selectionMetadata` — the subject id, or the subtopic id for syllabus-launched subtopic practice

### QuestionAttempt

Represents the learner's interaction with a question in a session.

Responsibilities:

- serve as canonical evidence for progress tracking
- support scoring and post-session review

Key fields:

- `id`
- `studentId`
- `sessionId`
- `questionId`
- `sessionQuestionId`
- `attemptType` (`diagnostic`, `practice`, `review`)
- `selectedOption`
- `isCorrect`
- `answeredAt`
- `responseTimeMs`
- `usedHint`
- `usedTutor`
- `hintCount`
- `tutorMessageCount`
- `wasSkipped`

V1 note:

- There should be one canonical completed attempt per student-question-session combination.

### Placement (`nivelacion`)

Placement is per area, not a single exam. A `nivelacion` session covers one
subject (15 questions, diagnostic-eligible only, 30 min, no tutor) and the
**first completed one unlocks the app**; the remaining areas stay as pending
work. The legacy 20-question `diagnostic` still counts as placement so students
placed before this change keep their access, but it is no longer launchable.

## 4. Learner Aggregates Domain

### LearnerSubjectAggregate

Represents derived performance for one student within one subject.

Responsibilities:

- power dashboards
- support recommendation scoring

Key fields:

- `studentId`
- `subjectId`
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

### LearnerSubtopicAggregate

Represents derived performance for one student within one primary subtopic.

Responsibilities:

- provide the main targeting signal for recommendations
- power granular analytics and review

Key fields:

- `studentId`
- `subjectId`
- `categoryId`
- `subtopicId`
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

### Performance level (derived, no table)

The ICFES performance level for an area is **derived**, not stored:

- "now" = the subject aggregate's accuracy mapped onto the 0-100 area score
- "at placement" = the most recent completed `nivelacion` for that area (a
  single-subject session, so its overall accuracy *is* the area score), falling
  back to `LearnerProfileSnapshot.diagnosticBaseline` for legacy students
- the score is placed on the area's band scale by `packages/convex/src/levels.ts`
  over the `docs/levels.v1.json` contract

A level is only claimed once there are at least `MIN_ATTEMPTS_FOR_LEVEL` graded
attempts in the area; below that the student is shown "sin nivel aún". A level
invented from three questions is worse than no level, because the student will
believe it.

### LearnerProfileSnapshot

Represents a compact summary of the learner at a point in time.

Responsibilities:

- allow fast loading of dashboard and recommendation overview state
- avoid recalculating high-level summaries on every request

Key fields:

- `studentId`
- `updatedAt`
- `strongestSubjectIds[]`
- `weakestSubjectIds[]`
- `weakestSubtopicIds[]`
- `diagnosticBaseline`
- `overallSummary`

V1 note:

- This object is optional but useful as a denormalized read model.

## 5. Tutor Domain

### TutorThread

Represents a conversation container tied to a student and a session.

Key fields:

- `id`
- `studentId`
- `sessionId`
- `status`
- `createdAt`

### TutorMessage

Represents an individual tutor interaction.

Responsibilities:

- preserve conversational context
- support analytics around tutor usage

Key fields:

- `id`
- `threadId`
- `questionId`
- `role` (`user`, `assistant`, `system`)
- `message`
- `createdAt`
- `messageType` (`hint`, `explanation`, `follow_up`, `general_help`)

## 6. Generated Content Domain

### ConceptLesson

Represents an AI-generated lesson for one taxonomy subtopic, cached globally (not per student).

Responsibilities:

- cache generated teaching content so it is produced once and reused
- model the generation lifecycle so concurrent requests don't duplicate work

Key fields:

- `subtopicId` (cache key; one lesson per subtopic)
- `subjectId` (derived parent subject)
- `status` (`generating`, `ready`, `failed`)
- `stage` (optional sub-step while `generating`: `writing` text, then `demo`; cleared when settled) — surfaced over the reactive socket so the client shows explicit progress
- `ideaBody` (markdown — the explanation that teaches the concept, Khan-Academy style)
- `demoHtml` (optional interactive demo, stored as a **body fragment** that the client themes; see ARCHITECTURE §5)
- `modelId`, `promptVersion` (provenance + cache invalidation)
- `generatedAt`, `failureReason`, `createdAt`, `updatedAt`

V1 notes:

- Generation is claimed atomically via the `status` field (a serializable mutation flips `generating`), so concurrent viewers of the same subtopic trigger a single generation. The claim/regeneration policy is the shared `decideClaim` (`aiCache.ts`).
- Generation runs in two phases that each patch the row, so progress streams to the client over Convex's socket: phase 1 writes the text sections (status stays `generating`, `stage` → `demo`); phase 2 builds the optional demo, then `status` → `ready`. A demo failure still publishes the lesson with its text (the demo is optional).
- `promptVersion` lets a prompt/model change invalidate and regenerate stale lessons.

### CoachSummary

Represents a cached, AI-generated weekly summary for one student and one week.

Key fields:

- `studentId`
- `weekIndex` (Colombia-time week bucket; cache key with `studentId`)
- `status` (`generating`, `ready`, `failed`)
- `body` (short markdown summary)
- `modelId`, `promptVersion`, `generatedAt`, `failureReason`, `createdAt`, `updatedAt`

V1 notes:

- Same atomic-claim generation lifecycle as `ConceptLesson`; generated on demand only when the student has activity that week.

## Canonical Relationships

- one `PdfUpload` has many `Question`
- one `Question` may have one current answer enrichment and one current taxonomy enrichment
- one `Student` has many `Session`
- one `Session` has many `SessionQuestion`
- one `SessionQuestion` points to one `Question`
- one `SessionQuestion` may have one completed `QuestionAttempt`
- one `Student` has many subject and subtopic aggregates
- one `Session` may have one tutor thread with many tutor messages

## Required V1 Read Models

The system should support these read patterns efficiently:

- list uploaded PDFs and processing state
- browse questions by PDF
- fetch a question with current enrichment and eligibility
- fetch a student's active or latest session
- fetch session questions in order
- fetch completed attempts for a session
- fetch subject and subtopic progress for a student
- fetch candidate question pools for recommendation
- fetch the navigable syllabus for a student: the taxonomy tree joined with per-node launchable-question counts and per-node mastery (a read-only join, not a stored entity)
- fetch the cached concept lesson for a subtopic (and request on-demand generation when absent)

## Versioning Requirements

The following fields should be version-aware from the start:

- answer inference prompt/model
- taxonomy prompt/model
- taxonomy release
- recommendation logic version

This avoids mixing historical records with silently changed enrichment logic.

## Out Of Scope

This document does not define:

- exact Convex table names
- exact indexes
- exact aggregation formulas
- exact tutor prompt payloads

