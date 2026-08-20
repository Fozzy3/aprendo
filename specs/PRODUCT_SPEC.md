# Aprendo Product Spec

## Purpose

Aprendo is an ICFES Saber 11 preparation platform built around a structured bank of questions extracted from scanned exam PDFs. The platform is intended to help students measure their current level, practice with targeted question sets, understand mistakes, and improve over time with AI-assisted study sessions.

This document describes the intended product behavior and scope. It is not a backend design doc and does not prescribe implementation details beyond the product capabilities that the system must support.

## Product Vision

The product should feel like a focused digital prep environment for ICFES students:

- Start with a diagnostic exam to estimate the student's current level.
- Track performance over time by area and subtopic.
- Recommend future practice sessions based on demonstrated strengths and weaknesses.
- Provide an AI tutor during practice and review sessions, but not during the diagnostic exam.
- Build the content foundation from a growing question bank extracted from historical and curated exam PDFs.

### Redesign direction (2026)

Aprendo is being reframed from a *question bank with analytics and a reactive tutor* into a **guided study companion**. The shift in roles:

- **Questions** are no longer the product — they are the *evidence* of mastery.
- The **taxonomy** is no longer hidden tagging — it becomes the **primary navigation surface** (the navigable *Temario* / syllabus).
- The **AI** moves from reactive post-failure chat toward a proactive teaching engine (lessons, study plan, coaching) over later phases.

The student-facing information architecture is moving toward: **Hoy · Temario · Práctica · Progreso**. This is being delivered in phases (see `plans/redesign.md`); the navigable Temario is the first delivered surface.

## Problem Statement

Students preparing for ICFES often face three problems:

- Practice content is fragmented across PDFs, books, and informal materials.
- Students do not have a clear picture of which areas or subtopics they need to improve.
- Existing study flows rarely connect question performance, targeted practice, and tutor support in one system.

Aprendo should solve this by turning static PDFs into a structured practice platform with adaptive recommendations.

## Current State Of The Project

The current repository already supports the first layer of the system:

- Admin uploads scanned PDFs.
- The backend runs OCR over the PDF.
- An LLM extracts multiple-choice questions from OCR markdown.
- Questions are stored in Convex as markdown-first documents.
- The web app can browse extracted questions.

The current product does not yet support:

- Student accounts or learner profiles
- Diagnostic exam generation and scoring
- Correct-answer storage
- Topic or subtopic tagging
- Progress tracking
- Personalized recommendations
- Practice-session review flows
- AI tutor interactions inside practice sessions

## Target Users

Primary user:

- Students preparing for ICFES Saber 11 in Colombia

Secondary users:

- Admins or operators who upload and process source PDFs
- Internal team members who monitor content quality and system behavior

## Core Product Goals

The first meaningful product version should achieve the following:

1. Build a reliable question bank from scanned PDF sources.
2. Tag each question with a stable subject and subtopic taxonomy.
3. Infer or attach a correct answer for each usable question.
4. Let students take a balanced diagnostic exam without AI assistance.
5. Store diagnostic and practice outcomes in a way that supports progress tracking.
6. Recommend future questions based on observed performance.
7. Offer an AI assistant during practice and review sessions to explain answers, give hints, and suggest similar exercises.

## Product Principles

- Question bank first: all student experiences depend on a structured, queryable bank of reusable questions.
- Diagnostic is controlled: the diagnostic exam should measure baseline ability without tutor assistance.
- Practice is adaptive: later sessions should become more targeted as the system learns about the student.
- AI should support learning, not replace solving: hints and explanations should guide reasoning rather than give away answers immediately.
- Taxonomy must be stable: recommendations and analytics depend on consistent tagging across the bank.
- Product quality depends on content quality: low-confidence or malformed questions should be excluded from student-facing flows.

## Core Domain Objects

At the product level, the system revolves around these concepts:

- Source PDF: an uploaded exam or workbook document
- Extracted question: a renderable multiple-choice question derived from a PDF
- Question metadata: subject, subtopic, difficulty, correct answer, enrichment confidence, and related content attributes
- Diagnostic exam: a fixed-length, balanced assessment used to estimate baseline performance
- Practice session: a generated set of questions chosen for learning rather than pure assessment
- Attempt: a student's interaction with a question, including answer, correctness, timing, and help usage
- Review session: a post-completion experience where the student revisits diagnostic, practice, or simulated-exam mistakes with AI support when allowed
- Learner profile: an evolving summary of the student's performance by subject and subtopic
- Syllabus (Temario): the canonical taxonomy (subjects → categories → subtopics) presented as a navigable study map, annotated per node with the student's mastery and the number of launchable questions available; the student launches subtopic-focused practice directly from it
- Today (Hoy): the student home — a daily entry point that surfaces a study streak, the day's suggested action, the week's focus area, and any session to resume. It does not introduce new learner state; it composes existing signals. (Exam-date countdown is intentionally out of scope for now.)
- Concept lesson: an AI-generated lesson that *teaches* one subtopic (Khan-Academy style) — a clear explanation that builds understanding, with an optional interactive demo to explore the concept. It is generated on demand the first time a subtopic's lesson is opened and cached globally (shared by all students), so the AI teaches *before* practice rather than only reacting after a mistake. Practice questions live in the practice features, not the lesson.
- Spaced review (Repaso): a session kind that resurfaces previously-missed questions (those whose most recent attempt was wrong), oldest first, so mistakes come back until they are learned.
- Weekly coach summary: a short AI-generated note about the student's week (a concrete win, a subject to reinforce, and a next step), generated once per week per student and shown on "Hoy".
- AI-generated practice question: when a subtopic's question inventory is thin, the student can have the AI author additional ICFES-style multiple-choice questions for that subtopic. They are added to the bank as `practice_only` (never diagnostic) and flow through the normal practice/review machinery.

## Main User Flows

### 1. Content ingestion and enrichment

Admins upload scanned PDFs. The system extracts questions, stores renderable content, and enriches each question so it becomes usable in student flows.

The enriched question bank should eventually contain:

- Question body and options
- Correct answer
- Subject
- One or more subtopics
- Optional explanation or worked solution
- Confidence and quality signals

### 2. Placement — "Nivelación" (per area)

A student is placed **one area at a time** rather than by a single mixed exam. A
nivelación covers one subject (15 diagnostic-eligible questions, 30 minutes, no
tutor) and yields that area's ICFES performance level. Completing the **first**
area unlocks the rest of the app; the other four remain visible as pending work
on "Hoy" and Progreso.

This replaces the original single 20-question diagnostic, which spread 4
questions per area — far too little evidence to claim a level in any of them.
The legacy `diagnostic` kind is retained so students placed before the change
keep their access, but it is no longer offered.

The five ICFES areas:

- Lectura Critica
- Matematicas
- Ciencias Naturales
- Sociales y Ciudadanas
- Ingles

Placement should:

- Use a fixed, intentionally selected number of questions per area
- Draw only from the highest-confidence (diagnostic-eligible) pool
- Not expose the AI tutor
- Record correctness, response time, and completion behavior
- Produce that area's baseline level and feed the learning path

### 2b. Performance levels (ICFES 1-4)

Progress is expressed in the language schools and the ICFES actually use, not an
invented scale: **Niveles de desempeño 1-4** for Lectura Crítica, Matemáticas,
Ciencias Naturales and Sociales y Ciudadanas, and the CEFR-aligned bands
**A-, A1, A2, B1, B+** for Inglés.

Each level carries a descriptor of what the student can do, and the product
always says what is missing for the next one ("te faltan 6 puntos para Nivel 3").
Cut points are a versioned contract (`docs/levels.v1.json`) so they can be
corrected against the official guide without a code change.

A level is withheld until there is enough evidence in that area; the student sees
"sin nivel aún" rather than a number derived from a handful of questions.

### 3. Results and progress view

After the diagnostic and after future practice sessions, the student should be able to see:

- Overall score or performance summary
- Performance by subject
- Performance by subtopic
- Accuracy trends over time
- Areas that need more work
- Areas that are improving

The progress view is framed around **improvement, not a static snapshot**: it leads with how much overall accuracy has changed since the diagnostic baseline, charts weekly accuracy over time, and shows a per-subject "before vs now" (diagnostic → current) with deltas. Weak subtopics link straight into their concept lesson so the next step is one tap away.

The product should communicate actionable next steps, not just scores.

### 4. Personalized practice sessions

After the diagnostic, the system should generate practice sessions using the learner profile and question metadata.

Practice generation should favor:

- Weak areas with enough supporting question inventory
- A healthy mix of remediation and confidence-building questions
- Question diversity so the student is not shown repetitive near-duplicates
- Appropriate difficulty for the student's current level

Practice sessions may be:

- General mixed practice
- Subject-focused practice
- Subtopic-focused practice
- Review sessions centered on recent mistakes

### 3b. Study history (Historial)

The student can see what they have studied **and what they have not**: a
calendar of the last months where empty days read explicitly as days without
study, every session ever taken (placement, practice, review and simulacros
alike) with its score and duration, and lifetime totals — current streak, best
streak, questions answered, overall accuracy.

It is a read-only derivation of sessions and attempts; there is no history
entity.

### 3c. Learning path (Ruta)

The path makes the route explicit: for one area, its subtopics in taxonomy
order, each showing mastery and how many questions it can launch, with the next
one to work on marked and later ones locked until the previous is mastered.
The header states the area's current level and what is missing for the next one.

The path is the **recommended route**; the Temario remains the full consultable
map behind it. Both read the same aggregates and neither introduces new state.

### 4b. Navigable syllabus (Temario)

The student can explore the full ICFES taxonomy as a study map rather than only encountering it as hidden tags. For each subject, category, and subtopic the syllabus shows:

- the student's mastery (derived from subtopic/subject aggregates, not raw accuracy)
- how many launchable questions exist for that node
- a study status (e.g. mastered, in progress, to reinforce, not yet practiced, no questions yet)

From any subtopic with available questions the student can launch a subtopic-focused practice session in one tap. The syllabus is both a progress map and a study menu, and is one of several entry points into practice (alongside the practice hub and, later, "Hoy").

Mastery and counts are read-only joins over existing data — the syllabus does not introduce a new source of truth.

### 4c. Concept lessons (proactive AI teaching)

From a subtopic in the Temario the student can open a concept lesson before practicing. A lesson teaches the concept itself (Khan-Academy style): a clear written explanation that builds understanding, optionally paired with a small interactive demo to explore the idea. It deliberately contains no practice questions or exam-format tips — those belong to the practice features. Lessons are generated by AI on first request and cached per subtopic (global, not per student), so the cost is paid once and the content is reused.

This makes the AI a proactive teaching engine rather than only a reactive post-mistake tutor. The lesson is independent of any practice session; the student can launch subtopic practice from the lesson page at any time.

### 4d. Simulated exams (Simulacros)

Two shapes:

- **Full exam** — the two official sittings with the real ICFES distribution.
- **By area** — one area only, at the official total for that area and the same
  pace (~2.25 min/question). Far shorter, and the natural way to rehearse a
  single subject.

Per-area results are kept separate from full-exam results; mixing them would
report a whole-exam score the student never sat.

### 4e. Grouped questions (shared stimulus)

Many ICFES questions share a text, table or graphic ("Responda las preguntas 4 a
7 de acuerdo con la siguiente información"). The product treats such a run as a
**group**: the stimulus is stored once, the members stay linked, sessions select
whole groups (never a fragment), the members are presented consecutively, and
the stimulus is rendered once above the stem with a "pregunta 2 de 4 de este
texto" marker. The tutor receives the stimulus too.

A group that does not fit the remaining slots in a session is dropped entirely
rather than split.

### 5. Focused solving and review

Active solving and review are separate experiences.

During active solving, the interface should be minimal and focused on answering one question at a time. It should not show correctness, correct answers, or official explanations before the session is completed.

After completion, the student should move into a review experience where they can inspect which questions were correct or incorrect, see explanations, navigate between reviewed questions, and use the tutor when the session type allows it.

The review experience should be reusable across practice, diagnostic, and future simulated exam sessions.

### 6. AI-assisted practice and review

During practice and review, the student should be able to interact with an AI tutor alongside the question flow.

The assistant should support:

- Hints before answering
- Step-by-step explanation after answering
- Clarification of concepts or vocabulary
- Advice about how to approach similar questions
- Follow-up prompts such as "Explain the answer", "Give me a similar problem", or "What should I review next?"

The assistant should not be available during the diagnostic exam.

## Required Product Features

### Question bank features

- Store questions extracted from scanned PDFs
- Render markdown, math, tables, and embedded images
- Maintain source traceability back to the PDF upload
- Mark questions as usable, low-confidence, or excluded

### Content enrichment features

- Assign correct answers to each question
- Assign subject and subtopic tags from a predefined taxonomy
- Store enrichment confidence and provenance
- Support reprocessing when the taxonomy or prompts change

### Student assessment features

- Deliver a diagnostic exam
- Score the diagnostic
- Generate a baseline performance profile
- Prevent tutor assistance during diagnostic completion

### Practice features

- Generate question sets from the bank
- Present one question at a time in a focused interface
- Allow answering, skipping, and navigating within a session
- Support practice-specific AI help without revealing answers before review

### Review and analytics features

- Show correctness and explanations after completed sessions
- Reuse the review experience across practice, diagnostic, and future simulated exams
- Show performance by subject and subtopic
- Show recent mistakes and repeated weak areas
- Summarize what the student should practice next

## Personalization Expectations

The recommendation system does not need to be fully sophisticated in V1, but it must support the following product outcomes:

- Identify weak subjects after the diagnostic
- Identify weak subtopics as enough evidence accumulates
- Select future questions based on the student's history
- Avoid overfitting to tiny amounts of data
- Improve recommendations as more attempts are recorded

In product terms, the recommendation engine should answer:

- What should this student practice next?
- Which questions are appropriate right now?
- Which subtopics need reinforcement?
- Is the student improving in a given area?

## Taxonomy Requirements

Question tagging must be based on a predefined taxonomy rather than free-form LLM labels.

The taxonomy should:

- Cover the five main ICFES subject areas
- Include subtopic-level tags useful for recommendations and analytics
- Be stable enough to support long-term tracking
- Be small enough for reliable automatic tagging
- Allow one question to have more than one subtopic when necessary

This taxonomy is a dependency for the recommendation and progress systems.

## AI Tutor Requirements

The AI tutor is part of the learning experience, not part of the scoring layer.

The tutor should:

- Appear in practice and review sessions
- Be aware of the current question and answer choices
- Adapt its help based on whether the student has already answered
- Prefer hints and reasoning support over direct answer disclosure
- Provide concise, student-friendly explanations

The tutor should not:

- Participate in the diagnostic exam flow
- Change official scores after submission
- Depend on unstable or hidden product state to answer basic question-level requests

## Quality And Trust Requirements

Because the system starts from scanned PDFs and LLM enrichment, quality control is part of the product, not just the infrastructure.

The product should eventually support:

- Confidence signals for extracted questions
- Confidence signals for inferred answers
- Confidence signals for automatic tagging
- Excluding low-confidence questions from diagnostic or recommendation flows
- Re-running enrichment when prompts or models improve

## Out Of Scope For This Spec

The following topics are intentionally left for later design documents:

- Exact database schema
- Exact Convex job orchestration
- Exact recommendation algorithm
- Exact LLM prompts for answer inference and tagging
- Authentication and billing model
- Full content moderation and admin review tooling

## V1 Product Scope

The first complete student-facing version should include:

- A usable enriched question bank
- A fixed diagnostic exam flow
- A results view with subject-level and early subtopic-level performance
- Generated practice sessions based on student history
- An AI tutor in practice and review

V1 does not need:

- Perfect mastery modeling
- Highly dynamic testing theory
- Multi-model answer consensus
- Rich gamification
- Full teacher or parent dashboards

## Future Expansion

Potential later capabilities include:

- Better difficulty calibration
- More advanced adaptive testing
- Confidence-weighted recommendations
- Admin review workflows for low-confidence content
- Similar-question retrieval and content clustering
- Longitudinal study planning
- Richer coaching summaries and study plans

## Product Success Criteria

The product is succeeding when:

- PDFs can be converted into a usable and growing question bank
- Students can complete a diagnostic without assistance
- The system can identify weak areas with enough clarity to guide practice
- Practice sessions feel more relevant over time
- Students can understand mistakes through review and tutoring

## Immediate Product Dependencies

Before the intended product can exist, the system must add:

- Correct-answer enrichment
- Stable taxonomy definition
- Automatic question tagging
- Student attempt storage
- Diagnostic assembly and scoring
- Learner-profile generation

## Open Product Questions

These questions remain open for follow-up design work:

- How many questions should the first diagnostic exam contain?
- How balanced should the diagnostic be across subjects versus competencies?
- Should the first practice recommendation be conservative and broad, or aggressively targeted to weaknesses?
- What minimum confidence should be required before a question can appear in a diagnostic?
- How should the tutor behave when a student asks directly for the answer before attempting the problem?
