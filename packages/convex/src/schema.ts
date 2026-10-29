import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  coachSummaryDocumentValidator,
  conceptLessonDocumentValidator,
  conceptLessonStatusValidator,
  learnerAggregateValidator,
  membershipRoleValidator,
  organizationPlanValidator,
  pdfUploadStatusValidator,
  questionAttemptValidator,
  questionDocumentValidator,
  questionGroupDocumentValidator,
  questionReportDocumentValidator,
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
    // One row per account, whatever its role: the name predates schools, and
    // `studentId` hangs off every learner table (see the glossary in
    // DATA_MODEL_SPEC.md). Roles inside a school live in `memberships`.
    students: defineTable({
      email: v.string(),
      normalizedEmail: v.string(),
      /** Display name from sign-up, so a teacher sees people and not emails. */
      name: v.optional(v.string()),
      /** Aprendo staff: the shared question bank and school licenses. */
      isAdmin: v.optional(v.boolean()),
      // When the student sits the exam (ms). Everything about pacing hangs off
      // this: without it "tu plan de hoy" is a suggestion, with it it is a plan
      // with a deadline. Optional — students are never forced to set it.
      examDate: v.optional(v.number()),
      /** Global score (0-500) the student is aiming for, e.g. a scholarship cut. */
      targetGlobalScore: v.optional(v.number()),
      /** The career family the student studies for (`careers.ts`): reweights the plan, never the global. */
      careerFamily: v.optional(v.string()),
      // Elo ability per area, keyed by subjectId (see `elo.ts`). Lives on the
      // student rather than in its own table because it is only ever read and
      // written together with the student, and it must survive the aggregate
      // rebuild in `progress.ts`, which deletes and re-inserts its own tables.
      abilityBySubject: v.optional(v.record(v.string(), v.number())),
      abilityAttemptsBySubject: v.optional(v.record(v.string(), v.number())),
      /** Minutes a week the student means to study (G07); unset until they choose. */
      weeklyGoalMinutes: v.optional(v.number()),
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
      .index('by_studentId_startedAt', ['studentId', 'startedAt'])
      .index('by_assignmentId', ['assignmentId']),
    // Practice a teacher assigns to a class, a group or some students (F40).
    // Only practice: a teacher never grades nor watches answers live.
    assignments: defineTable({
      classGroupId: v.id('classGroups'),
      orgId: v.id('organizations'),
      createdBy: v.id('students'),
      subtopicId: v.string(),
      /** 'practica': 10 questions, each corrected; 'tiquete': the 3-question exit ticket, corrected at the end. */
      kind: v.union(v.literal('practica'), v.literal('tiquete')),
      /** Absent means the whole class. */
      studentIds: v.optional(v.array(v.id('students'))),
      dueAt: v.number(),
      createdAt: v.number(),
    }).index('by_classGroupId', ['classGroupId']),
    // A two-week teaching cycle (F42): the week plan frozen at its start, so its
    // end can show before and after. Groups are the teacher's to edit (F39).
    classCycles: defineTable({
      classGroupId: v.id('classGroups'),
      orgId: v.id('organizations'),
      createdBy: v.id('students'),
      startedAt: v.number(),
      endsAt: v.number(),
      subtopics: v.array(v.object({
        subtopicId: v.string(),
        subjectId: v.string(),
        tier: v.union(v.literal('curso'), v.literal('grupo')),
        belowCount: v.number(),
        evidencedCount: v.number(),
      })),
      groups: v.array(v.object({ subtopicId: v.string(), studentIds: v.array(v.id('students')) })),
    }).index('by_classGroupId', ['classGroupId'])
      .index('by_orgId', ['orgId']),
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
      .index('by_studentId_questionId', ['studentId', 'questionId'])
      // Every student's answers to one question: the `questionAnswerStats` backfill.
      .index('by_questionId', ['questionId']),
    // "% eligió cada opción", a running tally per question (see `answerStats.ts`).
    questionAnswerStats: defineTable({
      questionId: v.id('questions'),
      answerCount: v.number(),
      optionCounts: v.record(v.string(), v.number()),
      timeSampleMs: v.array(v.number()),
    }).index('by_questionId', ['questionId']),
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
    // A printable class guide per subtopic for teachers (F41), cached like lessons.
    classGuides: defineTable({
      subtopicId: v.string(),
      status: conceptLessonStatusValidator,
      body: v.optional(v.string()),
      modelId: v.string(),
      promptVersion: v.string(),
      failureReason: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index('by_subtopicId', ['subtopicId']),
    conceptLessons: defineTable(conceptLessonDocumentValidator)
      .index('by_subtopicId', ['subtopicId'])
      .index('by_status', ['status']),
    coachSummaries: defineTable(coachSummaryDocumentValidator)
      .index('by_studentId_weekIndex', ['studentId', 'weekIndex'])
      .index('by_status', ['status']),
    // One chat per question of a session. Rows from before have no question.
    practiceTutorThreads: defineTable({
      practiceSessionId: v.id('sessions'),
      questionId: v.optional(v.id('questions')),
      studentId: v.id('students'),
      threadId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_practiceSessionId_questionId', ['practiceSessionId', 'questionId'])
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
    // One counter per student, Colombia day and LLM feature (see `llmBudget.ts`).
    llmUsage: defineTable({
      studentId: v.id('students'),
      day: v.number(),
      feature: v.string(),
      count: v.number(),
    }).index('by_studentId_day_feature', ['studentId', 'day', 'feature']),
    // Schools (see `schools.ts`). Learner data stays keyed by `studentId` only:
    // a school sees a student through `memberships`, never by owning their rows.
    organizations: defineTable({
      name: v.string(),
      crestStorageId: v.optional(v.id('_storage')),
      plan: organizationPlanValidator,
      seatLimit: v.number(),
      licenseEndsAt: v.number(),
      createdAt: v.number(),
    }).index('by_createdAt', ['createdAt']),
    memberships: defineTable({
      orgId: v.id('organizations'),
      accountId: v.id('students'),
      role: membershipRoleValidator,
      createdAt: v.number(),
    })
      .index('by_accountId', ['accountId'])
      .index('by_orgId_role', ['orgId', 'role'])
      .index('by_orgId_accountId', ['orgId', 'accountId']),
    classGroups: defineTable({
      orgId: v.id('organizations'),
      name: v.string(),
      grade: v.string(),
      inviteCode: v.string(),
      createdAt: v.number(),
    })
      .index('by_orgId', ['orgId'])
      .index('by_inviteCode', ['inviteCode']),
    // Students and the teachers assigned to a class.
    classGroupMembers: defineTable({
      classGroupId: v.id('classGroups'),
      orgId: v.id('organizations'),
      accountId: v.id('students'),
      role: v.union(v.literal('student'), v.literal('teacher')),
      joinedAt: v.number(),
    })
      .index('by_classGroupId_role', ['classGroupId', 'role'])
      .index('by_accountId', ['accountId'])
      .index('by_orgId_accountId', ['orgId', 'accountId']),
    // "Reportar un problema" on a question (see `questionReports.ts`).
    questionReports: defineTable(questionReportDocumentValidator)
      .index('by_studentId_questionId', ['studentId', 'questionId'])
      .index('by_studentId_createdAt', ['studentId', 'createdAt'])
      .index('by_status_createdAt', ['status', 'createdAt']),
  },
  { schemaValidation: true },
)
