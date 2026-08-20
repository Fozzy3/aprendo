# Aprendo Agent Guide

This file is the starting point for LLMs working in this repository.

Use it to understand:

- what Aprendo is building
- how the repo is organized
- which specs to consult before making changes

When product and implementation questions arise, prefer the spec files in `specs/` over assumptions.

## 1. Product Description

Aprendo is an ICFES Saber 11 preparation platform for students in Colombia.

The product is built around a structured question bank extracted from scanned exam PDFs. The intended end state is:

- admins upload PDFs that contain exam-style questions
- the backend runs OCR and question extraction
- each question is enriched with answer and taxonomy metadata
- students take a diagnostic exam without tutor assistance
- the system tracks progress by subject and subtopic
- later practice sessions are recommended based on learner performance
- an AI tutor helps during practice and review sessions

The current codebase already supports PDF upload, OCR, question extraction, and question browsing. Most student-facing learning flows are still to be built.

## 2. Project Overview

### Monorepo basics

- Package manager: `bun`
- Workspace layout: Bun workspaces
- Task runner: `turbo`
- Main backend: `Convex`
- Main frontend: `TanStack Start`

Useful root commands:

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run typecheck`
- `bun run test`

### Top-level structure

```text
apps/
  web/                # TanStack Start frontend
packages/
  convex/             # Convex schema, queries, mutations, actions
  ingest/             # OCR + question extraction core
specs/                # Product, architecture, domain, and engineering specs
data/pdfs/            # Sample/source PDFs used for ingestion
reference/            # Reference repos and upstream docs mirrored into the repo
README.md             # Current repo overview
AGENTS.md             # This guide
```

### Main packages

#### `apps/web`

Student/admin web application.

Current state:

- `/` is still a smoke-test style route
- `/upload-pdfs` is the admin ingest route
- `/questions` is the question-browser route

Future work will expand this app into the diagnostic, practice, results, and tutor experiences.

#### `packages/convex`

Primary application backend and source of truth for product data.

Responsibilities include:

- storing uploaded PDFs
- storing extracted questions
- orchestrating PDF processing
- eventually storing sessions, attempts, learner progress, and recommendation state

Important current files:

- `packages/convex/src/schema.ts`
- `packages/convex/src/pdfs.ts`
- `packages/convex/src/pdfPipeline.ts`

#### `packages/ingest`

Reusable ingestion core used by Convex actions.

Responsibilities include:

- OCR processing
- OCR markdown normalization
- LLM-based question extraction

Important current files:

- `packages/ingest/src/ocr-core.ts`
- `packages/ingest/src/question-extraction-core.ts`
- `packages/ingest/src/question-schema.ts`

### Current architecture stance

The repository is moving toward this model:

- Convex is the source of truth for structured application state
- LLMs are used for enrichment and tutoring, not as the primary recommendation engine
- learner progress should be based on explicit attempts and aggregates
- recommendations should be rule-based and inspectable in V1

## 3. Spec Index

The table below should be treated like a reading guide. Before implementing a feature, identify the relevant spec and read it first.

| Spec | What It Contains | Use It When |
|---|---|---|
| [PRODUCT_SPEC.md](/Users/julian/Dev/aprendo/specs/PRODUCT_SPEC.md) | Product vision, target user flows, V1 scope, intended features, and product boundaries. | You need to understand what Aprendo is supposed to do from a user/product perspective. Read this first for any major feature work. |
| [ARCHITECTURE_SPEC.md](/Users/julian/Dev/aprendo/specs/ARCHITECTURE_SPEC.md) | High-level system architecture, main layers, source-of-truth boundaries, and core data flows. | You are deciding where a capability belongs, how subsystems interact, or whether a change fits the intended architecture. |
| [TAXONOMY_SPEC.md](/Users/julian/Dev/aprendo/specs/TAXONOMY_SPEC.md) | Canonical V1 taxonomy contract for subject/category/subtopic tagging, tagging rules, and taxonomy scope. | You are implementing or modifying question tagging, analytics rollups by subtopic, diagnostic balancing, or recommendation logic that depends on taxonomy. |
| [DATA_MODEL_SPEC.md](/Users/julian/Dev/aprendo/specs/DATA_MODEL_SPEC.md) | Minimal V1 domain model for PDFs, questions, enrichments, sessions, attempts, learner aggregates, and tutor state. | You are designing Convex tables, indexes, relationships, or deciding what entities need to exist. |
| [CONTENT_ENRICHMENT_SPEC.md](/Users/julian/Dev/aprendo/specs/CONTENT_ENRICHMENT_SPEC.md) | The post-extraction enrichment pipeline: answer inference, taxonomy tagging, quality gating, eligibility, retries, and reprocessing. | You are extending the ingest pipeline or building background jobs for answer/tag enrichment and question eligibility. |
| [LEARNER_STATE_SPEC.md](/Users/julian/Dev/aprendo/specs/LEARNER_STATE_SPEC.md) | How progress should be derived from attempts into learner metrics, aggregates, mastery signals, and weak-area detection. | You are implementing progress tracking, subject/subtopic aggregates, session result summaries, or learner-profile updates. |
| [RECOMMENDATION_ENGINE_SPEC.md](/Users/julian/Dev/aprendo/specs/RECOMMENDATION_ENGINE_SPEC.md) | V1 recommendation inputs, candidate filtering, selection goals, anti-repetition rules, and session assembly behavior. | You are building practice-session generation, question selection logic, or debugging why a question/session was recommended. |
| [TUTOR_INTEGRATION_SPEC.md](/Users/julian/Dev/aprendo/specs/TUTOR_INTEGRATION_SPEC.md) | Tutor role, availability rules, context contract, guardrails, and how tutor usage relates to learner tracking. | You are implementing practice/review chat, hints, explanation flows, or deciding what tutor context should come from the backend. |
| [docs/adr/0001-separate-solve-and-review-session-screens.md](/Users/julian/Dev/aprendo/docs/adr/0001-separate-solve-and-review-session-screens.md) | Decision to separate focused solve screens from reusable post-completion review screens across practice, diagnostic, and simulated exams. | You are changing session routes, active question-taking screens, review screens, answer disclosure behavior, or tutor availability by session stage. |
| [REFERENCE_REPOS.md](/Users/julian/Dev/aprendo/specs/REFERENCE_REPOS.md) | Map of the mirrored reference repositories under `reference/` and how to search them. | You need implementation patterns or upstream examples for Effect, TanStack Start/Router, or other mirrored reference code. |
| [TYPESCRIPT_CONVENTIONS.md](/Users/julian/Dev/aprendo/specs/TYPESCRIPT_CONVENTIONS.md) | TypeScript module/import conventions, bundler-mode assumptions, and repo rules like avoiding barrel files. | You are adding files, changing imports, or deciding module structure. Consult this before broad refactors. |
| [EFFECT_BEST_PRACTICES.md](/Users/julian/Dev/aprendo/specs/EFFECT_BEST_PRACTICES.md) | Critical Effect rules, especially around typing, tagged errors, validation, and safe Effect usage. | You are writing or reviewing Effect-based code, especially in ingestion or any future Effect-heavy package. |
| [EFFECT_TESTING.md](/Users/julian/Dev/aprendo/specs/EFFECT_TESTING.md) | Testing patterns for Effect code, testcontainers, and layer composition. | You are writing tests for Effect-based logic or need patterns for integration testing infrastructure-heavy code. |

## 4. Recommended Reading Order

### For product-facing backend work

1. `specs/PRODUCT_SPEC.md`
2. `specs/ARCHITECTURE_SPEC.md`
3. one or more domain specs:
   - `specs/TAXONOMY_SPEC.md`
   - `specs/DATA_MODEL_SPEC.md`
   - `specs/CONTENT_ENRICHMENT_SPEC.md`
   - `specs/LEARNER_STATE_SPEC.md`
   - `specs/RECOMMENDATION_ENGINE_SPEC.md`
   - `specs/TUTOR_INTEGRATION_SPEC.md`

### For code-structure and implementation work

1. `specs/TYPESCRIPT_CONVENTIONS.md`
2. `specs/REFERENCE_REPOS.md`
3. `specs/EFFECT_BEST_PRACTICES.md` when touching Effect-heavy code
4. `specs/EFFECT_TESTING.md` when adding tests around Effect services

## 5. Repo-Specific Guidance For Future LLM Sessions

- Treat `specs/` as the authoritative design layer for new work.
- Prefer extending the existing Convex-backed architecture rather than introducing new infrastructure without a strong reason.
- Do not assume the current UI reflects the final product; much of the student experience is still planned rather than implemented.
- Keep the distinction between canonical question content and enrichment output clear.
- Keep the distinction between raw attempts and derived learner aggregates clear.
- Do not use LLM memory systems as the primary learner model or recommendation source of truth.
- When implementing taxonomy-aware behavior, use the canonical taxonomy contract, not ad hoc labels.
- When adding new specs later, update this file so future agents can find them quickly.
