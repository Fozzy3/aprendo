import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { DUEL_MS, balanceTeams, isDuelLive, pickDuelQuestions, teamScores } from '../src/duels'
import { setupTest, signUp } from './signIn'

const DAY = 86_400_000
const SUBTOPIC = 'matematicas.functions_variation.functions_graphs'

describe('balanceTeams', () => {
  test('teams differ by at most one and the two strongest are split', () => {
    const players = ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({ id, strength: 1000 - index * 10 }))
    const [first, second] = balanceTeams(players)
    expect(Math.abs(first!.length - second!.length)).toBeLessThanOrEqual(1)
    expect(first).toContain('a')
    expect(second).toContain('b')
    expect([...first!, ...second!].sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('teamScores', () => {
  test('counts only correct answers, per team', () => {
    expect(teamScores(2, [
      { teamIndex: 0, isCorrect: true },
      { teamIndex: 0, isCorrect: false },
      { teamIndex: 1, isCorrect: true },
      { teamIndex: 1, isCorrect: true },
    ])).toEqual([1, 2])
  })
})

describe('pickDuelQuestions', () => {
  test('round robin across areas, without repeats, up to the count', () => {
    const areas = [['a1', 'a2', 'a3'], ['b1'], []]
    const picked = pickDuelQuestions(areas, 4, () => 0.3)
    expect(picked).toHaveLength(4)
    expect(new Set(picked).size).toBe(4)
    expect(picked).toContain('b1')
  })

  test('takes what exists when the bank is short', () => {
    expect(pickDuelQuestions([['a1']], 10, () => 0.5)).toEqual(['a1'])
  })
})

describe('isDuelLive', () => {
  const duel = { status: 'playing' as const, createdAt: 1000 }
  test('a game lasts 10 minutes from when it opens, and a finished one is over', () => {
    expect(isDuelLive(duel, 1000 + DUEL_MS)).toBe(true)
    expect(isDuelLive(duel, 1001 + DUEL_MS)).toBe(false)
    expect(isDuelLive({ ...duel, status: 'finished' }, 1000)).toBe(false)
  })
})

async function classWithDuelBank(plan: 'school' | 'pilot' = 'pilot', bankTier: 'original' | 'icfes' = 'original') {
  const t = setupTest()
  const platform = await signUp(t, 'equipo@aprendo.co', { isAdmin: true })
  const rector = await signUp(t, 'rector@colegio.co')
  const profe = await signUp(t, 'profe@colegio.co')
  const orgId = await platform.as.mutation(api.schools.createOrganization, {
    name: 'Colegio', plan, seatLimit: 40, licenseEndsAt: Date.now() + 365 * DAY, adminEmail: 'rector@colegio.co',
  })
  await rector.as.mutation(api.schools.addTeacher, { orgId, email: 'profe@colegio.co' })
  const classGroupId = await rector.as.mutation(api.schools.createClassGroup, { orgId, name: '11A', grade: '11' })
  await rector.as.mutation(api.schools.assignTeacher, { classGroupId, accountId: profe.studentId })
  const inviteCode = (await rector.as.query(api.schools.getSchoolAdmin, { orgId })).classGroups[0]!.inviteCode
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
    for (let position = 0; position < 6; position += 1) {
      await ctx.db.insert('questions', {
        pdfUploadId, sequence: position, questionNumber: position + 1, bodyMarkdown: `Enunciado ${position}`,
        options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }], createdAt: 0,
        subjectId: 'matematicas', categoryId: 'matematicas.functions_variation', primarySubtopicId: SUBTOPIC,
        answerCorrectOption: 'A', eligibility: 'practice_only', bankTier,
        answerSolutionMarkdown: 'SOLUCION-SECRETA',
      })
    }
  })
  return { t, profe, rector, ana, beto, orgId, classGroupId, inviteCode }
}

async function startedDuel() {
  const setup = await classWithDuelBank()
  const { profe, ana, beto, classGroupId } = setup
  const duelId = await profe.as.mutation(api.duels.openDuel, { classGroupId })
  await ana.as.mutation(api.duels.joinDuel, { duelId, studentId: ana.studentId })
  await beto.as.mutation(api.duels.joinDuel, { duelId, studentId: beto.studentId })
  await profe.as.mutation(api.duels.beginDuel, { duelId })
  return { ...setup, duelId }
}

describe('duel', () => {
  test('a teacher opens it, students join from the banner, and teams come out balanced', async () => {
    const { profe, ana, beto, classGroupId } = await classWithDuelBank()
    const duelId = await profe.as.mutation(api.duels.openDuel, { classGroupId })
    expect(await ana.as.query(api.duels.getActiveDuel, { studentId: ana.studentId })).toMatchObject({ duelId, status: 'lobby' })

    await ana.as.mutation(api.duels.joinDuel, { duelId, studentId: ana.studentId })
    await beto.as.mutation(api.duels.joinDuel, { duelId, studentId: beto.studentId })
    await profe.as.mutation(api.duels.beginDuel, { duelId })

    const view = await profe.as.query(api.duels.getDuelHostView, { duelId })
    expect(view.status).toBe('playing')
    expect(view.teams.map((team) => team.size)).toEqual([1, 1])
    expect(view.question).not.toBeNull()
  })

  test('a student never receives the key or a classmate, only their team score', async () => {
    const { profe, ana, duelId } = await startedDuel()
    const view = await ana.as.query(api.duels.getDuelPlayerView, { duelId, studentId: ana.studentId })
    expect(view.question).not.toBeNull()
    const payload = JSON.stringify(view)
    expect(payload).not.toContain('answerCorrectOption')
    expect(payload).not.toContain('correctOption')
    expect(payload).not.toContain('SOLUCION-SECRETA')
    expect(payload).not.toContain('@x.co')
    expect(payload).not.toContain('studentIds')

    const answered = await ana.as.mutation(api.duels.answerDuel, { duelId, studentId: ana.studentId, questionIndex: 0, selectedOption: 'B' })
    expect(answered).toEqual({ isCorrect: false })
    const after = await ana.as.query(api.duels.getDuelPlayerView, { duelId, studentId: ana.studentId })
    expect(after.answered).toEqual({ isCorrect: false })

    // Second answer to the same question is refused.
    await expect(ana.as.mutation(api.duels.answerDuel, { duelId, studentId: ana.studentId, questionIndex: 0, selectedOption: 'A' })).rejects.toThrow()

    const host = await profe.as.query(api.duels.getDuelHostView, { duelId })
    expect(JSON.stringify(host)).not.toContain('correctOption')
    await profe.as.mutation(api.duels.nextDuelQuestion, { duelId })
    const closed = await profe.as.query(api.duels.getDuelHostView, { duelId })
    expect(closed.closedQuestion).toEqual({ correctOption: 'A' })
  })

  test('team score adds up, and answers write no attempt, no session and no XP', async () => {
    const { t, profe, ana, beto, duelId } = await startedDuel()
    await ana.as.mutation(api.duels.answerDuel, { duelId, studentId: ana.studentId, questionIndex: 0, selectedOption: 'A' })
    await beto.as.mutation(api.duels.answerDuel, { duelId, studentId: beto.studentId, questionIndex: 0, selectedOption: 'B' })

    const host = await profe.as.query(api.duels.getDuelHostView, { duelId })
    expect([...host.teams.map((team) => team.score)].sort()).toEqual([0, 1])
    expect(JSON.stringify(host)).not.toContain('ana@x.co')

    const counts = await t.run(async (ctx) => ({
      attempts: (await ctx.db.query('questionAttempts').collect()).length,
      sessions: (await ctx.db.query('sessions').collect()).length,
      duelAnswers: (await ctx.db.query('duelAnswers').collect()).length,
    }))
    expect(counts).toEqual({ attempts: 0, sessions: 0, duelAnswers: 2 })
  })

  test('only the class teachers open or host it; only its students join', async () => {
    const { t, profe, rector, ana, orgId, classGroupId, duelId } = await startedDuel().then(async (setup) => {
      const otra = await signUp(setup.t, 'otra@colegio.co')
      await setup.rector.as.mutation(api.schools.addTeacher, { orgId: setup.orgId, email: 'otra@colegio.co' })
      return { ...setup, otra }
    })
    const extra = await signUp(t, 'extra@colegio.co')
    await rector.as.mutation(api.schools.addTeacher, { orgId, email: 'extra@colegio.co' })
    await expect(extra.as.mutation(api.duels.openDuel, { classGroupId })).rejects.toThrow()
    await expect(ana.as.mutation(api.duels.openDuel, { classGroupId })).rejects.toThrow()
    await expect(extra.as.query(api.duels.getDuelHostView, { duelId })).rejects.toThrow()

    const outsider = await signUp(t, 'fuera@x.co')
    await expect(outsider.as.mutation(api.duels.joinDuel, { duelId, studentId: outsider.studentId as Id<'students'> })).rejects.toThrow()
    await expect(profe.as.mutation(api.duels.beginDuel, { duelId })).rejects.toThrow()
  })

  test('an item of the student\'s own live exam is not graded', async () => {
    const { t, ana, duelId } = await startedDuel()
    await t.run(async (ctx) => {
      const duel = (await ctx.db.get('classDuels', duelId))!
      const examId = await ctx.db.insert('sessions', {
        studentId: ana.studentId, kind: 'simulacro', status: 'in_progress', recommendationSource: 'rule_based', startedAt: Date.now(), questionCount: 1, currentPosition: 1,
      })
      await ctx.db.insert('sessionQuestions', { sessionId: examId, questionId: duel.questionIds[0]!, position: 1, selectionReason: 'balanced_coverage' })
    })
    await expect(ana.as.mutation(api.duels.answerDuel, { duelId, studentId: ana.studentId, questionIndex: 0, selectedOption: 'A' })).rejects.toThrow(/examen/)
    expect(await t.run((ctx) => ctx.db.query('duelAnswers').collect())).toEqual([])
  })

  test('with fewer than two students, the error hands the teacher the class code', async () => {
    const { t, profe, rector, orgId, inviteCode } = await classWithDuelBank()
    const classGroupId = await rector.as.mutation(api.schools.createClassGroup, { orgId, name: '11B', grade: '11' })
    await rector.as.mutation(api.schools.assignTeacher, { classGroupId, accountId: profe.studentId })
    const code = await t.run(async (ctx) => (await ctx.db.get('classGroups', classGroupId))!.inviteCode)
    expect(code).not.toBe(inviteCode)
    await expect(profe.as.mutation(api.duels.openDuel, { classGroupId })).rejects.toThrow(code)
  })

  test('the lobby on the projector names the class and shows its code', async () => {
    const { profe, classGroupId, inviteCode } = await classWithDuelBank()
    const duelId = await profe.as.mutation(api.duels.openDuel, { classGroupId })
    const view = await profe.as.query(api.duels.getDuelHostView, { duelId })
    expect(view).toMatchObject({ status: 'lobby', classGroupName: '11A', inviteCode })
  })

  test('a paying school draws only original questions (G1)', async () => {
    const { profe, classGroupId } = await classWithDuelBank('school', 'icfes')
    await expect(profe.as.mutation(api.duels.openDuel, { classGroupId })).rejects.toThrow(/preguntas/)
  })

  test('a duel past its 10 minutes no longer takes answers nor shows a banner', async () => {
    const { t, ana, duelId } = await startedDuel()
    await t.run(async (ctx) => {
      await ctx.db.patch('classDuels', duelId, { createdAt: Date.now() - DUEL_MS - 1000 })
    })
    await expect(ana.as.mutation(api.duels.answerDuel, { duelId, studentId: ana.studentId, questionIndex: 0, selectedOption: 'A' })).rejects.toThrow()
    expect(await ana.as.query(api.duels.getActiveDuel, { studentId: ana.studentId })).toBeNull()
    const view = await ana.as.query(api.duels.getDuelPlayerView, { duelId, studentId: ana.studentId })
    expect(view.status).toBe('finished')
  })
})

describe('teacher reports stay clear of games (G3)', () => {
  test('neither a duel result nor league XP reaches a teacher report', async () => {
    const { t, profe, ana, beto, classGroupId, duelId } = await startedDuel()
    await ana.as.mutation(api.duels.answerDuel, { duelId, studentId: ana.studentId, questionIndex: 0, selectedOption: 'A' })
    await beto.as.mutation(api.duels.answerDuel, { duelId, studentId: beto.studentId, questionIndex: 0, selectedOption: 'B' })
    await t.run(async (ctx) => {
      await ctx.db.patch('students', ana.studentId, { nickname: 'Cometa Veloz' })
      await ctx.db.patch('organizations', (await ctx.db.query('organizations').first())!._id, { leagueEnabled: true })
      await ctx.db.insert('sessions', {
        studentId: ana.studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual',
        startedAt: Date.now(), completedAt: Date.now(), questionCount: 1, currentPosition: 1,
        reward: { xp: 777, medals: ['medalla-secreta'], streakDays: 3 },
      })
    })

    const reports = await Promise.all([
      profe.as.query(api.teacher.getClassOverview, { classGroupId }),
      profe.as.query(api.teacher.getClassTeachingPlan, { classGroupId }),
      profe.as.query(api.teacher.getCompetencyReport, { classGroupId }),
      profe.as.query(api.teacher.getClassCompetencias, { classGroupId }),
      profe.as.query(api.teacher.getClassAssignments, { classGroupId }),
      profe.as.query(api.schoolTests.listClassRounds, { classGroupId }),
    ])
    const payload = JSON.stringify(reports)
    for (const secret of ['777', 'medalla-secreta', 'Cometa Veloz', 'Cóndores', 'Jaguares', 'duel', 'league', 'nickname', '"xp"']) {
      expect({ secret, found: payload.includes(secret) }).toEqual({ secret, found: false })
    }
  })
})
