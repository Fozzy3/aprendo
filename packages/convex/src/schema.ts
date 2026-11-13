import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  coachSummaryDocumentValidator,
  conceptLessonDocumentValidator,
  conceptLessonStatusValidator,
  eventNameValidator,
  eventPropsValidator,
  learnerAggregateValidator,
  membershipRoleValidator,
  organizationPlanValidator,
  pdfUploadStatusValidator,
  pilotSurveyAnswersValidator,
  questionAttemptValidator,
  questionAuditDocumentValidator,
  questionDocumentValidator,
  questionGroupDocumentValidator,
  questionGuideDocumentValidator,
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
      /** School grade, 6-11. Absent means 11. */
      grade: v.optional(v.number()),
      /** Built from closed word lists (G4); what classmates see in a league. */
      nickname: v.optional(v.string()),
      leagueOptOut: v.optional(v.boolean()),
      /** Part ids of the student's sticker portrait; nothing is uploaded. */
      avatar: v.optional(v.object({ skin: v.string(), hair: v.string(), top: v.string(), accessory: v.string() })),
      /** Subjects this account may sign off in the question audit. */
      reviewerSubjects: v.optional(v.array(v.string())),
      /** When the student accepted the terms (Ley 1581); unset means not asked yet. */
      consentAt: v.optional(v.number()),
      /** Under 18 at consent: their guardian's authorization is what they confirmed. */
      isMinor: v.optional(v.boolean()),
      /** When the student finished the welcome (Phase 2); unset sends them back to it. */
      onboardedAt: v.optional(v.number()),
      /** Answers a day that complete Hoy's mission (5/10/15/20); unset means `DEFAULT_DAILY_GOAL_QUESTIONS`. */
      dailyGoalQuestions: v.optional(v.number()),
      /** The student turned off streak reminder emails; unset means on. */
      remindersOff: v.optional(v.boolean()),
      /**
       * Colombia day number of the last graded answer, set by `submitAnswer`. Not
       * backfilled: unset means no reminder until the student answers again.
       */
      lastActiveDay: v.optional(v.number()),
      /** Colombia day of the last reminder email, so one goes out a day at most. */
      lastReminderDay: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastSeenAt: v.number(),
    })
      .index('by_normalizedEmail', ['normalizedEmail'])
      .index('by_createdAt', ['createdAt'])
      .index('by_lastActiveDay', ['lastActiveDay']),
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
      /** Absent only on a school test round, whose form spans every area. */
      subtopicId: v.optional(v.string()),
      /** 'practica': 10 questions, each corrected; 'tiquete': the 3-question exit ticket, corrected at the end; 'prueba': a round of the school's test (F67). */
      kind: v.union(v.literal('practica'), v.literal('tiquete'), v.literal('prueba')),
      schoolTestId: v.optional(v.id('schoolTests')),
      /** Absent means the whole class. */
      studentIds: v.optional(v.array(v.id('students'))),
      dueAt: v.number(),
      createdAt: v.number(),
    })
      .index('by_classGroupId', ['classGroupId'])
      .index('by_schoolTestId', ['schoolTestId']),
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
      /** The school test round this cycle answers (F68). */
      schoolTestId: v.optional(v.id('schoolTests')),
      /** The improvement plan: what the class will do, by when. */
      actions: v.optional(v.array(v.object({ subtopicId: v.string(), text: v.string(), dueAt: v.number() }))),
    }).index('by_classGroupId', ['classGroupId'])
      .index('by_orgId', ['orgId']),
    questionGuides: defineTable(questionGuideDocumentValidator)
      .index('by_questionId', ['questionId'])
      .index('by_status', ['status']),
    questionAudits: defineTable(questionAuditDocumentValidator)
      .index('by_questionId', ['questionId'])
      .index('by_subjectId_status', ['subjectId', 'status'])
      .index('by_reviewedBy_reviewedAt', ['reviewedBy', 'reviewedAt']),
    // A round of a school-wide periodic test, on one fixed form (F67).
    schoolTests: defineTable({
      orgId: v.id('organizations'),
      title: v.string(),
      grades: v.array(v.string()),
      opensAt: v.number(),
      closesAt: v.number(),
      questionIds: v.array(v.id('questions')),
      createdBy: v.id('students'),
      createdAt: v.number(),
    }).index('by_orgId', ['orgId']),
    // A live team game a teacher hosts on the projector (F60). It writes no
    // `questionAttempts`: answers given in a team race are not learning evidence.
    classDuels: defineTable({
      classGroupId: v.id('classGroups'),
      orgId: v.id('organizations'),
      hostId: v.id('students'),
      questionIds: v.array(v.id('questions')),
      status: v.union(v.literal('lobby'), v.literal('playing'), v.literal('finished')),
      currentIndex: v.number(),
      teams: v.array(v.object({ name: v.string(), studentIds: v.array(v.id('students')) })),
      createdAt: v.number(),
    }).index('by_classGroupId', ['classGroupId']),
    duelAnswers: defineTable({
      duelId: v.id('classDuels'),
      questionIndex: v.number(),
      studentId: v.id('students'),
      teamIndex: v.number(),
      isCorrect: v.boolean(),
      answeredAt: v.number(),
    })
      .index('by_duelId_questionIndex', ['duelId', 'questionIndex'])
      .index('by_studentId', ['studentId']),
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
      /** Off until the school signs the minors' data addendum (G2). */
      leagueEnabled: v.optional(v.boolean()),
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
      /** The class left the league (F61); it never overrides a school that is off (G2). */
      leagueOff: v.optional(v.boolean()),
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
    // Pilot measurement (see `events.ts`): only what sessions and attempts cannot tell.
    events: defineTable({
      studentId: v.id('students'),
      name: eventNameValidator,
      at: v.number(),
      props: v.optional(eventPropsValidator),
    })
      .index('by_studentId', ['studentId'])
      .index('by_name_at', ['name', 'at']),
    // The pilot survey (see `pilotSurvey.ts`): one row per student.
    pilotSurveyResponses: defineTable({
      studentId: v.id('students'),
      // Typed on the survey's first screen; rows from before 2026-11-13 lack them.
      name: v.optional(v.string()),
      studentCode: v.optional(v.string()),
      answers: pilotSurveyAnswersValidator,
      submittedAt: v.number(),
    }).index('by_studentId', ['studentId']),
  },
  { schemaValidation: true },
)
