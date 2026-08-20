import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  coachSummaryDocumentValidator,
  conceptLessonDocumentValidator,
  learnerAggregateValidator,
  pdfUploadStatusValidator,
  questionAttemptValidator,
  questionDocumentValidator,
  questionGroupDocumentValidator,
  selectionReasonValidator,
  sessionDocumentValidator,
  studentSummaryValidator,
} from './validators'

export default defineSchema(
  {
    pdfUploads: defineTable({
      fileName: v.string(),
      slug: v.string(),
      pdfStorageId: v.id('_storage'),
      contentType: v.string(),
      sizeBytes: v.number(),
      status: pdfUploadStatusValidator,
      createdAt: v.number(),
      updatedAt: v.number(),
      errorMessage: v.optional(v.string()),
      pageCount: v.optional(v.number()),
      assetCount: v.optional(v.number()),
      questionCount: v.optional(v.number()),
      processingStartedAt: v.optional(v.number()),
      processedAt: v.optional(v.number()),
      enrichmentStartedAt: v.optional(v.number()),
      enrichedAt: v.optional(v.number()),
      ocrPagesStorageId: v.optional(v.id('_storage')),
      rawQuestionsStorageId: v.optional(v.id('_storage')),
      answerCompletedCount: v.optional(v.number()),
      taxonomyCompletedCount: v.optional(v.number()),
      diagnosticEligibleCount: v.optional(v.number()),
      excludedQuestionCount: v.optional(v.number()),
    })
      .index('by_createdAt', ['createdAt'])
      .index('by_slug', ['slug'])
      .index('by_status', ['status']),
    questionGroups: defineTable(questionGroupDocumentValidator)
      .index('by_pdfUploadId', ['pdfUploadId'])
      .index('by_pdfUploadId_contextKey', ['pdfUploadId', 'contextKey']),
    questions: defineTable(questionDocumentValidator)
      .index('by_groupId', ['groupId'])
      .index('by_pdfUploadId', ['pdfUploadId'])
      .index('by_pdfUploadId_questionNumber', ['pdfUploadId', 'questionNumber'])
      .index('by_pdfUploadId_sequence', ['pdfUploadId', 'sequence'])
      .index('by_pdfUploadId_eligibility', ['pdfUploadId', 'eligibility'])
      .index('by_subjectId_eligibility', ['subjectId', 'eligibility'])
      .index('by_primarySubtopicId_eligibility', ['primarySubtopicId', 'eligibility']),
    students: defineTable({
      email: v.string(),
      normalizedEmail: v.string(),
      isAdmin: v.optional(v.boolean()),
      // When the student sits the exam (ms). Everything about pacing hangs off
      // this: without it "tu plan de hoy" is a suggestion, with it it is a plan
      // with a deadline. Optional — students are never forced to set it.
      examDate: v.optional(v.number()),
      /** Global score (0-500) the student is aiming for, e.g. a scholarship cut. */
      targetGlobalScore: v.optional(v.number()),
      // Elo ability per area, keyed by subjectId (see `elo.ts`). Lives on the
      // student rather than in its own table because it is only ever read and
      // written together with the student, and it must survive the aggregate
      // rebuild in `progress.ts`, which deletes and re-inserts its own tables.
      abilityBySubject: v.optional(v.record(v.string(), v.number())),
      abilityAttemptsBySubject: v.optional(v.record(v.string(), v.number())),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastSeenAt: v.number(),
    })
      .index('by_normalizedEmail', ['normalizedEmail'])
      .index('by_createdAt', ['createdAt']),
    sessions: defineTable(sessionDocumentValidator)
      .index('by_studentId', ['studentId'])
      .index('by_studentId_kind', ['studentId', 'kind'])
      .index('by_studentId_status', ['studentId', 'status'])
      .index('by_studentId_kind_status', ['studentId', 'kind', 'status'])
      .index('by_studentId_startedAt', ['studentId', 'startedAt']),
    sessionQuestions: defineTable({
      sessionId: v.id('sessions'),
      questionId: v.id('questions'),
      position: v.number(),
      selectionReason: selectionReasonValidator,
      selectionMetadata: v.optional(v.string()),
    })
      .index('by_sessionId', ['sessionId'])
      .index('by_sessionId_position', ['sessionId', 'position']),
    questionAttempts: defineTable(questionAttemptValidator)
      .index('by_studentId', ['studentId'])
      .index('by_sessionId', ['sessionId'])
      .index('by_studentId_sessionId', ['studentId', 'sessionId'])
      .index('by_sessionQuestionId', ['sessionQuestionId'])
      .index('by_studentId_questionId', ['studentId', 'questionId']),
    learnerSubjectAggregates: defineTable(learnerAggregateValidator)
      .index('by_studentId', ['studentId'])
      .index('by_studentId_subjectId', ['studentId', 'subjectId']),
    learnerSubtopicAggregates: defineTable(learnerAggregateValidator)
      .index('by_studentId', ['studentId'])
      .index('by_studentId_subtopicId', ['studentId', 'subtopicId'])
      .index('by_studentId_subjectId', ['studentId', 'subjectId']),
    learnerProfileSnapshots: defineTable({
      studentId: v.id('students'),
      updatedAt: v.number(),
      strongestSubjectIds: v.array(v.string()),
      weakestSubjectIds: v.array(v.string()),
      weakestSubtopicIds: v.array(v.string()),
      diagnosticBaseline: v.optional(studentSummaryValidator),
      overallSummary: studentSummaryValidator,
    }).index('by_studentId', ['studentId']),
    conceptLessons: defineTable(conceptLessonDocumentValidator)
      .index('by_subtopicId', ['subtopicId'])
      .index('by_status', ['status']),
    coachSummaries: defineTable(coachSummaryDocumentValidator)
      .index('by_studentId_weekIndex', ['studentId', 'weekIndex'])
      .index('by_status', ['status']),
    practiceTutorThreads: defineTable({
      practiceSessionId: v.id('sessions'),
      studentId: v.id('students'),
      threadId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_practiceSessionId', ['practiceSessionId'])
      .index('by_studentId', ['studentId']),
    practiceTutorArtifacts: defineTable({
      threadId: v.string(),
      messageId: v.string(),
      practiceSessionId: v.id('sessions'),
      studentId: v.id('students'),
      title: v.string(),
      description: v.optional(v.string()),
      htmlBody: v.string(),
      createdAt: v.number(),
    })
      .index('by_threadId', ['threadId'])
      .index('by_messageId', ['messageId'])
      .index('by_practiceSessionId', ['practiceSessionId']),
  },
  { schemaValidation: true },
)
