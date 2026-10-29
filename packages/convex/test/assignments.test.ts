import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { setupTest, signUp } from './signIn'

const DAY = 86_400_000
const SUBTOPIC = 'matematicas.functions_variation.functions_graphs'

async function classWithStudent() {
  const t = setupTest()
  const platform = await signUp(t, 'equipo@aprendo.co', { isAdmin: true })
  const rector = await signUp(t, 'rector@colegio.co')
  const profe = await signUp(t, 'profe@colegio.co')
  const orgId = await platform.as.mutation(api.schools.createOrganization, {
    name: 'Colegio', plan: 'school', seatLimit: 40, licenseEndsAt: Date.now() + 365 * DAY, adminEmail: 'rector@colegio.co',
  })
  await rector.as.mutation(api.schools.addTeacher, { orgId, email: 'profe@colegio.co' })
  const classGroupId = await rector.as.mutation(api.schools.createClassGroup, { orgId, name: '11A', grade: '11' })
  await rector.as.mutation(api.schools.assignTeacher, { classGroupId, accountId: profe.studentId })
  const inviteCode = (await rector.as.query(api.schools.getSchoolAdmin, { orgId })).classGroups[0]!.inviteCode
  const ana = await signUp(t, 'ana@x.co')
  await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
  // Placement unlocks practice; five usable questions on the subtopic.
  await t.run(async (ctx) => {
    await ctx.db.insert('sessions', {
      studentId: ana.studentId, kind: 'nivelacion', status: 'completed', recommendationSource: 'manual',
      subjectId: 'matematicas', startedAt: 0, completedAt: 1, questionCount: 0, currentPosition: 0,
    })
    const pdfStorageId = await ctx.storage.store(new Blob(['pdf']))
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId, contentType: 'application/pdf',
      sizeBytes: 3, status: 'uploaded', createdAt: 0, updatedAt: 0,
    })
    for (let position = 0; position < 5; position += 1) {
      await ctx.db.insert('questions', {
        pdfUploadId, sequence: position, questionNumber: position + 1, bodyMarkdown: 'q',
        options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }], createdAt: 0,
        subjectId: 'matematicas', categoryId: 'matematicas.functions_variation', primarySubtopicId: SUBTOPIC,
        answerCorrectOption: 'A', eligibility: 'practice_only',
      })
    }
  })
  return { t, profe, ana, rector, orgId, classGroupId }
}

describe('assignments', () => {
  test('a teacher assigns an exit ticket; the student sees it and starts 3 questions; the teacher sees it in progress', async () => {
    const { profe, ana, classGroupId } = await classWithStudent()
    const assignmentId = await profe.as.mutation(api.teacher.createAssignment, { classGroupId, subtopicId: SUBTOPIC, kind: 'tiquete' })

    const mine = await ana.as.query(api.teacher.listMyAssignments, { studentId: ana.studentId })
    expect(mine).toMatchObject([{ assignmentId, subtopicId: SUBTOPIC, kind: 'tiquete', status: 'pendiente' }])

    const sessionId = await ana.as.mutation(api.sessions.createSession, { studentId: ana.studentId, kind: 'topic', assignmentId })
    const session = await ana.as.query(api.sessions.getSession, { sessionId })
    expect(session?.session).toMatchObject({ assignmentId, subtopicId: SUBTOPIC, questionCount: 3 })
    expect(session?.session.feedbackMode).toBeUndefined()

    const report = await profe.as.query(api.teacher.getClassAssignments, { classGroupId })
    expect(report[0]).toMatchObject({ assignmentId, targetCount: 1, doneCount: 0, inProgressCount: 1 })
  })

  test('only class staff assign, and only the targeted students can start it', async () => {
    const { t, ana, profe, classGroupId } = await classWithStudent()
    await expect(ana.as.mutation(api.teacher.createAssignment, { classGroupId, subtopicId: SUBTOPIC, kind: 'practica' })).rejects.toThrow()
    const beto = await signUp(t, 'beto@x.co')
    const assignmentId = await profe.as.mutation(api.teacher.createAssignment, {
      classGroupId, subtopicId: SUBTOPIC, kind: 'practica', studentIds: [ana.studentId],
    })
    await expect(
      beto.as.mutation(api.sessions.createSession, { studentId: beto.studentId as Id<'students'>, kind: 'topic', assignmentId }),
    ).rejects.toThrow()
  })
})

describe('assignments, edge cases', () => {
  test('a student who has not placed yet can still start what the teacher assigned', async () => {
    const { t, profe, ana, classGroupId } = await classWithStudent()
    await t.run(async (ctx) => {
      for (const session of await ctx.db.query('sessions').collect()) await ctx.db.delete('sessions', session._id)
    })
    const assignmentId = await profe.as.mutation(api.teacher.createAssignment, { classGroupId, subtopicId: SUBTOPIC, kind: 'practica' })
    await ana.as.mutation(api.sessions.createSession, { studentId: ana.studentId, kind: 'topic', assignmentId })
  })

  test('only the class teachers (or the school admin) write to a class; ids outside the class are dropped', async () => {
    const { t, rector, ana, orgId, classGroupId } = await classWithStudent()
    const otra = await signUp(t, 'otra@colegio.co')
    await rector.as.mutation(api.schools.addTeacher, { orgId, email: 'otra@colegio.co' })
    await expect(otra.as.mutation(api.teacher.createAssignment, { classGroupId, subtopicId: SUBTOPIC, kind: 'practica' })).rejects.toThrow()
    const outsider = await signUp(t, 'x@x.co')
    const assignmentId = await rector.as.mutation(api.teacher.createAssignment, {
      classGroupId, subtopicId: SUBTOPIC, kind: 'practica', studentIds: [ana.studentId, outsider.studentId],
    })
    const [row] = await rector.as.query(api.teacher.getClassAssignments, { classGroupId })
    expect(row).toMatchObject({ assignmentId, targetCount: 1 })
  })

  test('an answer in a session still open never reaches the teacher', async () => {
    const { t, profe, ana, classGroupId } = await classWithStudent()
    await t.run(async (ctx) => {
      const question = (await ctx.db.query('questions').first())!
      await ctx.db.patch('questions', question._id, { secondaryDimensions: [{ dimension: 'competencia_oficial', value: 'argumentacion' }] })
      const sessionId = await ctx.db.insert('sessions', {
        studentId: ana.studentId, kind: 'simulacro', status: 'in_progress', recommendationSource: 'manual',
        startedAt: Date.now(), questionCount: 1, currentPosition: 1,
      })
      const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId, questionId: question._id, position: 0, selectionReason: 'balanced_coverage' })
      await ctx.db.insert('questionAttempts', {
        studentId: ana.studentId, sessionId, questionId: question._id, sessionQuestionId, attemptType: 'simulacro',
        selectedOption: 'B', isCorrect: false, answeredAt: Date.now(), usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
      })
    })
    expect(await profe.as.query(api.teacher.getClassCompetencias, { classGroupId })).toEqual([])
  })
})

describe('teaching cycles', () => {
  test('a teacher starts a 2-week cycle from the week plan, moves a student between groups, and reads before and after', async () => {
    const { profe, ana, classGroupId } = await classWithStudent()
    const cycleId = await profe.as.mutation(api.teacher.startCycle, { classGroupId })
    const cycle = await profe.as.query(api.teacher.getCurrentCycle, { classGroupId })
    expect(cycle).toMatchObject({ cycleId, groups: [] })
    expect(cycle!.endsAt - cycle!.startedAt).toBe(14 * DAY)

    await profe.as.mutation(api.teacher.setCycleGroup, {
      cycleId, subtopicId: SUBTOPIC, studentIds: [ana.studentId],
    })
    const edited = await profe.as.query(api.teacher.getCurrentCycle, { classGroupId })
    expect(edited!.groups).toMatchObject([{ subtopicId: SUBTOPIC, students: [{ studentId: ana.studentId }] }])
    // Before and after for every subtopic the cycle works on.
    expect(edited!.progress.map((row) => row.subtopicId)).toContain(SUBTOPIC)

    await expect(ana.as.mutation(api.teacher.startCycle, { classGroupId })).rejects.toThrow()
  })
})

describe('school view of cycles', () => {
  test('the school admin sees every class cycle; a teacher does not read the school list', async () => {
    const { profe, rector, orgId, classGroupId } = await classWithStudent()
    await profe.as.mutation(api.teacher.startCycle, { classGroupId })
    expect(await rector.as.query(api.teacher.listSchoolCycles, { orgId })).toMatchObject([{ classGroupName: '11A' }])
    await expect(profe.as.query(api.teacher.listSchoolCycles, { orgId })).rejects.toThrow()
  })
})

describe('class guide', () => {
  test('teaching staff can ask for a subtopic guide; a student cannot', async () => {
    const { profe, ana } = await classWithStudent()
    expect(await profe.as.mutation(api.lessons.requestClassGuide, { subtopicId: SUBTOPIC })).toEqual({ status: 'generating' })
    expect(await profe.as.query(api.lessons.getClassGuide, { subtopicId: SUBTOPIC })).toMatchObject({ status: 'generating' })
    await expect(ana.as.mutation(api.lessons.requestClassGuide, { subtopicId: SUBTOPIC })).rejects.toThrow()
  })
})
