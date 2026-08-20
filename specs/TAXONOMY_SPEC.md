# Aprendo Taxonomy Spec

## Purpose

This document defines the canonical V1 taxonomy contract for Aprendo question tagging.

It distills the research artifact in [taxonomy-research.md](/Users/julian/Dev/aprendo/docs/taxonomy-research.md) into an implementation-ready system contract for:

- question enrichment
- diagnostic balancing
- progress tracking
- recommendation logic
- analytics and review flows

This spec defines what the taxonomy is, how it should be used, and which parts are in scope for V1.

## Core Decisions

### 1. Use a three-level taxonomy

The primary taxonomy is:

- `subject`
- `category`
- `subtopic`

This taxonomy describes what a question is about in a way that supports recommendation and progress tracking.

### 2. Keep official competencies outside the primary taxonomy

Official ICFES competency dimensions should be stored as secondary metadata, not as part of the primary taxonomy tree.

Reason:

- it avoids cross-product explosion
- it keeps the recommendation engine simple
- it preserves official-style reporting without making the core taxonomy brittle

### 3. Launch with the V1 minimal release

Aprendo should launch with the `v1_minimal` taxonomy subset derived from the research document, not the full expanded taxonomy.

V1 includes:

- all 5 subjects
- only the highest-signal categories/subtopics for initial tagging
- 33 total subtopics across the five subjects

The expanded taxonomy should be postponed until:

- tagging prompts are validated
- question-bank coverage is large enough
- analytics show stable separation at finer granularity

### 4. Support controlled multi-tagging

Every question should receive:

- exactly 1 primary subtopic
- 0 to 2 secondary subtopics

Secondary subtopics should only be used when two distinct subtopics are genuinely required to solve the question.

### 5. Treat taxonomy tagging as versioned enrichment

Taxonomy assignment is not permanent content truth. It is enrichment output and must be versioned so the system can reprocess questions later.

Each tagged question should store:

- `taxonomyVersion`
- `taxonomyRelease`
- `subjectId`
- `categoryId`
- `primarySubtopicId`
- `secondarySubtopicIds`
- `secondaryDimensions`
- `taggingConfidence`
- `taggingStatus`

## V1 Taxonomy Scope

### Subjects

V1 covers these five subjects:

- `lectura_critica`
- `matematicas`
- `ciencias_naturales`
- `sociales_ciudadanas`
- `ingles`

### V1 subtopic count by subject

- Lectura Critica: 8
- Matematicas: 8
- Ciencias Naturales: 6
- Sociales y Ciudadanas: 6
- Ingles: 5

Total: 33 subtopics

## Taxonomy Semantics

### Primary taxonomy meaning

The primary taxonomy should answer:

- what is this question mainly about?
- which area should improve if the student gets this wrong?
- which type of practice should include this question later?

### Secondary dimensions meaning

Secondary dimensions are not part of the subject/category/subtopic hierarchy. They exist to preserve official reporting power and recommendation nuance.

For V1, Aprendo should support these secondary dimensions:

- `competencia_oficial`
- `stimulus_type`
- `reading_load`
- `calculation_load`
- `multi_step_reasoning`
- `cefr_band` for English only

These dimensions are optional for launch, but the data model should allow them from the start.

## Tagging Rules

### Required question context

The tagging pipeline must receive the full stimulus, not only the final question stem.

That includes:

- shared passages
- tables
- charts
- maps
- diagrams
- source excerpts
- notices, signs, or other embedded visual context

Without the full stimulus, tagging quality will be unreliable, especially in Lectura Critica, Sociales, and Ingles.

### Subject selection

If the source PDF already determines the subject with high confidence, the pipeline may treat subject as known input.

If not, subject must be classified first.

### Category and subtopic selection

Tagging should occur inside the subject's allowed taxonomy tree.

The model should return:

- one `subjectId`
- one `categoryId`
- one `primarySubtopicId`
- zero to two `secondarySubtopicIds`
- optional `secondaryDimensions`
- a confidence score

### Guardrails

The tagging prompt and validation layer should enforce:

- primary subtopic must belong to the selected category
- selected category must belong to the selected subject
- secondary subtopics must belong to the same subject
- no more than two secondary subtopics
- no duplicate primary/secondary subtopic IDs

## Known Ambiguity Rules

These rules should be reflected later in the tagging prompt and validator logic:

- Lectura Critica should be tagged by reading process, not by passage topic.
- In Matematicas, use `modeling_word_problems` only when formulation is the core difficulty; use equation or graph tags when the formulation is already given.
- In Ciencias Naturales, the primary tag should reflect the component needed for the key reasoning step, not every concept mentioned in the stimulus.
- In Sociales y Ciudadanas, rights questions and institutional-state questions must remain distinct.
- In Ingles, separate word-meaning questions from literal reading questions.

## V1 Operational Guidance

### What should block student-facing use

Questions should be excluded from diagnostic or recommendation flows if:

- taxonomy tagging fails
- tagging confidence is below an agreed threshold
- the question has no valid primary subtopic
- the source stimulus is incomplete

### What should not block launch

V1 does not require:

- full V2 taxonomy support
- perfect competency tagging
- perfect difficulty tagging
- exhaustive secondary dimensions on every question

## Canonical Files

The canonical source files for taxonomy in the repo are:

- human-readable spec: [TAXONOMY_SPEC.md](specs/TAXONOMY_SPEC.md)
- machine-readable V1 contract: [taxonomy.v1.json](docs/taxonomy.v1.json)
- research source: [taxonomy-research.md](docs/taxonomy-research.md)

## Out Of Scope

This document does not define:

- the exact tagging prompt
- the exact confidence threshold
- the exact Convex schema
- the full V2 taxonomy contract
- the evaluation dataset for tagging quality

## Next Steps

The next design tasks enabled by this spec are:

1. Define the question enrichment schema.
2. Define the tagging action input and output contract.
3. Define validation rules for taxonomy assignments.
4. Define how learner aggregates roll up by subject and subtopic.
5. Define recommendation logic over V1 subtopics.

## Status: full-stimulus tagging is implemented

The "Required question context" rule above — that the tagging pipeline must
receive the full stimulus, not just the stem — is no longer aspirational.
Shared passages are modelled as `questionGroups` and passed to both answer
inference and taxonomy tagging as `contextMarkdown`.

The known failure mode this document warned about (multi-question stimuli split
from their passage, producing noisy tags in Lectura Crítica, Sociales and
Inglés) is addressed for newly ingested PDFs. Questions ingested before grouping
existed still carry their stimulus concatenated into the body; re-tagging them
correctly requires reprocessing the PDF.
