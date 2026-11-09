/**
 * The live class duel (F60): a teacher hosts a 10-minute team game on the
 * projector and students play from their phones. A game, not evidence: it
 * writes no `questionAttempts`, gives no XP and no teacher report reads it. Only
 * team scores are public; a student's own answer is known only to that student.
 */
import { ConvexError, v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { assertIsStudent } from './auth'
import { DEFAULT_RATING } from './elo'
import { ALL_BANK_TIERS, bankTiersForStudent, collectUsableQuestionsBySubject } from './questionPool'
import { loadLiveExamQuestionIds } from './sessions'
import { SUBJECT_IDS } from './taxonomy'
import { listClassStudents, requireClassGroupWriter, unsettledFormQuestionIds } from './teacher'

/** Counted from when the game opens, lobby included. */
export const DUEL_MS = 10 * 60_000
const DUEL_QUESTION_COUNT = 10
const MIN_PLAYERS = 2
const TEAM_NAMES = ['Cóndores', 'Jaguares']

/** Two teams by snake draft (A B B A …): as even in ability as in size. */
export function balanceTeams(players: { id: string; strength: number }[]): string[][] {
  const teams: string[][] = [[], []]
  ;[...players]
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
    .forEach((player, index) => teams[index % 4 === 0 || index % 4 === 3 ? 0 : 1]!.push(player.id))
  return teams
}

export function teamScores(teamCount: number, answers: { teamIndex: number; isCorrect: boolean }[]) {
  const scores = Array.from({ length: teamCount }, () => 0)
  for (const answer of answers) if (answer.isCorrect) scores[answer.teamIndex]! += 1
  return scores
}

function shuffled<T>(items: T[], random: () => number) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap]!, copy[index]!]
  }
  return copy
}

/** Takes one from each area in turn, so a game is never all one subject. */
export function pickDuelQuestions<Q>(byArea: Q[][], count: number, random: () => number): Q[] {
  const areas = byArea.map((area) => shuffled(area, random))
  const picked: Q[] = []
  for (let turn = 0; picked.length < count && areas.some((area) => area.length > turn); turn += 1) {
    for (const area of areas) {
      if (area[turn] !== undefined && picked.length < count) picked.push(area[turn]!)
    }
  }
  return picked
}

export function isDuelLive(duel: { status: string; createdAt: number }, now: number) {
  return duel.status !== 'finished' && now <= duel.createdAt + DUEL_MS
}

/**
 * Questions every student of the class may see (G1), readable on a projector:
 * no shared text and no scanned figure. An open school round's form stays out,
 * because a duel says right or wrong at once.
 */
async function selectDuelQuestions(ctx: QueryCtx, orgId: Id<'organizations'>, students: Doc<'students'>[], now: number) {
  const allowed = await Promise.all(students.map((student) => bankTiersForStudent(ctx, student._id)))
  const tiers = ALL_BANK_TIERS.filter((tier) => allowed.every((list) => list.includes(tier)))
  const inOpenRound = await unsettledFormQuestionIds(ctx, orgId, now)
  const byArea = await Promise.all(SUBJECT_IDS.map(async (subjectId) =>
    (await collectUsableQuestionsBySubject(ctx, subjectId, ['diagnostic', 'practice_only'], tiers)).filter((question) =>
      question.groupId == null
      && (question.renderedStemImageId == null || question.stemDisplay === 'text')
      && !inOpenRound.has(question._id))))
  return pickDuelQuestions(byArea, DUEL_QUESTION_COUNT, Math.random).map((question) => question._id)
}

async function latestDuel(ctx: QueryCtx, classGroupId: Id<'classGroups'>) {
  return ctx.db
    .query('classDuels')
    .withIndex('by_classGroupId', (q) => q.eq('classGroupId', classGroupId))
    .order('desc')
    .first()
}

/** Opens the lobby, or returns the game already running in this class. */
export const openDuel = mutation({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    const { classGroup, accountId } = await requireClassGroupWriter(ctx, args.classGroupId)
    const now = Date.now()
    const latest = await latestDuel(ctx, args.classGroupId)
    if (latest != null && isDuelLive(latest, now)) return latest._id

    const students = await listClassStudents(ctx, args.classGroupId)
    if (students.length < MIN_PLAYERS) throw new ConvexError('Hacen falta al menos dos estudiantes en el curso.')
    const questionIds = await selectDuelQuestions(ctx, classGroup.orgId, students, now)
    if (questionIds.length === 0) throw new ConvexError('Todavía no hay preguntas disponibles para un duelo en este colegio.')

    return ctx.db.insert('classDuels', {
      classGroupId: args.classGroupId,
      orgId: classGroup.orgId,
      hostId: accountId,
      questionIds,
      status: 'lobby',
      currentIndex: 0,
      teams: TEAM_NAMES.map((name) => ({ name, studentIds: [] })),
      createdAt: now,
    })
  },
})

async function requireDuel(ctx: QueryCtx, duelId: Id<'classDuels'>) {
  const duel = await ctx.db.get('classDuels', duelId)
  if (duel == null) throw new ConvexError('Ese duelo ya no existe.')
  return duel
}

async function requireHost(ctx: MutationCtx | QueryCtx, duelId: Id<'classDuels'>) {
  const duel = await requireDuel(ctx, duelId)
  await requireClassGroupWriter(ctx, duel.classGroupId)
  return duel
}

const teamIndexOf = (duel: Doc<'classDuels'>, studentId: Id<'students'>) =>
  duel.teams.findIndex((team) => team.studentIds.includes(studentId))

async function isClassStudent(ctx: QueryCtx, classGroupId: Id<'classGroups'>, studentId: Id<'students'>) {
  const rows = await ctx.db
    .query('classGroupMembers')
    .withIndex('by_accountId', (q) => q.eq('accountId', studentId))
    .collect()
  return rows.some((row) => row.classGroupId === classGroupId && row.role === 'student')
}

/** A student enters from the banner, late or not: the smaller team takes them. */
export const joinDuel = mutation({
  args: { duelId: v.id('classDuels'), studentId: v.id('students') },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    const duel = await requireDuel(ctx, args.duelId)
    if (!(await isClassStudent(ctx, duel.classGroupId, args.studentId))) throw new ConvexError('Este duelo es de otro curso.')
    if (!isDuelLive(duel, Date.now())) throw new ConvexError('Este duelo ya terminó.')
    if (teamIndexOf(duel, args.studentId) !== -1) return
    const smallest = duel.teams.reduce((best, team, index) => (team.studentIds.length < duel.teams[best]!.studentIds.length ? index : best), 0)
    await ctx.db.patch('classDuels', args.duelId, {
      teams: duel.teams.map((team, index) => (index === smallest ? { ...team, studentIds: [...team.studentIds, args.studentId] } : team)),
    })
  },
})

/** Starts the game: whoever joined is drafted into two even teams. */
export const beginDuel = mutation({
  args: { duelId: v.id('classDuels') },
  handler: async (ctx, args) => {
    const duel = await requireHost(ctx, args.duelId)
    if (duel.status !== 'lobby') throw new ConvexError('Este duelo ya empezó.')
    if (!isDuelLive(duel, Date.now())) throw new ConvexError('Se acabó el tiempo de este duelo.')
    const players = duel.teams.flatMap((team) => team.studentIds)
    if (players.length < MIN_PLAYERS) throw new ConvexError('Espera a que entren al menos dos estudiantes.')
    const strengths = await Promise.all(players.map(async (id) => {
      const ratings = Object.values((await ctx.db.get('students', id))?.abilityBySubject ?? {})
      return { id: id as string, strength: ratings.length === 0 ? DEFAULT_RATING : ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length }
    }))
    const drafted = balanceTeams(strengths)
    await ctx.db.patch('classDuels', args.duelId, {
      status: 'playing',
      teams: duel.teams.map((team, index) => ({ ...team, studentIds: drafted[index]! as Id<'students'>[] })),
    })
  },
})

export const nextDuelQuestion = mutation({
  args: { duelId: v.id('classDuels') },
  handler: async (ctx, args) => {
    const duel = await requireHost(ctx, args.duelId)
    if (duel.status !== 'playing') throw new ConvexError('Este duelo no está en juego.')
    if (duel.currentIndex + 1 >= duel.questionIds.length) {
      await ctx.db.patch('classDuels', args.duelId, { status: 'finished' })
      return
    }
    await ctx.db.patch('classDuels', args.duelId, { currentIndex: duel.currentIndex + 1 })
  },
})

export const finishDuel = mutation({
  args: { duelId: v.id('classDuels') },
  handler: async (ctx, args) => {
    await requireHost(ctx, args.duelId)
    await ctx.db.patch('classDuels', args.duelId, { status: 'finished' })
  },
})

async function currentAnswers(ctx: QueryCtx, duel: Doc<'classDuels'>) {
  return ctx.db
    .query('duelAnswers')
    .withIndex('by_duelId_questionIndex', (q) => q.eq('duelId', duel._id).eq('questionIndex', duel.currentIndex))
    .collect()
}

export const answerDuel = mutation({
  args: {
    duelId: v.id('classDuels'),
    studentId: v.id('students'),
    questionIndex: v.number(),
    selectedOption: v.string(),
  },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    const duel = await requireDuel(ctx, args.duelId)
    if (duel.status !== 'playing' || !isDuelLive(duel, Date.now())) throw new ConvexError('Este duelo ya terminó.')
    if (args.questionIndex !== duel.currentIndex) throw new ConvexError('Esa pregunta ya pasó.')
    const teamIndex = teamIndexOf(duel, args.studentId)
    if (teamIndex === -1) throw new ConvexError('Primero entra al duelo.')
    if ((await currentAnswers(ctx, duel)).some((row) => row.studentId === args.studentId)) {
      throw new ConvexError('Ya respondiste esta pregunta.')
    }
    const question = await ctx.db.get('questions', duel.questionIds[duel.currentIndex]!)
    if (question?.answerCorrectOption == null || !question.options.some((option) => option.label === args.selectedOption)) {
      throw new ConvexError('Esa opción no existe en esta pregunta.')
    }
    // "Correct" or "wrong" here would grade an item the student's own exam still asks.
    if ((await loadLiveExamQuestionIds(ctx, args.studentId)).has(question._id)) {
      throw new ConvexError('Esta pregunta está en un examen o reto que tienes en curso.')
    }
    const isCorrect = args.selectedOption === question.answerCorrectOption
    await ctx.db.insert('duelAnswers', {
      duelId: args.duelId,
      questionIndex: args.questionIndex,
      studentId: args.studentId,
      teamIndex,
      isCorrect,
      answeredAt: Date.now(),
    })
    return { isCorrect }
  },
})

/** Team names, sizes and scores: everything public about a game. */
async function teamBoard(ctx: QueryCtx, duel: Doc<'classDuels'>) {
  const answers = await ctx.db.query('duelAnswers').withIndex('by_duelId_questionIndex', (q) => q.eq('duelId', duel._id)).collect()
  const scores = teamScores(duel.teams.length, answers)
  return duel.teams.map((team, index) => ({ name: team.name, size: team.studentIds.length, score: scores[index]! }))
}

/** Only what the phone or the projector draws: no key, no solution, no difficulty. */
async function publicQuestion(ctx: QueryCtx, duel: Doc<'classDuels'>) {
  const question = await ctx.db.get('questions', duel.questionIds[duel.currentIndex]!)
  if (question == null) return null
  return {
    index: duel.currentIndex,
    total: duel.questionIds.length,
    subjectId: question.subjectId ?? null,
    bodyMarkdown: question.bodyMarkdown,
    options: question.options.map((option) => ({ label: option.label, bodyMarkdown: option.bodyMarkdown })),
  }
}

const statusAt = (duel: Doc<'classDuels'>, now: number) => (isDuelLive(duel, now) ? duel.status : ('finished' as const))

/** The banner on Hoy: a game running in one of the student's classes, if any. */
export const getActiveDuel = query({
  args: { studentId: v.id('students') },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    const now = Date.now()
    const rows = await ctx.db
      .query('classGroupMembers')
      .withIndex('by_accountId', (q) => q.eq('accountId', args.studentId))
      .collect()
    for (const row of rows.filter((member) => member.role === 'student')) {
      const duel = await latestDuel(ctx, row.classGroupId)
      if (duel == null || !isDuelLive(duel, now)) continue
      const classGroup = await ctx.db.get('classGroups', row.classGroupId)
      return { duelId: duel._id, status: duel.status, classGroupName: classGroup?.name ?? '' }
    }
    return null
  },
})

export const getDuelPlayerView = query({
  args: { duelId: v.id('classDuels'), studentId: v.id('students') },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    const duel = await requireDuel(ctx, args.duelId)
    if (!(await isClassStudent(ctx, duel.classGroupId, args.studentId))) throw new ConvexError('Este duelo es de otro curso.')
    const status = statusAt(duel, Date.now())
    const teamIndex = teamIndexOf(duel, args.studentId)
    const playing = status === 'playing' && teamIndex !== -1
    const mine = playing ? (await currentAnswers(ctx, duel)).find((row) => row.studentId === args.studentId) : undefined
    return {
      status,
      endsAt: duel.createdAt + DUEL_MS,
      teamIndex: teamIndex === -1 ? null : teamIndex,
      teams: await teamBoard(ctx, duel),
      question: playing ? await publicQuestion(ctx, duel) : null,
      answered: mine == null ? null : { isCorrect: mine.isCorrect },
    }
  },
})

/** The projector. The key appears only for a question already closed. */
export const getDuelHostView = query({
  args: { duelId: v.id('classDuels') },
  handler: async (ctx, args) => {
    const duel = await requireHost(ctx, args.duelId)
    const status = statusAt(duel, Date.now())
    const previous = duel.currentIndex > 0 ? await ctx.db.get('questions', duel.questionIds[duel.currentIndex - 1]!) : null
    return {
      status,
      classGroupId: duel.classGroupId,
      endsAt: duel.createdAt + DUEL_MS,
      teams: await teamBoard(ctx, duel),
      question: status === 'playing' ? await publicQuestion(ctx, duel) : null,
      answeredCount: status === 'playing' ? (await currentAnswers(ctx, duel)).length : 0,
      closedQuestion: previous?.answerCorrectOption == null ? null : { correctOption: previous.answerCorrectOption },
    }
  },
})
