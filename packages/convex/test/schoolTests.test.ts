import { describe, expect, setSystemTime, spyOn, test } from 'bun:test'
import { api, internal } from '../src/_generated/api'
import type { Doc, Id } from '../src/_generated/dataModel'
import { ANSWER_GRACE_MS, ROUND_RESULTS_PER_SITTING_MS, canCheckAnswers, sealsItsQuestions } from '../src/sessionIntegrity'
import { SESSION_KIND_CONFIG } from '../src/sessionKinds'
import { PARTICIPATION_ROUNDS, areaResults, planFromRound, roundSchedule, subtopicResults } from '../src/schoolTests'
import { setupTest, signUp } from './signIn'

// The tutor agent builds its model when the module loads; some tests here reach the module, none the model.
process.env.OPENROUTER_API_KEY ??= 'test'

const DAY = 86_400_000
/** How long ago a close must be for the round to count as closed (`canRevealAnswers`). */
const PAST_GRACE = 2 * ANSWER_GRACE_MS
const MATH = 'matematicas.functions_variation.functions_graphs'
const LECTURA = 'lectura_critica.literal_comprehension.explicit_details'

describe('roundSchedule', () => {
  test('N rounds up front, spaced in weeks, each open a few days', () => {
    expect(roundSchedule({ firstOpensAt: 1000, rounds: 3, weeksBetween: 4 })).toEqual([
      { opensAt: 1000, closesAt: 1000 + 3 * DAY },
      { opensAt: 1000 + 28 * DAY, closesAt: 1000 + 31 * DAY },
      { opensAt: 1000 + 56 * DAY, closesAt: 1000 + 59 * DAY },
    ])
  })
})

describe('areaResults', () => {
  test('adds each area over the completed sittings', () => {
    expect(areaResults([
      { subjectScores: [{ subjectId: 'a', correctCount: 3, answeredCount: 4, questionCount: 5, score: 60 }] },
      { subjectScores: [{ subjectId: 'a', correctCount: 2, answeredCount: 5, questionCount: 5, score: 40 }] },
      undefined,
    ])).toEqual([{ subjectId: 'a', correctCount: 5, questionCount: 10, accuracy: 0.5 }])
  })
})

describe('subtopicResults and planFromRound', () => {
  const answers = (subtopicId: string, subjectId: string, correct: number, wrong: number) => [
    ...Array.from({ length: correct }, () => ({ subtopicId, subjectId, isCorrect: true })),
    ...Array.from({ length: wrong }, () => ({ subtopicId, subjectId, isCorrect: false })),
  ]

  test('the plan targets the weakest subtopics with enough answers, at most three', () => {
    const rows = subtopicResults([
      ...answers('a', 's', 1, 9),
      ...answers('b', 's', 5, 5),
      ...answers('c', 's', 8, 2),
      ...answers('d', 's', 9, 1),
      ...answers('e', 's', 0, 2), // too few answers to say anything
    ])
    const plan = planFromRound(rows, 123)
    expect(plan.map((action) => action.subtopicId)).toEqual(['a', 'b', 'c'])
    expect(plan.every((action) => action.dueAt === 123 && action.text.length > 0)).toBe(true)
  })
})

describe('session kind prueba', () => {
  test('is sealed like a simulacro: nothing is corrected until the end', () => {
    expect(SESSION_KIND_CONFIG.prueba.allowsImmediateFeedback).toBe(false)
    expect(SESSION_KIND_CONFIG.prueba.tutorInSolve).toBe(false)
    expect(canCheckAnswers({ kind: 'prueba', feedbackMode: 'inmediata' })).toBe(false)
    expect(sealsItsQuestions({ kind: 'prueba', status: 'in_progress' }, 1000)).toBe(true)
  })
})

type Setup = Awaited<ReturnType<typeof schoolWithBank>>

async function schoolWithBank(plan: 'school' | 'pilot' = 'school', perArea = 30) {
  const t = setupTest()
  const platform = await signUp(t, 'equipo@aprendo.co', { isAdmin: true })
  const rector = await signUp(t, 'rector@colegio.co')
  const profe = await signUp(t, 'profe@colegio.co')
  const otra = await signUp(t, 'otra@colegio.co')
  const orgId = await platform.as.mutation(api.schools.createOrganization, {
    name: 'Colegio', plan, seatLimit: 40, licenseEndsAt: Date.now() + 365 * DAY, adminEmail: 'rector@colegio.co',
  })
  await rector.as.mutation(api.schools.addTeacher, { orgId, email: 'profe@colegio.co' })
  await rector.as.mutation(api.schools.addTeacher, { orgId, email: 'otra@colegio.co' })
  const classGroupId = await rector.as.mutation(api.schools.createClassGroup, { orgId, name: '11A', grade: '11' })
  await rector.as.mutation(api.schools.createClassGroup, { orgId, name: '9A', grade: '9' })
  await rector.as.mutation(api.schools.assignTeacher, { classGroupId, accountId: profe.studentId })
  const inviteCode = (await rector.as.query(api.schools.getSchoolAdmin, { orgId })).classGroups.find((group) => group.name === '11A')!.inviteCode
  const ana = await signUp(t, 'ana@x.co')
  await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
  const beto = await signUp(t, 'beto@x.co')
  await beto.as.mutation(api.schools.joinClassGroup, { inviteCode })
  await t.run(async (ctx) => {
    const pdfStorageId = await ctx.storage.store(new Blob(['pdf']))
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId, contentType: 'application/pdf',
      sizeBytes: 3, status: 'uploaded', createdAt: 0, updatedAt: 0,
    })
    for (let position = 0; position < perArea * 2; position += 1) {
      const isMath = position < perArea
      await ctx.db.insert('questions', {
        pdfUploadId, sequence: position, questionNumber: position + 1, bodyMarkdown: `Q${position}`,
        options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }], createdAt: 0,
        subjectId: isMath ? 'matematicas' : 'lectura_critica',
        categoryId: isMath ? 'matematicas.functions_variation' : 'lectura_critica.literal_comprehension',
        primarySubtopicId: isMath ? MATH : LECTURA,
        answerCorrectOption: 'A', eligibility: 'diagnostic', bankTier: 'original',
      })
    }
  })
  return { t, rector, profe, otra, ana, beto, orgId, classGroupId }
}

async function oneOpenRound(setup: Setup, rounds = 1) {
  await setup.rector.as.mutation(api.schoolTests.createRounds, {
    orgId: setup.orgId, title: 'Prueba de grado 11', grades: ['11'],
    firstOpensAt: Date.now() - 1000, rounds, weeksBetween: 4,
  })
  const [first] = await setup.t.run((ctx) => ctx.db.query('schoolTests').order('asc').collect())
  return first!
}

/** Starts and finishes the round for one student, answering `option` on every question. */
async function sitRound(
  setup: Setup,
  who: Setup['ana'],
  assignmentId: Id<'assignments'>,
  option = 'A',
) {
  const sessionId = await who.as.mutation(api.sessions.createSession, { studentId: who.studentId, kind: 'prueba', assignmentId })
  const session = (await who.as.query(api.sessions.getSession, { sessionId }))!
  for (const item of session.questions) {
    await who.as.mutation(api.sessions.submitAnswer, {
      sessionId, sessionQuestionId: item.sessionQuestionId, selectedOption: option, responseTimeMs: 9000,
    })
  }
  await who.as.mutation(api.sessions.completeSession, { sessionId })
  return sessionId
}

/** Closes a round now: the round itself and the close its sittings copied when they started. */
async function closeRound(setup: Setup, schoolTestId: Id<'schoolTests'>) {
  await setup.t.run(async (ctx) => {
    const closesAt = Date.now() - PAST_GRACE
    await ctx.db.patch('schoolTests', schoolTestId, { opensAt: Date.now() - 2 * DAY, closesAt })
    for (const session of await ctx.db.query('sessions').collect()) {
      if (session.roundClosesAt != null) await ctx.db.patch('sessions', session._id, { roundClosesAt: closesAt })
    }
  })
}

async function assignmentFor(setup: Setup, schoolTestId: Id<'schoolTests'>) {
  return setup.t.run(async (ctx) =>
    (await ctx.db.query('assignments').withIndex('by_schoolTestId', (q) => q.eq('schoolTestId', schoolTestId)).collect())
      .find((row) => row.classGroupId === setup.classGroupId)!)
}

describe('rounds', () => {
  test('a school admin creates N rounds up front, one assignment per class of those grades', async () => {
    const setup = await schoolWithBank()
    await setup.rector.as.mutation(api.schoolTests.createRounds, {
      orgId: setup.orgId, title: 'Prueba', grades: ['11'], firstOpensAt: Date.now(), rounds: 2, weeksBetween: 4,
    })
    const { rounds, assignments } = await setup.t.run(async (ctx) => ({
      rounds: await ctx.db.query('schoolTests').collect(),
      assignments: await ctx.db.query('assignments').collect(),
    }))
    expect(rounds.map((round) => round.title)).toEqual(['Prueba · Ronda 1', 'Prueba · Ronda 2'])
    expect(assignments).toHaveLength(2)
    expect(assignments.every((row) => row.classGroupId === setup.classGroupId && row.kind === 'prueba' && row.subtopicId === undefined)).toBe(true)
    // A later round is a different form as far as the bank allows.
    const overlap = rounds[0]!.questionIds.filter((id) => rounds[1]!.questionIds.includes(id))
    expect(overlap).toHaveLength(0)
    expect(rounds[0]!.questionIds.length).toBeGreaterThan(0)
  })

  test('only a school admin creates them', async () => {
    const setup = await schoolWithBank()
    const args = { orgId: setup.orgId, title: 'Prueba', grades: ['11'], firstOpensAt: Date.now(), rounds: 1, weeksBetween: 4 }
    await expect(setup.profe.as.mutation(api.schoolTests.createRounds, args)).rejects.toThrow()
    await expect(setup.ana.as.mutation(api.schoolTests.createRounds, args)).rejects.toThrow()
  })

  test('a round reaches a student only inside its window', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)

    const mine = await setup.ana.as.query(api.teacher.listMyAssignments, { studentId: setup.ana.studentId })
    expect(mine).toMatchObject([{ assignmentId: assignment._id, kind: 'prueba', testTitle: 'Prueba de grado 11', subtopicId: null }])
    expect(mine[0]!.questionCount).toBe(round.questionIds.length)

    await setup.t.run(async (ctx) => {
      await ctx.db.patch('schoolTests', round._id, { opensAt: Date.now() + DAY, closesAt: Date.now() + 2 * DAY })
    })
    expect(await setup.ana.as.query(api.teacher.listMyAssignments, { studentId: setup.ana.studentId })).toEqual([])
    await expect(setup.ana.as.mutation(api.sessions.createSession, {
      studentId: setup.ana.studentId, kind: 'prueba', assignmentId: assignment._id,
    })).rejects.toThrow()
  })

  test('the form is fixed and sealed; handing it in keeps it sealed until the round closes', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)

    const anaSession = await setup.ana.as.mutation(api.sessions.createSession, { studentId: setup.ana.studentId, kind: 'prueba', assignmentId: assignment._id })
    const betoSession = await setup.beto.as.mutation(api.sessions.createSession, { studentId: setup.beto.studentId, kind: 'prueba', assignmentId: assignment._id })
    const ana = (await setup.ana.as.query(api.sessions.getSession, { sessionId: anaSession }))!
    const beto = (await setup.beto.as.query(api.sessions.getSession, { sessionId: betoSession }))!
    expect(ana.questions.map((item) => item.question._id)).toEqual(beto.questions.map((item) => item.question._id))
    expect(ana.questions.every((item) => item.question.answerCorrectOption === undefined)).toBe(true)
    expect(ana.session.expiresAt).toBeDefined()

    // Immediate feedback cannot be forced, and the session is one per student.
    await expect(setup.ana.as.mutation(api.sessions.createSession, {
      studentId: setup.ana.studentId, kind: 'prueba', assignmentId: assignment._id, feedbackMode: 'inmediata',
    })).rejects.toThrow()

    for (const item of ana.questions) {
      await setup.ana.as.mutation(api.sessions.submitAnswer, {
        sessionId: anaSession, sessionQuestionId: item.sessionQuestionId, selectedOption: 'A', responseTimeMs: 9000,
      })
    }
    await setup.ana.as.mutation(api.sessions.completeSession, { sessionId: anaSession })
    const handedIn = (await setup.ana.as.query(api.sessions.getSession, { sessionId: anaSession }))!
    expect(handedIn.questions.every((item) => item.question.answerCorrectOption === undefined)).toBe(true)
    expect(handedIn.questions.every((item) => item.attempt?.isCorrect === undefined)).toBe(true)

    // No side door while classmates may still be sitting the same form.
    const exported = await setup.ana.as.query(api.accountExport.exportMyData, { studentId: setup.ana.studentId })
    expect(exported.questionAttempts.every((attempt) => attempt.isCorrect === undefined)).toBe(true)
    const tutorContext = await setup.t.query(internal.tutor.getPracticeQuestionContext, {
      practiceSessionId: anaSession, studentId: setup.ana.studentId, questionId: ana.questions[0]!.question._id,
    })
    expect(tutorContext?.correctOption).toBeNull()

    await closeRound(setup, round._id)
    const closed = (await setup.ana.as.query(api.sessions.getSession, { sessionId: anaSession }))!
    expect(closed.questions.every((item) => item.question.answerCorrectOption === 'A')).toBe(true)
  })

  test('one sitting per student, only for its class, only through its assignment', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    await expect(setup.ana.as.mutation(api.sessions.createSession, { studentId: setup.ana.studentId, kind: 'prueba' })).rejects.toThrow()

    const fuera = await signUp(setup.t, 'fuera@x.co')
    await expect(fuera.as.mutation(api.sessions.createSession, {
      studentId: fuera.studentId as Id<'students'>, kind: 'prueba', assignmentId: assignment._id,
    })).rejects.toThrow()

    await sitRound(setup, setup.ana, assignment._id)
    await expect(setup.ana.as.mutation(api.sessions.createSession, {
      studentId: setup.ana.studentId, kind: 'prueba', assignmentId: assignment._id,
    })).rejects.toThrow()
  })

  test('a round assignment cannot be deleted by a teacher and stays out of the task list', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    await expect(setup.profe.as.mutation(api.teacher.deleteAssignment, { assignmentId: assignment._id })).rejects.toThrow()
    expect(await setup.profe.as.query(api.teacher.getClassAssignments, { classGroupId: setup.classGroupId })).toEqual([])
  })
})

describe('round report', () => {
  async function closedRound() {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    await sitRound(setup, setup.ana, assignment._id, 'A')
    await sitRound(setup, setup.beto, assignment._id, 'B')
    return { setup, round, assignment }
  }

  test('nothing about results until it closes, then by class and area', async () => {
    const { setup, round } = await closedRound()
    const open = await setup.rector.as.query(api.schoolTests.getRoundReport, { schoolTestId: round._id })
    expect(open.isClosed).toBe(false)
    expect(open.classes[0]).toMatchObject({ doneCount: 2, targetCount: 2, areas: [] })

    await setup.t.run(async (ctx) => {
      await ctx.db.patch('schoolTests', round._id, { opensAt: Date.now() - 2 * DAY, closesAt: Date.now() - PAST_GRACE })
    })
    const report = await setup.rector.as.query(api.schoolTests.getRoundReport, { schoolTestId: round._id })
    expect(report.isClosed).toBe(true)
    expect(report.classes).toHaveLength(1)
    expect(report.classes[0]!.areas.map((area) => area.subjectId).sort()).toEqual(['lectura_critica', 'matematicas'])
    expect(report.classes[0]!.areas.find((area) => area.subjectId === 'matematicas')).toMatchObject({ accuracy: 0.5 })
    expect(report.school.map((area) => area.subjectId).sort()).toEqual(['lectura_critica', 'matematicas'])
  })

  test('a class report names the questions it missed most; any teacher of the school may read it, a student never', async () => {
    const { setup, round, assignment } = await closedRound()
    // An item needs three answers before it says anything about the class.
    const inviteCode = await setup.t.run(async (ctx) => (await ctx.db.get('classGroups', setup.classGroupId))!.inviteCode)
    const cami = await signUp(setup.t, 'cami@x.co')
    await cami.as.mutation(api.schools.joinClassGroup, { inviteCode })
    await sitRound(setup, cami, assignment._id, 'B')
    await setup.t.run(async (ctx) => {
      await ctx.db.patch('schoolTests', round._id, { opensAt: Date.now() - 2 * DAY, closesAt: Date.now() - PAST_GRACE })
    })
    const detail = await setup.profe.as.query(api.schoolTests.getClassRoundDetail, { classGroupId: setup.classGroupId, schoolTestId: round._id })
    expect(detail.items.length).toBeGreaterThan(0)
    expect(detail.items[0]).toMatchObject({ topWrongOption: 'B', correctOption: 'A' })

    expect(await setup.otra.as.query(api.schoolTests.getClassRoundDetail, { classGroupId: setup.classGroupId, schoolTestId: round._id })).toBeTruthy()
    await expect(setup.profe.as.query(api.schoolTests.getRoundReport, { schoolTestId: round._id })).rejects.toThrow()
    await expect(setup.ana.as.query(api.schoolTests.getClassRoundDetail, { classGroupId: setup.classGroupId, schoolTestId: round._id })).rejects.toThrow()
  })

  test('a teacher sees the class rounds with participation and whether a plan exists', async () => {
    const { setup, round } = await closedRound()
    const rounds = await setup.profe.as.query(api.schoolTests.listClassRounds, { classGroupId: setup.classGroupId })
    expect(rounds).toMatchObject([{ schoolTestId: round._id, doneCount: 2, targetCount: 2, isClosed: false, hasPlan: false }])
  })
})

describe('improvement plan', () => {
  async function closedWithAnswers(rounds = 1) {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup, rounds)
    const assignment = await assignmentFor(setup, round._id)
    await sitRound(setup, setup.ana, assignment._id, 'B')
    await sitRound(setup, setup.beto, assignment._id, 'B')
    await setup.t.run(async (ctx) => {
      await ctx.db.patch('schoolTests', round._id, { opensAt: Date.now() - 2 * DAY, closesAt: Date.now() - PAST_GRACE })
    })
    return { setup, round, assignment }
  }

  test('generating from a closed round writes a cycle with actions linked to the round, once', async () => {
    const { setup, round } = await closedWithAnswers()
    const cycleId = await setup.profe.as.mutation(api.schoolTests.generateImprovementPlan, { classGroupId: setup.classGroupId, schoolTestId: round._id })
    const cycle = await setup.profe.as.query(api.teacher.getCurrentCycle, { classGroupId: setup.classGroupId })
    expect(cycle).toMatchObject({ cycleId, schoolTestId: round._id })
    expect(cycle!.actions.length).toBeGreaterThan(0)
    expect([MATH, LECTURA]).toContain(cycle!.actions[0]!.subtopicId)
    expect(cycle!.actions[0]!.text).toContain('Clase corta')

    expect(await setup.profe.as.mutation(api.schoolTests.generateImprovementPlan, { classGroupId: setup.classGroupId, schoolTestId: round._id })).toBe(cycleId)
    const rounds = await setup.profe.as.query(api.schoolTests.listClassRounds, { classGroupId: setup.classGroupId })
    expect(rounds[0]!.hasPlan).toBe(true)
  })

  test('only the class teachers generate it, and never before the round closes', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    await expect(setup.profe.as.mutation(api.schoolTests.generateImprovementPlan, { classGroupId: setup.classGroupId, schoolTestId: round._id })).rejects.toThrow()

    await setup.t.run(async (ctx) => {
      await ctx.db.patch('schoolTests', round._id, { opensAt: Date.now() - 2 * DAY, closesAt: Date.now() - PAST_GRACE })
    })
    await expect(setup.otra.as.mutation(api.schoolTests.generateImprovementPlan, { classGroupId: setup.classGroupId, schoolTestId: round._id })).rejects.toThrow()
    await expect(setup.ana.as.mutation(api.schoolTests.generateImprovementPlan, { classGroupId: setup.classGroupId, schoolTestId: round._id })).rejects.toThrow()
  })

  test('the next round is the after', async () => {
    const { setup, round } = await closedWithAnswers(2)
    await setup.profe.as.mutation(api.schoolTests.generateImprovementPlan, { classGroupId: setup.classGroupId, schoolTestId: round._id })

    const pending = await setup.profe.as.query(api.schoolTests.getCycleRoundComparison, { classGroupId: setup.classGroupId })
    expect(pending?.nextTitle).toBe('Prueba de grado 11 · Ronda 2')
    expect(pending?.rows.every((row) => row.after === null)).toBe(true)

    const nextRound = (await setup.t.run((ctx) => ctx.db.query('schoolTests').order('desc').first()))!
    await setup.t.run(async (ctx) => {
      await ctx.db.patch('schoolTests', nextRound._id, { opensAt: Date.now() - 1000, closesAt: Date.now() + DAY })
    })
    const nextAssignment = await assignmentFor(setup, nextRound._id)
    await sitRound(setup, setup.ana, nextAssignment._id, 'A')
    await sitRound(setup, setup.beto, nextAssignment._id, 'A')
    await setup.t.run(async (ctx) => {
      await ctx.db.patch('schoolTests', nextRound._id, { opensAt: Date.now() - 2 * DAY, closesAt: Date.now() - PAST_GRACE })
    })
    const after = await setup.profe.as.query(api.schoolTests.getCycleRoundComparison, { classGroupId: setup.classGroupId })
    expect(after?.rows.find((row) => row.subtopicId === MATH)).toMatchObject({ before: 0, after: 1 })
  })
})

describe('grades (F70)', () => {
  test('a class takes a grade from 6 to 11; joining sets the student grade', async () => {
    const setup = await schoolWithBank()
    await expect(setup.rector.as.mutation(api.schools.createClassGroup, { orgId: setup.orgId, name: 'X', grade: '5' })).rejects.toThrow()
    const classGroupId = await setup.rector.as.mutation(api.schools.createClassGroup, { orgId: setup.orgId, name: '9B', grade: '9' })
    const inviteCode = await setup.t.run(async (ctx) => (await ctx.db.get('classGroups', classGroupId))!.inviteCode)
    const cami = await signUp(setup.t, 'cami@x.co')
    await cami.as.mutation(api.schools.joinClassGroup, { inviteCode })
    const student = await setup.t.run((ctx) => ctx.db.get('students', cami.studentId))
    expect(student?.grade).toBe(9)
  })
})

/** Unlocks the kinds that ask for a placement first. */
async function placed(setup: Setup, who: Setup['ana']) {
  await setup.t.run((ctx) => ctx.db.insert('sessions', {
    studentId: who.studentId, kind: 'nivelacion', status: 'completed', recommendationSource: 'diagnostic_plan', subjectId: 'ingles',
    startedAt: 1, completedAt: 2, questionCount: 1, currentPosition: 1,
  }))
}

/** A session the student already has on `questionId`, answered with `option`. */
async function sessionOn(
  setup: Setup,
  who: Setup['ana'],
  questionId: Id<'questions'>,
  fields: { kind: 'topic' | 'reto' | 'diagnostic' | 'simulacro'; status: 'completed' | 'in_progress'; assignmentId?: Id<'assignments'>; expiresAt?: number; subjectId?: string; feedbackMode?: 'inmediata' },
  attempt: Partial<Doc<'questionAttempts'>> = {},
) {
  return setup.t.run(async (ctx) => {
    const sessionId = await ctx.db.insert('sessions', {
      studentId: who.studentId, recommendationSource: 'manual', startedAt: 1, questionCount: 1, currentPosition: 1, ...fields,
      ...(fields.status === 'completed' ? { completedAt: 2 } : {}),
    })
    const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId, questionId, position: 1, selectionReason: 'topic_focus' })
    await ctx.db.insert('questionAttempts', {
      studentId: who.studentId, sessionId, questionId, sessionQuestionId, attemptType: fields.kind, selectedOption: 'A', isCorrect: true, answeredAt: 2,
      usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false, ...attempt,
    })
    return sessionId
  })
}

describe('a handed-in round discloses nothing until it closes', () => {
  async function handedIn(option = 'B') {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await sitRound(setup, setup.ana, assignment._id, option)
    return { setup, round, assignment, sessionId, ana: setup.ana, studentId: setup.ana.studentId }
  }

  test('completing it reports no score, the first time or the next', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await setup.ana.as.mutation(api.sessions.createSession, { studentId: setup.ana.studentId, kind: 'prueba', assignmentId: assignment._id })
    const session = (await setup.ana.as.query(api.sessions.getSession, { sessionId }))!
    for (const item of session.questions) {
      await setup.ana.as.mutation(api.sessions.submitAnswer, { sessionId, sessionQuestionId: item.sessionQuestionId, selectedOption: 'A', responseTimeMs: 9000 })
    }
    for (let time = 0; time < 2; time += 1) {
      const result = await setup.ana.as.mutation(api.sessions.completeSession, { sessionId })
      expect(result).toMatchObject({ correctCount: 0, answeredCount: 0, accuracy: 0, subjectScores: [] })
    }
  })

  test('its session document carries no summary or mastery change', async () => {
    const { ana, sessionId } = await handedIn('A')
    const session = (await ana.as.query(api.sessions.getSession, { sessionId }))!.session
    expect(session.summary).toBeUndefined()
    expect(session.masteryChanges).toBeUndefined()
    expect(session.status).toBe('completed')
  })

  test('the session lists and the history show no score', async () => {
    const { ana, studentId, sessionId } = await handedIn('A')
    const listed = await ana.as.query(api.sessions.listSessions, { studentId })
    expect(listed.find((row) => row._id === sessionId)?.summary).toBeUndefined()
    const history = await ana.as.query(api.history.listHistory, { studentId, paginationOpts: { numItems: 10, cursor: null } })
    expect(history.page.find((row) => row._id === sessionId)?.summary).toBeUndefined()
  })

  test('the account download holds no score, aggregate or ability', async () => {
    const { ana, studentId, sessionId } = await handedIn('A')
    const exported = await ana.as.query(api.accountExport.exportMyData, { studentId })
    expect(exported.sessions.find((row) => row._id === sessionId)?.summary).toBeUndefined()
    expect(exported.learnerSubjectAggregates).toEqual([])
    expect(exported.learnerSubtopicAggregates).toEqual([])
    expect(exported.learnerProfileSnapshots.every((row) => row.overallSummary.answeredCount === 0)).toBe(true)
    expect(exported.account.abilityBySubject).toBeUndefined()
  })

  test('progress, trends, activity and ability do not move', async () => {
    const { setup, ana, studentId, round } = await handedIn('A')
    const progress = await ana.as.query(api.progress.getStudentProgress, { studentId })
    expect(progress.subjectAggregates).toEqual([])
    expect(progress.subtopicMastery).toEqual([])
    const trends = await ana.as.query(api.progress.getProgressTrends, { studentId })
    expect(trends.totalCorrect).toBe(0)
    expect(trends.weekly).toEqual([])
    const activity = await ana.as.query(api.history.getActivitySummary, { studentId })
    expect(activity.stats.totalCorrect).toBe(0)
    expect(activity.stats.accuracy).toBeNull()
    const { student, question, stats } = await setup.t.run(async (ctx) => ({
      student: await ctx.db.get('students', studentId),
      question: await ctx.db.get('questions', round.questionIds[0]!),
      stats: await ctx.db.query('questionAnswerStats').collect(),
    }))
    expect(student?.abilityBySubject).toBeUndefined()
    expect(question?.difficultyAttemptCount).toBeUndefined()
    expect(stats).toEqual([])
  })

  test('the practice builder cannot count its misses', async () => {
    const { setup, ana, studentId, round } = await handedIn('B')
    const filters = { subjectId: 'matematicas', source: 'falladas' as const }
    expect((await ana.as.query(api.sessions.getPracticeBuilderCounts, { studentId, filters })).available).toBe(0)
    await closeRound(setup, round._id)
    expect((await ana.as.query(api.sessions.getPracticeBuilderCounts, { studentId, filters })).available).toBeGreaterThan(0)
  })

  test('"reintentar las incorrectas" answers the same whatever the grades were', async () => {
    const allRight = await handedIn('A')
    await placed(allRight.setup, allRight.ana)
    const retry = (context: typeof allRight) => context.ana.as.mutation(api.sessions.createSession, {
      studentId: context.studentId, kind: 'repaso', retryFromSessionId: context.sessionId,
    })
    await expect(retry(allRight)).rejects.toThrow(/cierre la prueba/)
    const allWrong = await handedIn('B')
    await placed(allWrong.setup, allWrong.ana)
    await expect(retry(allWrong)).rejects.toThrow(/cierre la prueba/)
  })

  test('the sitting remembers the close, and its results are scheduled past it', async () => {
    const { setup, round, sessionId } = await handedIn()
    const session = await setup.t.run((ctx) => ctx.db.get('sessions', sessionId))
    expect(session?.roundClosesAt).toBe(round.closesAt)
    const jobs = await setup.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    const job = jobs.find((row) => row.name.includes('applyRoundResults'))
    expect(job?.args[0]).toEqual({ sessionId })
    expect(job?.scheduledTime).toBeGreaterThan(round.closesAt + ANSWER_GRACE_MS)
  })

  test('results apply once the round is closed, and not a moment before', async () => {
    const { setup, round, sessionId, ana, studentId } = await handedIn('B')
    await setup.t.mutation(internal.sessions.applyRoundResults, { sessionId })
    expect((await ana.as.query(api.progress.getStudentProgress, { studentId })).subjectAggregates).toEqual([])

    await closeRound(setup, round._id)
    await setup.t.mutation(internal.sessions.applyRoundResults, { sessionId })
    const progress = await ana.as.query(api.progress.getStudentProgress, { studentId })
    expect(progress.subjectAggregates.length).toBeGreaterThan(0)
    expect((await setup.t.run((ctx) => ctx.db.get('students', studentId)))?.abilityBySubject).toBeDefined()
    const session = (await ana.as.query(api.sessions.getSession, { sessionId }))!.session
    expect(session.summary?.questionCount).toBeGreaterThan(0)
    expect(session.masteryChanges?.length).toBeGreaterThan(0)
  })

  test('a sitting handed in after the close counts at once', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await setup.ana.as.mutation(api.sessions.createSession, { studentId: setup.ana.studentId, kind: 'prueba', assignmentId: assignment._id })
    const { questions } = (await setup.ana.as.query(api.sessions.getSession, { sessionId }))!
    await setup.ana.as.mutation(api.sessions.submitAnswer, { sessionId, sessionQuestionId: questions[0]!.sessionQuestionId, selectedOption: 'A', responseTimeMs: 9000 })
    await closeRound(setup, round._id)
    expect(await setup.ana.as.mutation(api.sessions.completeSession, { sessionId })).toMatchObject({ correctCount: 1 })
  })
})

describe('a teacher reads nothing of an open round', () => {
  async function wholeClassSat() {
    const setup = await schoolWithBank()
    await setup.t.run(async (ctx) => {
      for (const question of await ctx.db.query('questions').collect()) {
        await ctx.db.patch('questions', question._id, { secondaryDimensions: [{ dimension: 'competencia_oficial', value: 'razonamiento' }] })
      }
    })
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const inviteCode = await setup.t.run(async (ctx) => (await ctx.db.get('classGroups', setup.classGroupId))!.inviteCode)
    const cami = await signUp(setup.t, 'cami@x.co')
    await cami.as.mutation(api.schools.joinClassGroup, { inviteCode })
    const sessionIds = []
    for (const who of [setup.ana, setup.beto, cami]) sessionIds.push(await sitRound(setup, who, assignment._id, 'B'))
    return { setup, round, sessionIds, args: { classGroupId: setup.classGroupId } }
  }

  test('the week plan names no missed question and no key', async () => {
    const { setup, round, args } = await wholeClassSat()
    expect((await setup.profe.as.query(api.teacher.getClassTeachingPlan, args)).items).toEqual([])
    await closeRound(setup, round._id)
    expect((await setup.profe.as.query(api.teacher.getClassTeachingPlan, args)).items[0]).toMatchObject({ correctOption: 'A', topWrongOption: 'B' })
  })

  test('the competencias stay empty', async () => {
    const { setup, round, args } = await wholeClassSat()
    expect(await setup.profe.as.query(api.teacher.getClassCompetencias, args)).toEqual([])
    await closeRound(setup, round._id)
    expect((await setup.profe.as.query(api.teacher.getClassCompetencias, args)).length).toBeGreaterThan(0)
  })

  test('the competency report and the class overview do not move until the close', async () => {
    const { setup, round, sessionIds, args } = await wholeClassSat()
    expect(await setup.profe.as.query(api.teacher.getCompetencyReport, args)).toEqual([])
    const open = await setup.profe.as.query(api.teacher.getClassOverview, args)
    expect(open.students.flatMap((student) => student.subjects).every((subject) => subject.attemptCount === 0)).toBe(true)

    await closeRound(setup, round._id)
    for (const sessionId of sessionIds) await setup.t.mutation(internal.sessions.applyRoundResults, { sessionId })
    expect((await setup.profe.as.query(api.teacher.getCompetencyReport, args)).length).toBeGreaterThan(0)
  })
})

describe('a round not yet sat', () => {
  async function upcomingRound() {
    const setup = await schoolWithBank()
    await setup.rector.as.mutation(api.schoolTests.createRounds, {
      orgId: setup.orgId, title: 'Prueba', grades: ['11'], firstOpensAt: Date.now() + DAY, rounds: 1, weeksBetween: 4,
    })
    // The first questions of the area, so an unsealed selection is sure to take them.
    const round = await setup.t.run(async (ctx) => {
      const test = (await ctx.db.query('schoolTests').first())!
      const math = (await ctx.db.query('questions').order('asc').collect()).filter((question) => question.subjectId === 'matematicas')
      const questionIds = math.slice(0, 10).map((question) => question._id)
      await ctx.db.patch('schoolTests', test._id, { questionIds })
      return { ...test, questionIds }
    })
    return { setup, round, ana: setup.ana }
  }

  test('a new practice never draws its form', async () => {
    const { setup, round, ana } = await upcomingRound()
    await placed(setup, ana)
    const sessionId = await ana.as.mutation(api.sessions.createSession, { studentId: ana.studentId, kind: 'topic', subjectId: 'matematicas' })
    const { questions } = (await ana.as.query(api.sessions.getSession, { sessionId }))!
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.some((item) => (round.questionIds as string[]).includes(item.question._id))).toBe(false)
  })

  test('an old practice on one of its items keeps that key until the round closes', async () => {
    const { setup, round, ana } = await upcomingRound()
    const sessionId = await sessionOn(setup, ana, round.questionIds[0]!, { kind: 'topic', status: 'completed' })
    const sealed = (await ana.as.query(api.sessions.getSession, { sessionId }))!
    expect(sealed.questions[0]!.question.answerCorrectOption).toBeUndefined()
    await closeRound(setup, round._id)
    const open = (await ana.as.query(api.sessions.getSession, { sessionId }))!
    expect(open.questions[0]!.question.answerCorrectOption).toBe('A')
  })

  test('a student of no class of the round is not affected', async () => {
    const { setup, round } = await upcomingRound()
    const fuera = await signUp(setup.t, 'fuera@x.co')
    const sessionId = await sessionOn(setup, fuera, round.questionIds[0]!, { kind: 'topic', status: 'completed' })
    expect((await fuera.as.query(api.sessions.getSession, { sessionId }))!.questions[0]!.question.answerCorrectOption).toBe('A')
  })
})

describe('an open exit ticket seals its items everywhere', () => {
  test('a practice on the same item shows no key while the ticket runs', async () => {
    const setup = await schoolWithBank()
    const questionId = await setup.t.run(async (ctx) => (await ctx.db.query('questions').first())!._id)
    const assignmentId = await setup.t.run((ctx) => ctx.db.insert('assignments', {
      classGroupId: setup.classGroupId, orgId: setup.orgId, createdBy: setup.profe.studentId, kind: 'tiquete', subtopicId: MATH, dueAt: Date.now() + DAY, createdAt: 1,
    }))
    await sessionOn(setup, setup.ana, questionId, { kind: 'topic', status: 'in_progress', assignmentId })
    const practiceId = await sessionOn(setup, setup.ana, questionId, { kind: 'topic', status: 'completed' })
    expect((await setup.ana.as.query(api.sessions.getSession, { sessionId: practiceId }))!.questions[0]!.question.answerCorrectOption).toBeUndefined()
  })
})

describe('a simulacro report tells a sealed answer from a blank', () => {
  test('an answered item another live exam seals is answered, with no grade', async () => {
    const setup = await schoolWithBank()
    const [sealed, blank] = await setup.t.run(async (ctx) => (await ctx.db.query('questions').take(2)).map((question) => question._id))
    const sessionId = await setup.t.run(async (ctx) => {
      const id = await ctx.db.insert('sessions', {
        studentId: setup.ana.studentId, kind: 'simulacro', status: 'completed', recommendationSource: 'manual', subjectId: 'matematicas', startedAt: 1, completedAt: 2, questionCount: 2, currentPosition: 2,
      })
      for (const [index, questionId] of [sealed!, blank!].entries()) {
        const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId: id, questionId, position: index + 1, selectionReason: 'topic_focus' })
        await ctx.db.insert('questionAttempts', {
          studentId: setup.ana.studentId, sessionId: id, questionId, sessionQuestionId, attemptType: 'simulacro', ...(index === 0 ? { selectedOption: 'A', isCorrect: true } : {}),
          timeSpentMs: 9_000_000 - index, usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: index === 1,
        })
      }
      return id
    })
    await sessionOn(setup, setup.ana, sealed!, { kind: 'reto', status: 'in_progress' })
    const report = (await setup.ana.as.query(api.sessions.getSimulacroReport, { sessionId }))!
    expect(report.slowestQuestions.map((item) => [item.isCorrect, item.answered])).toEqual([[null, true], [null, false]])
  })
})

describe('the tutor refuses a sealed question', () => {
  const mapping = (setup: Setup, practiceSessionId: Id<'sessions'>, questionId: Id<'questions'>) =>
    setup.t.query(internal.tutor.getPracticeTutorThreadMapping, { practiceSessionId, studentId: setup.ana.studentId, questionId })

  test('one on the form of an open round the student has not sat', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const sessionId = await sessionOn(setup, setup.ana, round.questionIds[0]!, { kind: 'topic', status: 'completed' })
    await expect(mapping(setup, sessionId, round.questionIds[0]!)).rejects.toThrow(/tutor/i)
  })

  for (const kind of ['reto', 'diagnostic'] as const) {
    test(`one a live ${kind} asks, while it leaves the others alone`, async () => {
      const setup = await schoolWithBank()
      const [sealed, free] = await setup.t.run(async (ctx) => (await ctx.db.query('questions').take(2)).map((question) => question._id))
      await sessionOn(setup, setup.ana, sealed!, { kind, status: 'in_progress' })
      const sessionId = await sessionOn(setup, setup.ana, sealed!, { kind: 'topic', status: 'completed' })
      await expect(mapping(setup, sessionId, sealed!)).rejects.toThrow(/tutor/i)
      expect(await mapping(setup, sessionId, free!)).toBeNull()
    })
  }
})

describe('a round that shares an item with a live exam', () => {
  test('can still be handed in: its grades stay sealed anyway', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    await sessionOn(setup, setup.ana, round.questionIds[0]!, { kind: 'simulacro', status: 'in_progress', expiresAt: Date.now() + DAY })
    const sessionId = await sitRound(setup, setup.ana, assignment._id, 'A')
    expect((await setup.t.run((ctx) => ctx.db.get('sessions', sessionId)))?.status).toBe('completed')
  })
})

const startRound = (who: Setup['ana'], assignmentId: Id<'assignments'>) =>
  who.as.mutation(api.sessions.createSession, { studentId: who.studentId, kind: 'prueba', assignmentId })

async function joinClass(setup: Setup, email: string) {
  const inviteCode = await setup.t.run(async (ctx) => (await ctx.db.get('classGroups', setup.classGroupId))!.inviteCode)
  const student = await signUp(setup.t, email)
  await student.as.mutation(api.schools.joinClassGroup, { inviteCode })
  return student
}

describe('one sitting per student per round', () => {
  async function secondAssignment(setup: Setup, schoolTestId: Id<'schoolTests'>, who: Setup['ana']) {
    return setup.t.run(async (ctx) => {
      const classGroup = (await ctx.db.query('classGroups').collect()).find((row) => row.name === '9A')!
      await ctx.db.insert('classGroupMembers', { classGroupId: classGroup._id, orgId: setup.orgId, accountId: who.studentId, role: 'student', joinedAt: 1 })
      return ctx.db.insert('assignments', {
        classGroupId: classGroup._id, orgId: setup.orgId, createdBy: setup.rector.studentId, kind: 'prueba', schoolTestId, dueAt: Date.now() + DAY, createdAt: 1,
      })
    })
  }

  test('an abandoned sitting spends it too', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await startRound(setup.ana, assignment._id)
    await setup.t.run((ctx) => ctx.db.patch('sessions', sessionId, { status: 'abandoned' }))
    await expect(startRound(setup.ana, assignment._id)).rejects.toThrow(/Ya presentaste/)
  })

  test('it holds across the assignments of a round', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const first = await assignmentFor(setup, round._id)
    const second = await secondAssignment(setup, round._id, setup.ana)
    await startRound(setup.ana, first._id)
    await expect(startRound(setup.ana, second)).rejects.toThrow(/Ya presentaste/)
  })

  test('an open sitting still resumes', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await startRound(setup.ana, assignment._id)
    expect(await startRound(setup.ana, assignment._id)).toBe(sessionId)
  })
})

describe('an answer has to be one of the options', () => {
  test('a label the question lacks is refused and writes nothing', async () => {
    const setup = await schoolWithBank()
    await placed(setup, setup.ana)
    const sessionId = await setup.ana.as.mutation(api.sessions.createSession, { studentId: setup.ana.studentId, kind: 'topic', subjectId: 'matematicas' })
    const { questions } = (await setup.ana.as.query(api.sessions.getSession, { sessionId }))!
    const answer = (selectedOption: string) => setup.ana.as.mutation(api.sessions.submitAnswer, {
      sessionId, sessionQuestionId: questions[0]!.sessionQuestionId, selectedOption, responseTimeMs: 9000,
    })
    await expect(answer('Z')).rejects.toThrow(/no existe/)
    expect(await setup.t.run((ctx) => ctx.db.query('questionAttempts').collect())).toEqual([])
    expect(await answer('A')).toEqual({ answered: true })
  })
})

describe('what a teacher puts on the board', () => {
  async function closedClassRound() {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const cami = await joinClass(setup, 'cami@x.co')
    for (const who of [setup.ana, setup.beto, cami]) await sitRound(setup, who, assignment._id, 'B')
    await closeRound(setup, round._id)
    const args = { classGroupId: setup.classGroupId, schoolTestId: round._id }
    const plan = async () => (await setup.profe.as.query(api.teacher.getClassTeachingPlan, { classGroupId: setup.classGroupId })).items
    const detail = async () => (await setup.profe.as.query(api.schoolTests.getClassRoundDetail, args)).items
    return { setup, round, args, plan, detail }
  }
  const ids = (items: { questionId: string }[]) => items.map((item) => item.questionId)

  test('leaves out a voided question', async () => {
    const { setup, plan, detail } = await closedClassRound()
    const target = ids(await plan())[0] as Id<'questions'>
    await setup.t.run((ctx) => ctx.db.patch('questions', target, { voidedAt: 1 }))
    expect(ids(await plan())).not.toContain(target)
    expect(ids(await detail())).not.toContain(target)
    expect((await plan()).length).toBeGreaterThan(0)
  })

  test('leaves out a question outside the school\'s tier (G1)', async () => {
    const { setup, plan, detail } = await closedClassRound()
    const target = ids(await plan())[0] as Id<'questions'>
    await setup.t.run((ctx) => ctx.db.patch('questions', target, { bankTier: 'icfes' }))
    expect(ids(await plan())).not.toContain(target)
    expect(ids(await detail())).not.toContain(target)
  })

  for (const [name, opensAt, closesAt] of [
    ['an open form', -1000, DAY],
    ['an upcoming form', DAY, 2 * DAY],
    ['a form inside its grace', -DAY, -1000],
  ] as const) {
    test(`leaves out a question on ${name}`, async () => {
      const { setup, plan, detail } = await closedClassRound()
      const target = ids(await plan())[0] as Id<'questions'>
      await setup.t.run((ctx) => ctx.db.insert('schoolTests', {
        orgId: setup.orgId, title: 'Otra', grades: ['11'], opensAt: Date.now() + opensAt, closesAt: Date.now() + closesAt, questionIds: [target], createdBy: setup.rector.studentId, createdAt: 1,
      }))
      expect(ids(await plan())).not.toContain(target)
      expect(ids(await detail())).not.toContain(target)
    })
  }

  test('voided questions give the improvement plan no evidence', async () => {
    const { setup, round, args } = await closedClassRound()
    await setup.t.run(async (ctx) => {
      for (const question of await ctx.db.query('questions').collect()) {
        if (question.subjectId === 'lectura_critica') await ctx.db.patch('questions', question._id, { voidedAt: 1 })
      }
    })
    await setup.profe.as.mutation(api.schoolTests.generateImprovementPlan, args)
    const cycle = await setup.profe.as.query(api.teacher.getCurrentCycle, { classGroupId: setup.classGroupId })
    expect(cycle?.schoolTestId).toBe(round._id)
    expect(cycle?.actions.map((action) => action.subtopicId)).toEqual([MATH])
  })
})

describe('a round is sealed until its close and the answer grace are over', () => {
  test('inside the grace nothing reports', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    await setup.t.run((ctx) => ctx.db.patch('schoolTests', round._id, { opensAt: Date.now() - DAY, closesAt: Date.now() - 1000 }))
    const args = { classGroupId: setup.classGroupId, schoolTestId: round._id }
    expect(await setup.profe.as.query(api.schoolTests.getClassRoundDetail, args)).toEqual({ isClosed: false, items: [] })
    expect((await setup.rector.as.query(api.schoolTests.getRoundReport, { schoolTestId: round._id })).isClosed).toBe(false)
    await expect(setup.profe.as.mutation(api.schoolTests.generateImprovementPlan, args)).rejects.toThrow(/cierra/)
  })

  test('its form stays sealed in another session until then', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await startRound(setup.ana, assignment._id)
    await setup.t.run(async (ctx) => {
      await ctx.db.patch('schoolTests', round._id, { opensAt: Date.now() - DAY, closesAt: Date.now() - 1000 })
      await ctx.db.patch('sessions', sessionId, { status: 'abandoned' })
    })
    const practiceId = await sessionOn(setup, setup.ana, round.questionIds[0]!, { kind: 'topic', status: 'completed' })
    expect((await setup.ana.as.query(api.sessions.getSession, { sessionId: practiceId }))!.questions[0]!.question.answerCorrectOption).toBeUndefined()
  })
})

describe('a future round does not eat the bank', () => {
  const create = (setup: Setup, rounds: number, firstOpensAt = Date.now() - 1000) =>
    setup.rector.as.mutation(api.schoolTests.createRounds, { orgId: setup.orgId, title: 'Prueba', grades: ['11'], firstOpensAt, rounds, weeksBetween: 4 })
  const formsInOrder = (setup: Setup) => setup.t.run(async (ctx) => (await ctx.db.query('schoolTests').collect()).sort((a, b) => a.opensAt - b.opensAt))

  test('a student can still practice when later rounds hold the rest of the bank', async () => {
    const setup = await schoolWithBank()
    await create(setup, 3)
    await placed(setup, setup.ana)
    const sessionId = await setup.ana.as.mutation(api.sessions.createSession, { studentId: setup.ana.studentId, kind: 'topic', subjectId: 'matematicas' })
    expect((await setup.ana.as.query(api.sessions.getSession, { sessionId }))!.questions.length).toBeGreaterThan(0)
  })

  test('only the open round and the next one are reserved', async () => {
    const setup = await schoolWithBank()
    await create(setup, 3)
    const [first, second, third] = await formsInOrder(setup)
    const onlyOnThird = third!.questionIds.find((id) => !first!.questionIds.includes(id) && !second!.questionIds.includes(id))!
    const keyOf = async (questionId: Id<'questions'>) => {
      const sessionId = await sessionOn(setup, setup.ana, questionId, { kind: 'topic', status: 'completed' })
      return (await setup.ana.as.query(api.sessions.getSession, { sessionId }))!.questions[0]!.question.answerCorrectOption
    }
    expect(await keyOf(first!.questionIds[0]!)).toBeUndefined()
    expect(await keyOf(second!.questionIds[0]!)).toBeUndefined()
    expect(await keyOf(onlyOnThird)).toBe('A')
  })

  test('forms that would take a whole area are refused, and nothing is created', async () => {
    const setup = await schoolWithBank('school', 20)
    await expect(create(setup, 2)).rejects.toThrow(/todas las preguntas/)
    expect(await formsInOrder(setup)).toEqual([])
  })

  test('a single form that takes a whole area is refused too', async () => {
    const setup = await schoolWithBank('school', 10)
    await expect(create(setup, 1)).rejects.toThrow(/todas las preguntas/)
  })

  test('a batch that would take a whole area with a round still open is refused', async () => {
    const setup = await schoolWithBank('school', 20)
    await create(setup, 1)
    // Whatever the new form draws, the open round already holds all of one area.
    await setup.t.run(async (ctx) => {
      const math = (await ctx.db.query('questions').collect()).filter((question) => question.subjectId === 'matematicas')
      await ctx.db.patch('schoolTests', (await ctx.db.query('schoolTests').first())!._id, { questionIds: math.map((question) => question._id) })
    })
    await expect(create(setup, 1, Date.now() + 28 * DAY)).rejects.toThrow(/todas las preguntas/)
  })

  test('Hoy does not advertise a subtopic the seal has emptied', async () => {
    const setup = await schoolWithBank()
    await create(setup, 1, Date.now() + DAY)
    await setup.t.run(async (ctx) => {
      const math = (await ctx.db.query('questions').collect()).filter((question) => question.subjectId === 'matematicas')
      const round = (await ctx.db.query('schoolTests').first())!
      await ctx.db.patch('schoolTests', round._id, { questionIds: math.map((question) => question._id) })
    })
    await placed(setup, setup.ana)
    const { plan } = await setup.ana.as.query(api.today.getTodayDashboard, { studentId: setup.ana.studentId })
    const subtopics = plan.nextSubtopics.map((subtopic) => subtopic.subtopicId)
    expect(subtopics).toContain(LECTURA)
    expect(subtopics).not.toContain(MATH)
  })

  test('Hoy does not advertise a measured subtopic the seal has emptied either', async () => {
    const setup = await schoolWithBank()
    await create(setup, 1, Date.now() + DAY)
    await setup.t.run(async (ctx) => {
      const math = (await ctx.db.query('questions').collect()).filter((question) => question.subjectId === 'matematicas')
      await ctx.db.patch('schoolTests', (await ctx.db.query('schoolTests').first())!._id, { questionIds: math.map((question) => question._id) })
      await ctx.db.insert('learnerSubtopicAggregates', {
        studentId: setup.ana.studentId, subjectId: 'matematicas', subtopicId: MATH, attemptCount: 4, correctCount: 1, accuracy: 0.25, recentAttemptCount: 4, recentAccuracy: 0.25,
        avgResponseTimeMs: 1, hintRate: 0, tutorRate: 0, masteryScore: 0.25, evidenceLevel: 'low', updatedAt: 1,
      })
    })
    await placed(setup, setup.ana)
    const { plan } = await setup.ana.as.query(api.today.getTodayDashboard, { studentId: setup.ana.studentId })
    expect(plan.nextSubtopics.map((subtopic) => subtopic.subtopicId)).not.toContain(MATH)
  })
})

describe('Elo learns only from answers given before the key was shown', () => {
  test('a question revealed elsewhere does not move the ratings; a fresh one does', async () => {
    const setup = await schoolWithBank()
    const { studentId } = setup.ana
    const [revealed, fresh] = await setup.t.run(async (ctx) => (await ctx.db.query('questions').take(2)).map((question) => question._id))
    await sessionOn(setup, setup.ana, revealed!, { kind: 'topic', status: 'completed' })
    const sessionId = await setup.t.run(async (ctx) => {
      const id = await ctx.db.insert('sessions', {
        studentId, kind: 'topic', status: 'in_progress', recommendationSource: 'manual', startedAt: Date.now(), questionCount: 2, currentPosition: 1,
      })
      for (const [index, questionId] of [revealed!, fresh!].entries()) {
        const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId: id, questionId, position: index + 1, selectionReason: 'topic_focus' })
        await ctx.db.insert('questionAttempts', {
          studentId, sessionId: id, questionId, sessionQuestionId, attemptType: 'topic', selectedOption: 'A', isCorrect: true, answeredAt: Date.now(),
          usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
        })
      }
      return id
    })
    await setup.ana.as.mutation(api.sessions.completeSession, { sessionId })
    const count = (questionId: Id<'questions'>) => setup.t.run(async (ctx) => (await ctx.db.get('questions', questionId))?.difficultyAttemptCount)
    expect(await count(fresh!)).toBe(1)
    expect(await count(revealed!)).toBeNull()
    expect((await setup.t.run((ctx) => ctx.db.get('students', studentId)))?.abilityAttemptsBySubject).toEqual({ matematicas: 1 })
  })
})

describe('a session is reused only if the student may still see it (G1)', () => {
  test('one holding an ICFES item is closed and a fresh one starts', async () => {
    const setup = await schoolWithBank()
    await placed(setup, setup.ana)
    const icfes = await setup.t.run(async (ctx) => {
      const question = (await ctx.db.query('questions').filter((q) => q.eq(q.field('subjectId'), 'matematicas')).first())!
      await ctx.db.patch('questions', question._id, { bankTier: 'icfes' })
      return question._id
    })
    const stale = await sessionOn(setup, setup.ana, icfes, { kind: 'topic', status: 'in_progress', subjectId: 'matematicas', feedbackMode: 'inmediata' })
    const fresh = await setup.ana.as.mutation(api.sessions.createSession, { studentId: setup.ana.studentId, kind: 'topic', subjectId: 'matematicas' })
    expect(fresh).not.toBe(stale)
    expect((await setup.t.run((ctx) => ctx.db.get('sessions', stale)))?.status).toBe('abandoned')
    expect((await setup.ana.as.query(api.sessions.getSession, { sessionId: fresh }))!.questions.every((item) => item.question.bankTier === 'original')).toBe(true)
  })

  test('one still inside the tiers is reused', async () => {
    const setup = await schoolWithBank()
    await placed(setup, setup.ana)
    const original = await setup.t.run(async (ctx) => (await ctx.db.query('questions').filter((q) => q.eq(q.field('subjectId'), 'matematicas')).first())!._id)
    const open = await sessionOn(setup, setup.ana, original, { kind: 'topic', status: 'in_progress', subjectId: 'matematicas', feedbackMode: 'inmediata' })
    expect(await setup.ana.as.mutation(api.sessions.createSession, { studentId: setup.ana.studentId, kind: 'topic', subjectId: 'matematicas' })).toBe(open)
  })
})

describe('a closing round applies its results without a pile-up', () => {
  test('its results run past the close and grace, one slot per sitting of the round', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await startRound(setup.ana, assignment._id)
    const base = Date.now()
    setSystemTime(new Date(base - (base % 60_000) + 90_000))
    try {
      await setup.ana.as.mutation(api.sessions.completeSession, { sessionId })
    } finally {
      setSystemTime()
    }
    const job = (await setup.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).find((row) => row.name.includes('applyRoundResults'))!
    const delay = job.scheduledTime - round.closesAt - ANSWER_GRACE_MS - 1
    expect(delay).toBeGreaterThanOrEqual(0)
    expect(delay).toBeLessThan(2 * ROUND_RESULTS_PER_SITTING_MS)
  })

  test('a results job that fires before the round can settle says so', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await sitRound(setup, setup.ana, assignment._id, 'A')
    const logged = spyOn(console, 'error').mockImplementation(() => {})
    await setup.t.mutation(internal.sessions.applyRoundResults, { sessionId })
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })
})

describe('a sitting never handed in', () => {
  async function leftOpen(option = 'A') {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    const assignment = await assignmentFor(setup, round._id)
    const sessionId = await startRound(setup.ana, assignment._id)
    const { questions } = (await setup.ana.as.query(api.sessions.getSession, { sessionId }))!
    await setup.ana.as.mutation(api.sessions.submitAnswer, { sessionId, sessionQuestionId: questions[0]!.sessionQuestionId, selectedOption: option, responseTimeMs: 9000 })
    return { setup, round, assignment, sessionId, studentId: setup.ana.studentId }
  }
  const job = async (setup: Setup) => (await setup.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).find((row) => row.name.includes('settleRoundSitting'))

  test('starting it schedules its own settling past the close and the grace', async () => {
    const { setup, round, sessionId } = await leftOpen()
    const scheduled = await job(setup)
    expect(scheduled?.args[0]).toEqual({ sessionId })
    expect(scheduled?.scheduledTime).toBeGreaterThan(round.closesAt + ANSWER_GRACE_MS)
  })

  test('resuming it does not schedule a second one', async () => {
    const { setup, assignment } = await leftOpen()
    await startRound(setup.ana, assignment._id)
    const jobs = await setup.t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
    expect(jobs.filter((row) => row.name.includes('settleRoundSitting'))).toHaveLength(1)
  })

  test('at the close its saved answers are scored and count', async () => {
    const { setup, round, sessionId, studentId } = await leftOpen()
    await closeRound(setup, round._id)
    await setup.t.mutation(internal.sessions.settleRoundSitting, { sessionId })
    const session = await setup.t.run((ctx) => ctx.db.get('sessions', sessionId))
    expect(session?.status).toBe('completed')
    expect(session?.summary).toMatchObject({ correctCount: 1, answeredCount: 1, questionCount: round.questionIds.length })
    expect((await setup.ana.as.query(api.progress.getStudentProgress, { studentId })).subjectAggregates.length).toBeGreaterThan(0)
    const report = await setup.rector.as.query(api.schoolTests.getRoundReport, { schoolTestId: round._id })
    expect(report.classes[0]).toMatchObject({ doneCount: 1 })
  })

  test('one whose clock ran out before the close is scored too', async () => {
    const { setup, round, sessionId } = await leftOpen()
    await setup.t.run((ctx) => ctx.db.patch('sessions', sessionId, { expiresAt: Date.now() - DAY }))
    await closeRound(setup, round._id)
    await setup.t.mutation(internal.sessions.settleRoundSitting, { sessionId })
    expect((await setup.t.run((ctx) => ctx.db.get('sessions', sessionId)))?.status).toBe('completed')
  })

  test('a sitting already handed in is left as it was', async () => {
    const { setup, round, sessionId } = await leftOpen()
    await setup.ana.as.mutation(api.sessions.completeSession, { sessionId })
    const before = await setup.t.run((ctx) => ctx.db.get('sessions', sessionId))
    await closeRound(setup, round._id)
    await setup.t.mutation(internal.sessions.settleRoundSitting, { sessionId })
    const after = await setup.t.run((ctx) => ctx.db.get('sessions', sessionId))
    expect(after?.completedAt).toBe(before!.completedAt!)
    expect(after?.reward).toEqual(before!.reward!)
  })

  test('an abandoned one stays abandoned', async () => {
    const { setup, round, sessionId } = await leftOpen()
    await setup.t.run((ctx) => ctx.db.patch('sessions', sessionId, { status: 'abandoned' }))
    await closeRound(setup, round._id)
    await setup.t.mutation(internal.sessions.settleRoundSitting, { sessionId })
    expect((await setup.t.run((ctx) => ctx.db.get('sessions', sessionId)))?.status).toBe('abandoned')
  })

  test('Hoy stops offering one that can no longer be finished', async () => {
    const { setup, sessionId, studentId } = await leftOpen()
    expect(await setup.ana.as.query(api.teacher.listMyAssignments, { studentId })).toMatchObject([{ status: 'en_curso', sessionId }])
    await setup.t.run((ctx) => ctx.db.patch('sessions', sessionId, { expiresAt: Date.now() - DAY }))
    expect(await setup.ana.as.query(api.teacher.listMyAssignments, { studentId })).toEqual([])
  })
})

describe('listRounds', () => {
  test('counts a class from its member rows, without loading each student', async () => {
    const setup = await schoolWithBank()
    const round = await oneOpenRound(setup)
    await setup.t.run((ctx) => ctx.db.delete('students', setup.beto.studentId))
    const [row] = await setup.rector.as.query(api.schoolTests.listRounds, { orgId: setup.orgId })
    expect(row).toMatchObject({ schoolTestId: round._id, targetCount: 2 })
  })

  test('reads participation only for the most recent rounds that opened', async () => {
    const setup = await schoolWithBank()
    await setup.t.run(async (ctx) => {
      await ctx.db.insert('schoolTests', { orgId: setup.orgId, title: 'Próxima', grades: ['11'], opensAt: Date.now() + DAY, closesAt: Date.now() + 2 * DAY, questionIds: [], createdBy: setup.rector.studentId, createdAt: 1 })
      for (let index = 0; index < PARTICIPATION_ROUNDS + 2; index += 1) {
        const schoolTestId = await ctx.db.insert('schoolTests', {
          orgId: setup.orgId, title: `R${index}`, grades: ['11'], opensAt: 1, closesAt: 2, questionIds: [], createdBy: setup.rector.studentId, createdAt: 1,
        })
        await ctx.db.insert('assignments', { classGroupId: setup.classGroupId, orgId: setup.orgId, createdBy: setup.rector.studentId, kind: 'prueba', schoolTestId, dueAt: 2, createdAt: 1 })
      }
    })
    const rounds = await setup.rector.as.query(api.schoolTests.listRounds, { orgId: setup.orgId })
    const opened = rounds.filter((round) => round.hasOpened)
    expect(opened.slice(0, PARTICIPATION_ROUNDS).every((round) => round.targetCount === 2)).toBe(true)
    expect(opened.slice(PARTICIPATION_ROUNDS).map((round) => round.targetCount)).toEqual([null, null])
    expect(opened.slice(PARTICIPATION_ROUNDS).map((round) => round.doneCount)).toEqual([null, null])
  })

  test('is bounded, newest first', async () => {
    const setup = await schoolWithBank()
    await setup.t.run(async (ctx) => {
      for (let index = 0; index < 55; index += 1) {
        await ctx.db.insert('schoolTests', {
          orgId: setup.orgId, title: `R${index}`, grades: ['11'], opensAt: 1, closesAt: 2, questionIds: [], createdBy: setup.rector.studentId, createdAt: 1,
        })
      }
    })
    const rounds = await setup.rector.as.query(api.schoolTests.listRounds, { orgId: setup.orgId })
    expect(rounds).toHaveLength(50)
    expect(rounds[0]!.title).toBe('R54')
  })
})

describe('an open guided path seals its question elsewhere', () => {
  async function openPath() {
    const setup = await schoolWithBank()
    const questionId = await setup.t.run(async (ctx) => (await ctx.db.query('questions').filter((q) => q.eq(q.field('subjectId'), 'matematicas')).first())!._id)
    await sessionOn(setup, setup.ana, questionId, { kind: 'topic', status: 'in_progress', feedbackMode: 'inmediata' }, { selectedOption: 'B', isCorrect: false, checkedAt: Date.now() })
    return { setup, questionId, ana: setup.ana }
  }

  test('another immediate session cannot buy the key by checking it', async () => {
    const { setup, questionId, ana } = await openPath()
    const other = await sessionOn(setup, ana, questionId, { kind: 'topic', status: 'in_progress', feedbackMode: 'inmediata' }, { selectedOption: 'A', isCorrect: true })
    const sessionQuestionId = await setup.t.run(async (ctx) => (await ctx.db.query('sessionQuestions').withIndex('by_sessionId', (q) => q.eq('sessionId', other)).first())!._id)
    await expect(ana.as.mutation(api.sessions.checkAnswer, { sessionId: other, sessionQuestionId })).rejects.toThrow(/camino guiado/)
  })

  test('a completed session keeps its key sealed while the path is open', async () => {
    const { setup, questionId, ana } = await openPath()
    const done = await sessionOn(setup, ana, questionId, { kind: 'topic', status: 'completed' })
    expect((await ana.as.query(api.sessions.getSession, { sessionId: done }))!.questions[0]!.question.answerCorrectOption).toBeUndefined()
  })

  test('a new session does not draw it', async () => {
    const { setup, questionId, ana } = await openPath()
    await placed(setup, ana)
    // The only math question left: unsealed, a session could not avoid it.
    await setup.t.run(async (ctx) => {
      for (const question of await ctx.db.query('questions').collect()) {
        if (question.subjectId === 'matematicas' && question._id !== questionId) await ctx.db.patch('questions', question._id, { voidedAt: 1 })
      }
    })
    await expect(ana.as.mutation(api.sessions.createSession, { studentId: ana.studentId, kind: 'topic', subjectId: 'matematicas', feedbackMode: 'al_final' })).rejects.toThrow(/Todavía no hay preguntas/)
  })

  test('its own session keeps walking the path', async () => {
    const { setup, questionId, ana } = await openPath()
    const own = await setup.t.run(async (ctx) => (await ctx.db.query('sessions').first())!._id)
    const sessionQuestionId = await setup.t.run(async (ctx) => (await ctx.db.query('sessionQuestions').withIndex('by_sessionId', (q) => q.eq('sessionId', own)).first())!._id)
    expect(await ana.as.mutation(api.sessions.checkAnswer, { sessionId: own, sessionQuestionId })).toMatchObject({ guidedPathOpen: true })
    expect(await ana.as.query(api.guides.getGuideStep, { sessionId: own, sessionQuestionId })).toMatchObject({ phase: 'retry' })
    expect((await setup.t.run((ctx) => ctx.db.get('questions', questionId)))?.answerCorrectOption).toBe('A')
  })
})
