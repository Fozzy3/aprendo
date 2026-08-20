# Aprendo Content Enrichment Spec

## Purpose

This document defines the V1 enrichment pipeline that turns extracted questions into recommendation-ready question-bank records.

It extends the existing OCR and question-extraction pipeline with the additional stages required for:

- answer inference
- taxonomy tagging
- question quality gating
- optional explanation generation

## Scope

V1 enrichment starts after a question has already been extracted into renderable markdown content.

This spec covers:

- pipeline stages
- stage inputs and outputs
- status transitions
- confidence handling
- student-facing eligibility rules

This spec does not define the exact prompt text or Convex code.

## Pipeline Overview

The minimal V1 pipeline is:

```text
PDF upload
  -> OCR extraction
  -> question extraction
  -> question normalization
  -> answer inference
  -> taxonomy tagging
  -> quality assessment
  -> question bank eligibility
```

Optional later stage:

```text
-> explanation generation
```

## Stage 0. PDF Upload

The system receives a source PDF and stores it in Convex file storage.

Output:

- `PdfUpload`

## Stage 1. OCR Extraction

The OCR stage converts a scanned PDF into per-page markdown plus extracted image assets.

Current implementation basis:

- Mistral OCR
- extracted page markdown
- extracted image assets stored in Convex

Output:

- OCR pages artifact
- extracted image assets

Failure mode:

- OCR failure blocks all later stages for that PDF

## Stage 2. Question Extraction

The extraction stage converts OCR markdown into structured multiple-choice questions.

Requirements:

- preserve context blocks
- preserve image references
- preserve tables and math
- ignore non-question content

Output:

- normalized question records with body and options

Failure mode:

- extraction failure blocks all later enrichment for that PDF

## Stage 3. Question Normalization

This stage prepares extracted questions for later enrichment.

Responsibilities:

- assign stable internal question IDs
- rewrite image references to canonical storage URLs
- separate canonical content from enrichment metadata
- flag malformed questions before answer/tagging work begins

Normalization checks:

- body exists
- at least two options exist
- option labels are valid
- markdown is renderable

Output:

- normalized `Question`
- initial content validation status

## Stage 4. Answer Inference

This stage determines the correct answer for each normalized question.

V1 assumption:

- correct answers are inferred by an LLM rather than imported from an official answer key

Responsibilities:

- infer `correctOption`
- optionally return short reasoning or solution text
- record confidence and provenance
- fail safely when inference is unreliable

Input:

- full question body
- answer options
- embedded images and stimulus context as needed

Output:

- `QuestionAnswerEnrichment`

Required fields:

- `correctOption`
- `confidence`
- `status`

Optional fields:

- `solutionMarkdown`
- `reasoningSummary`

Operational rule:

- low-confidence answer inference should prevent diagnostic eligibility

## Stage 5. Taxonomy Tagging

This stage assigns subject/category/subtopic metadata according to [TAXONOMY_SPEC.md](/Users/julian/Dev/aprendo/specs/TAXONOMY_SPEC.md).

Responsibilities:

- assign one valid primary taxonomy path
- assign up to two secondary subtopics when justified
- optionally assign secondary dimensions
- validate the returned taxonomy path against the canonical taxonomy release

Input:

- full question stimulus
- normalized content
- known source subject if available
- taxonomy contract

Output:

- `QuestionTaxonomyEnrichment`

Guardrails:

- must use the active taxonomy release
- must reject invalid subject/category/subtopic combinations
- must not emit free-form labels outside the taxonomy contract

Operational rule:

- failed or invalid tagging prevents student-facing use

## Stage 6. Quality Assessment

This stage turns enrichment outputs into a student-facing eligibility decision.

Responsibilities:

- combine content validity, answer confidence, and taxonomy confidence
- decide whether a question is:
  - fully usable
  - practice-only
  - excluded

Inputs:

- normalized question
- answer enrichment
- taxonomy enrichment
- optional heuristic quality checks

Output:

- `QuestionQualityAssessment`

## Eligibility Rules

### Diagnostic eligibility

A question is diagnostic-eligible only if:

- content normalization succeeded
- answer inference succeeded
- answer confidence is above the diagnostic threshold
- taxonomy tagging succeeded
- taxonomy confidence is above the diagnostic threshold
- the question is not flagged malformed or incomplete

### Practice eligibility

A question is practice-eligible if:

- content normalization succeeded
- taxonomy tagging succeeded
- answer inference is either good enough for review or explicitly marked acceptable for practice

V1 recommendation:

- allow a lower threshold for practice than for diagnostic use

### Exclusion

A question should be excluded if:

- content is malformed
- answer inference failed
- taxonomy tagging failed
- the stimulus is incomplete
- confidence is below the practice threshold

## Status Model

Each enrichment stage should support:

- `pending`
- `processing`
- `completed`
- `failed`
- `needs_review`

This allows retries and later manual or automated reprocessing.

## Processing Strategy

The system should process enrichment asynchronously in chunks rather than one isolated job per question.

Recommended approach:

- run enrichment per PDF in bounded chunks
- persist per-question stage results
- retry only failed or stale questions

Benefits:

- simpler operational control
- easier cost management
- easier reruns after prompt or taxonomy changes

## Reprocessing Rules

The system must support re-running enrichment when:

- answer prompts change
- answer models change
- taxonomy releases change
- confidence thresholds change

Reprocessing must:

- preserve historical learner attempts
- avoid changing question IDs
- write new enrichment version metadata

## Confidence Handling

Confidence should be treated as operational signal, not as hidden model internals.

The system should store:

- stage confidence
- prompt version
- model version
- last completion time

Confidence should be used for:

- diagnostic gating
- practice gating
- monitoring enrichment quality

## Minimal Monitoring Needs

The admin system should eventually expose:

- PDF-level processing status
- question counts by stage
- failed enrichment counts
- excluded question counts
- diagnostic-eligible question counts

## Out Of Scope

This spec does not define:

- the exact answer inference prompt
- the exact taxonomy prompt
- model-specific retry logic
- human review tooling

## Enrichment receives the full stimulus

Answer inference and taxonomy tagging take an optional `contextMarkdown`
alongside the question body: the shared stimulus when the question belongs to a
group.

Without it a grouped question was enriched blind — the model saw "¿Qué sugiere
el autor?" with no text — which is exactly the failure
`docs/taxonomy-research.md` calls catastrophic for Lectura Crítica, Sociales and
Inglés. Images inside the stimulus are passed as file parts too.

`getQuestionsForEnrichment` joins each question to its group so the enrichment
action never has to know about the grouping tables.

Both prompt versions were bumped when this landed, so re-running enrichment
regenerates anything tagged under the blind prompt.
