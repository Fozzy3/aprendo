import { v } from 'convex/values'
import type { SessionKind } from './sessionKinds'

export const pdfUploadStatusValidator = v.union(
  v.literal('uploaded'),
  v.literal('processing'),
  v.literal('enriching'),
  v.literal('completed'),
  v.literal('failed'),
)

export const questionOptionValidator = v.object({
  label: v.string(),
  bodyMarkdown: v.string(),
})

export const processingStatusValidator = v.union(
  v.literal('pending'),
  v.literal('processing'),
  v.literal('completed'),
  v.literal('failed'),
  v.literal('needs_review'),
)

export const questionEligibilityValidator = v.union(
  v.literal('pending'),
  v.literal('diagnostic'),
  v.literal('practice_only'),
  v.literal('excluded'),
)

export const secondaryDimensionValidator = v.object({
  dimension: v.string(),
  value: v.string(),
})

/**
 * What the student declared about an answer they just gave. Kept in sync with
 * `CONFIDENCE_LEVELS` in `confidence.ts`, which owns what these mean.
 */
export const confidenceLevelValidator = v.union(
  v.literal('sure'),
  v.literal('unsure'),
  v.literal('guess'),
)

/**
 * Why a specific wrong option is wrong — the misconception that leads a student
 * to pick it. Explaining the option they actually chose teaches; repeating the
 * general solution they already read does not.
 */
export const distractorRationaleValidator = v.object({
  label: v.string(),
  rationaleMarkdown: v.string(),
})

export const questionDocumentValidator = v.object({
  pdfUploadId: v.id('pdfUploads'),
  questionNumber: v.number(),
  sequence: v.number(),
  bodyMarkdown: v.string(),
  options: v.array(questionOptionValidator),
  createdAt: v.number(),
  // Set when the question belongs to a shared-stimulus group ("Responda las
  // preguntas 4 a 7…"). The stimulus lives once on the group, NOT duplicated
  // into `bodyMarkdown`, so grouped questions can be presented together.
  // Optional: questions ingested before grouping existed simply have no group.
  groupId: v.optional(v.id('questionGroups')),
  /** 0-based position within the group, for "Pregunta 2 de 4 de este texto". */
  groupPosition: v.optional(v.number()),
  answerStatus: v.optional(processingStatusValidator),
  answerCorrectOption: v.optional(v.string()),
  answerSolutionMarkdown: v.optional(v.string()),
  answerConfidence: v.optional(v.number()),
  answerModelId: v.optional(v.string()),
  answerPromptVersion: v.optional(v.string()),
  answerCompletedAt: v.optional(v.number()),
  answerErrorMessage: v.optional(v.string()),
  /** One entry per wrong option, when enrichment produced them. */
  answerDistractorRationales: v.optional(v.array(distractorRationaleValidator)),
  // Elo difficulty, calibrated from real attempts (see `elo.ts`). Absent until
  // the question has been answered in at least one completed session; readers
  // must fall back to `DEFAULT_RATING` rather than assuming it is present.
  difficultyRating: v.optional(v.number()),
  difficultyAttemptCount: v.optional(v.number()),
  difficultyUpdatedAt: v.optional(v.number()),
  /**
   * The stem rendered exactly as it appears on the printed booklet, figure
   * included.
   *
   * The diagrams, tables and typeset equations in these PDFs are vector art, so
   * the text layer carries the words and loses the picture — which is why a
   * third of the bank had to be discarded as unanswerable. This is the page
   * region cut from the question's own heading to its first option: the student
   * reads what the exam actually shows, and still answers with real buttons.
   */
  renderedStemImageId: v.optional(v.id('_storage')),
  taxonomyStatus: v.optional(processingStatusValidator),
  taxonomyVersion: v.optional(v.string()),
  taxonomyRelease: v.optional(v.string()),
  subjectId: v.optional(v.string()),
  categoryId: v.optional(v.string()),
  primarySubtopicId: v.optional(v.string()),
  secondarySubtopicIds: v.optional(v.array(v.string())),
  secondaryDimensions: v.optional(v.array(secondaryDimensionValidator)),
  taggingConfidence: v.optional(v.number()),
  taxonomyModelId: v.optional(v.string()),
  taxonomyPromptVersion: v.optional(v.string()),
  taxonomyCompletedAt: v.optional(v.number()),
  taxonomyErrorMessage: v.optional(v.string()),
  eligibility: v.optional(questionEligibilityValidator),
  eligibilityReasons: v.optional(v.array(v.string())),
  eligibilityEvaluatedAt: v.optional(v.number()),
})

/**
 * A shared stimulus that a run of questions depends on — the text, table or
 * excerpt behind "RESPONDA LAS PREGUNTAS 4 A 7 DE ACUERDO CON…". Stored once
 * per group instead of being concatenated into each member's `bodyMarkdown`.
 */
export const questionGroupDocumentValidator = v.object({
  pdfUploadId: v.id('pdfUploads'),
  /** The extractor's stable key for this stimulus, unique within the upload. */
  contextKey: v.string(),
  contextMarkdown: v.string(),
  contextImages: v.optional(v.array(v.string())),
  /** The shared stimulus rendered from the page, for tables and diagrams. */
  renderedContextImageId: v.optional(v.id('_storage')),
  /** Range from the source instruction, e.g. 4 and 7. */
  firstNumber: v.number(),
  lastNumber: v.number(),
  /** How many members were actually extracted (may be fewer than the range). */
  memberCount: v.number(),
  createdAt: v.number(),
})

export const sessionKindValidator = v.union(
  v.literal('diagnostic'),
  v.literal('nivelacion'),
  v.literal('recommended'),
  v.literal('topic'),
  v.literal('simulacro'),
  v.literal('repaso'),
)

// Compile-time guard: keep the validator literals in sync with SESSION_KINDS.
type ValidatedSessionKind = typeof sessionKindValidator.type
const _assertSessionKind: ValidatedSessionKind extends SessionKind
  ? SessionKind extends ValidatedSessionKind
    ? true
    : never
  : never = true
void _assertSessionKind

export const sessionStatusValidator = v.union(
  v.literal('created'),
  v.literal('in_progress'),
  v.literal('completed'),
  v.literal('abandoned'),
)

export const selectionReasonValidator = v.union(
  v.literal('balanced_diagnostic'),
  v.literal('balanced_coverage'),
  v.literal('weak_subtopic'),
  v.literal('recent_mistake'),
  v.literal('reinforcement'),
  v.literal('confidence_building'),
  v.literal('topic_focus'),
)

export const recommendationSourceValidator = v.union(
  v.literal('diagnostic_plan'),
  v.literal('rule_based'),
  v.literal('review_mistakes'),
  v.literal('manual'),
)

export const studentSummaryValidator = v.object({
  correctCount: v.number(),
  answeredCount: v.number(),
  questionCount: v.number(),
  accuracy: v.number(),
  durationMs: v.number(),
  subjectScores: v.optional(v.array(v.object({
    subjectId: v.string(),
    correctCount: v.number(),
    answeredCount: v.number(),
    questionCount: v.number(),
    score: v.number(),
  }))),
})

export const sessionDocumentValidator = v.object({
  studentId: v.id('students'),
  kind: sessionKindValidator,
  status: sessionStatusValidator,
  recommendationSource: recommendationSourceValidator,
  // Only set for `topic` sessions — the subject the student chose.
  subjectId: v.optional(v.string()),
  // Only set for `topic` sessions launched from the syllabus — the chosen subtopic.
  subtopicId: v.optional(v.string()),
  // Only set for simulated exam sessions.
  simulacroSessionNumber: v.optional(v.number()),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  // Snapshot of the kind's time limit at creation, or absent for untimed kinds.
  timeLimitMs: v.optional(v.number()),
  // Convenience deadline (startedAt + timeLimitMs) for timed sessions.
  expiresAt: v.optional(v.number()),
  questionCount: v.number(),
  currentPosition: v.number(),
  summary: v.optional(studentSummaryValidator),
})

export const questionAttemptValidator = v.object({
  studentId: v.id('students'),
  sessionId: v.id('sessions'),
  questionId: v.id('questions'),
  sessionQuestionId: v.id('sessionQuestions'),
  attemptType: sessionKindValidator,
  selectedOption: v.optional(v.string()),
  isCorrect: v.optional(v.boolean()),
  answeredAt: v.optional(v.number()),
  responseTimeMs: v.optional(v.number()),
  usedHint: v.boolean(),
  usedTutor: v.boolean(),
  hintCount: v.number(),
  tutorMessageCount: v.number(),
  wasSkipped: v.boolean(),
  /** Declared by the student alongside the answer; absent when they skipped it. */
  confidence: v.optional(confidenceLevelValidator),
})

export const conceptLessonStatusValidator = v.union(
  v.literal('generating'),
  v.literal('ready'),
  v.literal('failed'),
)

/**
 * Sub-step within `status: 'generating'`, surfaced to the client so the loading
 * UI can be explicit: `writing` = drafting the text sections; `demo` = text is
 * ready and an interactive demo is being built.
 */
export const conceptLessonStageValidator = v.union(
  v.literal('writing'),
  v.literal('demo'),
)

/**
 * A cached, AI-generated concept lesson for one taxonomy subtopic. Global (not
 * per student) — keyed by `subtopicId`. The lesson teaches the concept itself
 * (Khan-Academy style): a written explanation plus an optional interactive demo.
 */
export const conceptLessonDocumentValidator = v.object({
  subtopicId: v.string(),
  subjectId: v.string(),
  status: conceptLessonStatusValidator,
  // Progress sub-step while `status === 'generating'` (cleared when settled).
  stage: v.optional(conceptLessonStageValidator),
  // The explanation that teaches the concept — markdown (may contain LaTeX).
  ideaBody: v.optional(v.string()),
  // Optional self-contained interactive demo (rendered in a sandboxed iframe).
  demoHtml: v.optional(v.string()),
  modelId: v.string(),
  promptVersion: v.string(),
  generatedAt: v.optional(v.number()),
  failureReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const coachSummaryStatusValidator = v.union(
  v.literal('generating'),
  v.literal('ready'),
  v.literal('failed'),
)

/**
 * A cached, AI-generated weekly coach summary for one student and one week.
 * Keyed by `(studentId, weekIndex)` where weekIndex is the Colombia-time week.
 */
export const coachSummaryDocumentValidator = v.object({
  studentId: v.id('students'),
  weekIndex: v.number(),
  status: coachSummaryStatusValidator,
  // Short markdown summary of the week's progress.
  body: v.optional(v.string()),
  modelId: v.string(),
  promptVersion: v.string(),
  generatedAt: v.optional(v.number()),
  failureReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const learnerAggregateValidator = v.object({
  studentId: v.id('students'),
  subjectId: v.string(),
  categoryId: v.optional(v.string()),
  subtopicId: v.optional(v.string()),
  attemptCount: v.number(),
  correctCount: v.number(),
  accuracy: v.number(),
  recentAttemptCount: v.number(),
  recentAccuracy: v.number(),
  avgResponseTimeMs: v.number(),
  hintRate: v.number(),
  tutorRate: v.number(),
  lastAttemptAt: v.optional(v.number()),
  masteryScore: v.number(),
  evidenceLevel: v.string(),
  updatedAt: v.number(),
})
