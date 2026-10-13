import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import schema from '../src/schema'
import { modules } from './convexModules'
import { deleteStudentData } from '../src/students'
import type { Id } from '../src/_generated/dataModel'
import type { MutationCtx } from '../src/_generated/server'

const now = 1_700_000_000_000

async function seedStudent(ctx: MutationCtx, email: string, questionId: Id<'questions'>) {
  const studentId = await ctx.db.insert('students', {
    email, normalizedEmail: email, createdAt: now, updatedAt: now, lastSeenAt: now,
  })
  const sessionId = await ctx.db.insert('sessions', {
    studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual',
    startedAt: now, questionCount: 1, currentPosition: 0,
  })
  const sessionQuestionId = await ctx.db.insert('sessionQuestions', {
    sessionId, questionId, position: 0, selectionReason: 'topic_focus',
  })
  await ctx.db.insert('questionAttempts', {
    studentId, sessionId, questionId, sessionQuestionId, attemptType: 'topic',
    usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
  })
  const aggregate = {
    studentId, subjectId: 'matematicas', attemptCount: 1, correctCount: 1, accuracy: 1,
    recentAttemptCount: 1, recentAccuracy: 1, avgResponseTimeMs: 1, hintRate: 0, tutorRate: 0,
    masteryScore: 1, evidenceLevel: 'low', updatedAt: now,
  }
  await ctx.db.insert('learnerSubjectAggregates', aggregate)
  await ctx.db.insert('learnerSubtopicAggregates', { ...aggregate, subtopicId: 'x' })
  const summary = { correctCount: 1, answeredCount: 1, questionCount: 1, accuracy: 1, durationMs: 1 }
  await ctx.db.insert('learnerProfileSnapshots', {
    studentId, updatedAt: now, strongestSubjectIds: [], weakestSubjectIds: [], weakestSubtopicIds: [],
    overallSummary: summary,
  })
  await ctx.db.insert('coachSummaries', {
    studentId, weekIndex: 1, status: 'ready', modelId: 'm', promptVersion: 'v', createdAt: now, updatedAt: now,
  })
  await ctx.db.insert('practiceTutorThreads', {
    practiceSessionId: sessionId, studentId, threadId: `t-${email}`, createdAt: now, updatedAt: now,
  })
  await ctx.db.insert('practiceTutorArtifacts', {
    threadId: `t-${email}`, messageId: 'm', practiceSessionId: sessionId, studentId, title: 't',
    htmlBody: '<p></p>', createdAt: now,
  })
  await ctx.db.insert('llmUsage', { studentId, day: 1, feature: 'tutor', count: 1 })
  await ctx.db.insert('questionReports', {
    questionId, studentId, sessionId, reason: 'otro', status: 'open', createdAt: now,
  })
  const orgId = await ctx.db.insert('organizations', {
    name: `Colegio ${email}`, plan: 'school', seatLimit: 10, licenseEndsAt: now, createdAt: now,
  })
  await ctx.db.insert('memberships', { orgId, accountId: studentId, role: 'student', createdAt: now })
  const classGroupId = await ctx.db.insert('classGroups', { orgId, name: '11A', grade: '11', inviteCode: email, createdAt: now })
  await ctx.db.insert('classGroupMembers', { classGroupId, orgId, accountId: studentId, role: 'student', joinedAt: now })
  return studentId
}

const STUDENT_TABLES = [
  'students', 'sessions', 'sessionQuestions', 'questionAttempts', 'learnerSubjectAggregates',
  'learnerSubtopicAggregates', 'learnerProfileSnapshots', 'coachSummaries', 'practiceTutorThreads',
  'practiceTutorArtifacts', 'llmUsage', 'questionReports', 'memberships', 'classGroupMembers',
] as const

describe('deleteStudentData', () => {
  test('removes every row of the student and leaves other students and the bank alone', async () => {
    const t = convexTest(schema, modules)
    const counts = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(['pdf']))
      const pdfUploadId = await ctx.db.insert('pdfUploads', {
        fileName: 'a.pdf', slug: 'a', pdfStorageId: storageId, contentType: 'application/pdf',
        sizeBytes: 3, status: 'uploaded', createdAt: now, updatedAt: now,
      })
      const questionId = await ctx.db.insert('questions', {
        pdfUploadId, sequence: 0, questionNumber: 1, bodyMarkdown: 'q', options: [], createdAt: now,
      })
      const doomed = await seedStudent(ctx, 'a@x.co', questionId)
      await seedStudent(ctx, 'b@x.co', questionId)

      await deleteStudentData(ctx, doomed)

      const remaining: Record<string, number> = {}
      for (const table of STUDENT_TABLES) remaining[table] = (await ctx.db.query(table).collect()).length
      remaining.questions = (await ctx.db.query('questions').collect()).length
      remaining.classGroups = (await ctx.db.query('classGroups').collect()).length
      return remaining
    })

    // One row per table survives: the other student's.
    for (const table of STUDENT_TABLES) expect({ table, count: counts[table] }).toEqual({ table, count: 1 })
    expect(counts.questions).toBe(1)
    // The school and its classes are not the student's to take along.
    expect(counts.classGroups).toBe(2)
  })
})
