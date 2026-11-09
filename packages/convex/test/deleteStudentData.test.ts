import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import schema from '../src/schema'
import { modules } from './convexModules'
import { setupTest, signUp } from './signIn'
import { deleteStudentData } from '../src/students'
import { api, internal } from '../src/_generated/api'
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
  const duelId = await ctx.db.insert('classDuels', {
    classGroupId, orgId, hostId: studentId, questionIds: [], status: 'finished', currentIndex: 0,
    teams: [{ name: 'A', studentIds: [studentId] }], createdAt: now,
  })
  await ctx.db.insert('duelAnswers', { duelId, questionIndex: 0, studentId, teamIndex: 0, isCorrect: true, answeredAt: now })
  return studentId
}

const STUDENT_TABLES = [
  'students', 'sessions', 'sessionQuestions', 'questionAttempts', 'learnerSubjectAggregates',
  'learnerSubtopicAggregates', 'learnerProfileSnapshots', 'coachSummaries', 'practiceTutorThreads',
  'practiceTutorArtifacts', 'llmUsage', 'questionReports', 'memberships', 'classGroupMembers', 'duelAnswers',
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
      remaining.duelTeamSeats = (await ctx.db.query('classDuels').collect()).flatMap((duel) => duel.teams.flatMap((team) => team.studentIds)).length
      return remaining
    })

    // One row per table survives: the other student's.
    for (const table of STUDENT_TABLES) expect({ table, count: counts[table] }).toEqual({ table, count: 1 })
    expect(counts.questions).toBe(1)
    // The school and its classes are not the student's to take along.
    expect(counts.classGroups).toBe(2)
    // A duel keeps its teams, without the erased student.
    expect(counts.duelTeamSeats).toBe(1)
  })

  test('scrubs the id from classes the student left, by school and by what they took part in', async () => {
    const t = convexTest(schema, modules)
    const leftovers = await t.run(async (ctx) => {
      const studentId = await ctx.db.insert('students', { email: 'a@x.co', normalizedEmail: 'a@x.co', createdAt: now, updatedAt: now, lastSeenAt: now })
      const hostId = await ctx.db.insert('students', { email: 'h@x.co', normalizedEmail: 'h@x.co', createdAt: now, updatedAt: now, lastSeenAt: now })
      const newOrg = () => ctx.db.insert('organizations', { name: 'c', plan: 'school', seatLimit: 10, licenseEndsAt: now, createdAt: now })
      const newClass = (orgId: Id<'organizations'>, code: string) => ctx.db.insert('classGroups', { orgId, name: '11', grade: '11', inviteCode: code, createdAt: now })
      const seat = (classGroupId: Id<'classGroups'>, orgId: Id<'organizations'>) => Promise.all([
        ctx.db.insert('assignments', { classGroupId, orgId, createdBy: hostId, kind: 'practica', subtopicId: 'x', studentIds: [studentId, hostId], dueAt: now, createdAt: now }),
        ctx.db.insert('classCycles', {
          classGroupId, orgId, createdBy: hostId, startedAt: now, endsAt: now, subtopics: [],
          groups: [{ subtopicId: 'x', studentIds: [studentId, hostId] }],
        }),
        ctx.db.insert('classDuels', {
          classGroupId, orgId, hostId, questionIds: [], status: 'finished', currentIndex: 0,
          teams: [{ name: 'A', studentIds: [studentId, hostId] }], createdAt: now,
        }),
      ])

      // Still a member of the school, no longer of this class.
      const memberOrg = await newOrg()
      await ctx.db.insert('memberships', { orgId: memberOrg, accountId: studentId, role: 'student', createdAt: now })
      await seat(await newClass(memberOrg, 'left'), memberOrg)

      // Left the school altogether; only what they did there remembers it.
      const sessionOrg = await newOrg()
      const sessionClass = await newClass(sessionOrg, 'old-session')
      const [assignmentId] = await seat(sessionClass, sessionOrg)
      await ctx.db.insert('sessions', { studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual', startedAt: now, questionCount: 1, currentPosition: 0, assignmentId })

      const duelOrg = await newOrg()
      const duelClass = await newClass(duelOrg, 'old-duel')
      const [, , duelId] = await seat(duelClass, duelOrg)
      await ctx.db.insert('duelAnswers', { duelId, questionIndex: 0, studentId, teamIndex: 0, isCorrect: true, answeredAt: now })

      await deleteStudentData(ctx, studentId)

      const ids = [
        ...(await ctx.db.query('assignments').collect()).flatMap((row) => row.studentIds ?? []),
        ...(await ctx.db.query('classCycles').collect()).flatMap((row) => row.groups.flatMap((group) => group.studentIds)),
        ...(await ctx.db.query('classDuels').collect()).flatMap((row) => row.teams.flatMap((team) => team.studentIds)),
      ]
      return { kept: ids.filter((id) => id === hostId).length, erased: ids.filter((id) => id === studentId).length }
    })
    expect(leftovers).toEqual({ kept: 9, erased: 0 })
  })

  describe('a student removed before the erasure leaves no id behind', () => {
    async function schoolWithSeat() {
      const t = setupTest()
      const platform = await signUp(t, 'equipo@aprendo.co', { isAdmin: true })
      const rector = await signUp(t, 'rector@colegio.co')
      const orgId = await platform.as.mutation(api.schools.createOrganization, {
        name: 'C', plan: 'school', seatLimit: 10, licenseEndsAt: Date.now() + 86_400_000, adminEmail: 'rector@colegio.co',
      })
      const classGroupId = await rector.as.mutation(api.schools.createClassGroup, { orgId, name: '11A', grade: '11' })
      const ana = await signUp(t, 'ana@x.co')
      const inviteCode = await t.run(async (ctx) => (await ctx.db.get('classGroups', classGroupId))!.inviteCode)
      await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
      const hostId = rector.studentId
      await t.run(async (ctx) => {
        await ctx.db.insert('assignments', { classGroupId, orgId, createdBy: hostId, kind: 'practica', subtopicId: 'x', studentIds: [ana.studentId, hostId], dueAt: now, createdAt: now })
        await ctx.db.insert('classCycles', { classGroupId, orgId, createdBy: hostId, startedAt: now, endsAt: now, subtopics: [], groups: [{ subtopicId: 'x', studentIds: [ana.studentId, hostId] }] })
        await ctx.db.insert('classDuels', { classGroupId, orgId, hostId, questionIds: [], status: 'finished', currentIndex: 0, teams: [{ name: 'A', studentIds: [ana.studentId, hostId] }], createdAt: now })
      })
      return { t, rector, orgId, classGroupId, ana, hostId }
    }

    const seatedIds = (t: ReturnType<typeof setupTest>) => t.run(async (ctx) => [
      ...(await ctx.db.query('assignments').collect()).flatMap((row) => row.studentIds ?? []),
      ...(await ctx.db.query('classCycles').collect()).flatMap((row) => row.groups.flatMap((group) => group.studentIds)),
      ...(await ctx.db.query('classDuels').collect()).flatMap((row) => row.teams.flatMap((team) => team.studentIds)),
    ])

    test('removing the member scrubs the id from every class of the school', async () => {
      const { t, rector, orgId, ana, hostId } = await schoolWithSeat()
      const members = (await rector.as.query(api.schools.getSchoolAdmin, { orgId })).members
      await rector.as.mutation(api.schools.removeMember, { membershipId: members.find((member) => member.email === 'ana@x.co')!.membershipId })
      const left = await seatedIds(t)
      expect(left.filter((id) => id === ana.studentId)).toHaveLength(0)
      expect(left.filter((id) => id === hostId)).toHaveLength(3)
    })

    test('deleting the class scrubs every id it held', async () => {
      const { t, rector, classGroupId } = await schoolWithSeat()
      await rector.as.mutation(api.schools.deleteClassGroup, { classGroupId })
      expect(await seatedIds(t)).toEqual([])
    })
  })

  test('a rebuild scheduled before the erasure writes nothing back', async () => {
    const t = convexTest(schema, modules)
    const studentId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('students', { email: 'a@x.co', normalizedEmail: 'a@x.co', createdAt: now, updatedAt: now, lastSeenAt: now })
      await ctx.db.delete('students', id)
      return id
    })
    await t.mutation(internal.progress.rebuildStudentProgress, { studentId })
    expect(await t.run((ctx) => ctx.db.query('learnerProfileSnapshots').collect())).toEqual([])
  })
})
