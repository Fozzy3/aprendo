/**
 * The school's periodic test (F67) and the improvement plan it feeds (F68).
 *
 * The admin creates N rounds up front, with no crons: each round is one fixed
 * form, and one assignment per class of its grades. A round is sealed until it
 * closes, because the whole grade shares that form. Then it reports by class
 * and area, and the next round is the "after" of the plan.
 */
import { ConvexError, v } from 'convex/values'
import { mutation, query, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuthenticatedStudentId, requireOrgRole } from './auth'
import { bankTiersForOrg, collectUsableQuestionsBySubject } from './questionPool'
import { ANSWER_GRACE_MS } from './sessionIntegrity'
import { SESSION_KIND_CONFIG } from './sessionKinds'
import { pickSimulacroForm } from './simulacroForm'
import { SUBJECT_IDS, getSubtopicLabel } from './taxonomy'
import {
  belowFamiliar,
  classItemAnalysis,
  isBoardItem,
  requireClassGroupStaff,
  requireClassGroupWriter,
  subtopicEvidenceFromAggregates,
  unsettledFormQuestionIds,
} from './teacher'

const DAY_MS = 86_400_000
/** Long enough for every class of a grade to find a free hour. */
const ROUND_OPEN_DAYS = 3
const QUESTIONS_PER_AREA = 10
const MAX_ROUNDS = 12
const LIST_ROUNDS_LIMIT = 50
/** Opened rounds whose participation the list counts: older ones cost one read per sitting for nobody. */
export const PARTICIPATION_ROUNDS = 6
const MIN_PLAN_ANSWERS = 3
const MAX_PLAN_SUBTOPICS = 3
/** When there is no next round to aim at. */
const PLAN_DEFAULT_DAYS = 14

export function roundSchedule(args: { firstOpensAt: number; rounds: number; weeksBetween: number }) {
  return Array.from({ length: args.rounds }, (_, index) => {
    const opensAt = args.firstOpensAt + index * args.weeksBetween * 7 * DAY_MS
    return { opensAt, closesAt: opensAt + ROUND_OPEN_DAYS * DAY_MS }
  })
}

type SubjectScores = NonNullable<NonNullable<Doc<'sessions'>['summary']>['subjectScores']>

/** Each area added over the completed sittings; a blank counts against it, as in the exam. */
export function areaResults(summaries: ({ subjectScores?: SubjectScores } | undefined)[]) {
  const totals = new Map<string, { correctCount: number; questionCount: number }>()
  for (const score of summaries.flatMap((summary) => summary?.subjectScores ?? [])) {
    const entry = totals.get(score.subjectId) ?? { correctCount: 0, questionCount: 0 }
    entry.correctCount += score.correctCount
    entry.questionCount += score.questionCount
    totals.set(score.subjectId, entry)
  }
  return [...totals.entries()].map(([subjectId, entry]) => ({
    subjectId,
    ...entry,
    accuracy: entry.questionCount === 0 ? 0 : entry.correctCount / entry.questionCount,
  }))
}

export function subtopicResults(answers: { subtopicId: string; subjectId: string; isCorrect: boolean }[]) {
  const totals = new Map<string, { subtopicId: string; subjectId: string; answered: number; correct: number }>()
  for (const answer of answers) {
    const entry = totals.get(answer.subtopicId) ?? { subtopicId: answer.subtopicId, subjectId: answer.subjectId, answered: 0, correct: 0 }
    entry.answered += 1
    if (answer.isCorrect) entry.correct += 1
    totals.set(answer.subtopicId, entry)
  }
  return [...totals.values()].map((entry) => ({ ...entry, accuracy: entry.correct / entry.answered }))
}

/** The class's weakest subtopics in the round, each turned into one action. */
export function planFromRound(rows: ReturnType<typeof subtopicResults>, dueAt: number) {
  return rows
    .filter((row) => row.answered >= MIN_PLAN_ANSWERS)
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered)
    .slice(0, MAX_PLAN_SUBTOPICS)
    .map((row) => ({
      subtopicId: row.subtopicId,
      subjectId: row.subjectId,
      text: `Clase corta con la guía y votación en parejas sobre la pregunta más fallada (${Math.round(row.accuracy * 100)}% de acierto en la ronda).`,
      dueAt,
    }))
}

// ── Reading a round ─────────────────────────────────────────────────────────

/** Past the close and the answer grace: a sitting at the wire may still hand in. */
const isClosed = (test: Doc<'schoolTests'>, now: number) => now > test.closesAt + ANSWER_GRACE_MS

async function requireSchoolTest(ctx: QueryCtx, schoolTestId: Id<'schoolTests'>) {
  const test = await ctx.db.get('schoolTests', schoolTestId)
  if (test == null) throw new ConvexError('Esa prueba no existe.')
  return test
}

async function roundAssignments(ctx: QueryCtx, schoolTestId: Id<'schoolTests'>) {
  return ctx.db.query('assignments').withIndex('by_schoolTestId', (q) => q.eq('schoolTestId', schoolTestId)).collect()
}

/** Who sat a class's round. Open or abandoned sittings report nothing. Counted from the member rows: no student document is read. */
async function classParticipation(ctx: QueryCtx, assignment: Doc<'assignments'>) {
  const [targets, sessions] = await Promise.all([
    ctx.db.query('classGroupMembers').withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', assignment.classGroupId).eq('role', 'student')).collect(),
    ctx.db.query('sessions').withIndex('by_assignmentId', (q) => q.eq('assignmentId', assignment._id)).collect(),
  ])
  const completed = sessions.filter((session) => session.status === 'completed')
  return {
    targetCount: targets.length,
    doneCount: new Set(completed.map((session) => session.studentId)).size,
    completed,
  }
}

async function classAssignmentFor(ctx: QueryCtx, classGroupId: Id<'classGroups'>, schoolTestId: Id<'schoolTests'>) {
  const assignment = (await roundAssignments(ctx, schoolTestId)).find((row) => row.classGroupId === classGroupId)
  if (assignment == null) throw new ConvexError('Este curso no presentó esa prueba.')
  return assignment
}

/** A class's answers in a round, with the question each one is about. */
async function roundAnswers(ctx: QueryCtx, completed: Doc<'sessions'>[]) {
  const attempts = (await Promise.all(completed.map((session) =>
    ctx.db.query('questionAttempts').withIndex('by_sessionId', (q) => q.eq('sessionId', session._id)).collect()))).flat()
  const questionIds = [...new Set(attempts.map((attempt) => attempt.questionId))]
  const questions = new Map((await Promise.all(questionIds.map((id) => ctx.db.get('questions', id))))
    .flatMap((question) => (question == null ? [] : [[question._id as string, question] as const])))
  return attempts.flatMap((attempt) => {
    const question = questions.get(attempt.questionId)
    if (question == null || question.voidedAt != null || attempt.isCorrect == null || attempt.selectedOption == null) return []
    return [{ question, questionId: attempt.questionId as string, selectedOption: attempt.selectedOption, isCorrect: attempt.isCorrect }]
  })
}

async function subtopicRowsOf(ctx: QueryCtx, completed: Doc<'sessions'>[]) {
  return subtopicResults((await roundAnswers(ctx, completed)).flatMap(({ question, isCorrect }) =>
    question.primarySubtopicId == null || question.subjectId == null
      ? []
      : [{ subtopicId: question.primarySubtopicId, subjectId: question.subjectId, isCorrect }]))
}

/** The school admin's rounds, newest first, with how many sat each one. */
export const listRounds = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    const tests = await ctx.db.query('schoolTests').withIndex('by_orgId', (q) => q.eq('orgId', args.orgId)).order('desc').take(LIST_ROUNDS_LIMIT)
    const now = Date.now()
    const recent = new Set(tests.filter((test) => now >= test.opensAt).slice(0, PARTICIPATION_ROUNDS).map((test) => test._id))
    return Promise.all(tests.map(async (test) => {
      const hasOpened = now >= test.opensAt
      const participation = recent.has(test._id)
        ? await Promise.all((await roundAssignments(ctx, test._id)).map((assignment) => classParticipation(ctx, assignment)))
        : null
      return {
        schoolTestId: test._id,
        title: test.title,
        grades: test.grades,
        opensAt: test.opensAt,
        closesAt: test.closesAt,
        questionCount: test.questionIds.length,
        isClosed: isClosed(test, now),
        hasOpened,
        targetCount: participation?.reduce((sum, row) => sum + row.targetCount, 0) ?? null,
        doneCount: participation?.reduce((sum, row) => sum + row.doneCount, 0) ?? null,
      }
    }))
  },
})

/** One round by class and area. Participation shows while open; results wait for the close. */
export const getRoundReport = query({
  args: { schoolTestId: v.id('schoolTests') },
  handler: async (ctx, args) => {
    const test = await requireSchoolTest(ctx, args.schoolTestId)
    await requireOrgRole(ctx, test.orgId, ['org_admin'])
    const closed = isClosed(test, Date.now())
    const rows = await Promise.all((await roundAssignments(ctx, test._id)).map(async (assignment) => {
      const classGroup = await ctx.db.get('classGroups', assignment.classGroupId)
      const { completed, ...counts } = await classParticipation(ctx, assignment)
      return {
        classGroupId: assignment.classGroupId,
        name: classGroup?.name ?? '',
        grade: classGroup?.grade ?? '',
        ...counts,
        summaries: closed ? completed.map((session) => session.summary) : [],
      }
    }))
    return {
      schoolTestId: test._id,
      title: test.title,
      opensAt: test.opensAt,
      closesAt: test.closesAt,
      isClosed: closed,
      school: areaResults(rows.flatMap((row) => row.summaries)),
      classes: rows
        .map(({ summaries, ...row }) => ({ ...row, areas: areaResults(summaries) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })),
    }
  },
})

/** The rounds a class takes part in, newest first. */
export const listClassRounds = query({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupStaff(ctx, args.classGroupId)
    const now = Date.now()
    const assignments = (await ctx.db
      .query('assignments')
      .withIndex('by_classGroupId', (q) => q.eq('classGroupId', args.classGroupId))
      .collect()).filter((row) => row.schoolTestId != null)
    const cycles = await ctx.db.query('classCycles').withIndex('by_classGroupId', (q) => q.eq('classGroupId', args.classGroupId)).collect()
    const rows = await Promise.all(assignments.map(async (assignment) => {
      const test = await ctx.db.get('schoolTests', assignment.schoolTestId!)
      if (test == null) return []
      const { completed, ...counts } = await classParticipation(ctx, assignment)
      const closed = isClosed(test, now)
      return [{
        schoolTestId: test._id,
        title: test.title,
        opensAt: test.opensAt,
        closesAt: test.closesAt,
        isClosed: closed,
        ...counts,
        areas: closed ? areaResults(completed.map((session) => session.summary)) : [],
        hasPlan: cycles.some((cycle) => cycle.schoolTestId === test._id),
      }]
    }))
    return rows.flat().sort((a, b) => b.opensAt - a.opensAt)
  },
})

/** What a class missed most in a closed round (`classItemAnalysis`): the questions to take to the board. */
export const getClassRoundDetail = query({
  args: { classGroupId: v.id('classGroups'), schoolTestId: v.id('schoolTests') },
  handler: async (ctx, args) => {
    const { organization } = await requireClassGroupStaff(ctx, args.classGroupId)
    const test = await requireSchoolTest(ctx, args.schoolTestId)
    const now = Date.now()
    if (!isClosed(test, now)) return { isClosed: false, items: [] }
    const assignment = await classAssignmentFor(ctx, args.classGroupId, args.schoolTestId)
    const tiers = bankTiersForOrg(organization)
    const sealedForms = await unsettledFormQuestionIds(ctx, organization._id, now)
    const answers = (await roundAnswers(ctx, (await classParticipation(ctx, assignment)).completed))
      .filter((answer) => isBoardItem(answer.question, tiers, sealedForms))
    const questionById = new Map(answers.map((answer) => [answer.questionId, answer.question]))
    return {
      isClosed: true,
      items: classItemAnalysis(answers).map((item) => {
        const question = questionById.get(item.questionId)
        return {
          ...item,
          subtopicId: question?.primarySubtopicId ?? null,
          correctOption: question?.answerCorrectOption ?? null,
          stem: question?.bodyMarkdown ?? '',
          options: question?.options ?? [],
        }
      }),
    }
  },
})

// ── Writing ─────────────────────────────────────────────────────────────────

/**
 * Creates every round at once: its form, and one assignment per class of those
 * grades. A class created later joins from the next batch of rounds.
 */
export const createRounds = mutation({
  args: {
    orgId: v.id('organizations'),
    title: v.string(),
    grades: v.array(v.string()),
    firstOpensAt: v.number(),
    rounds: v.number(),
    weeksBetween: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    const createdBy = await requireAuthenticatedStudentId(ctx)
    const title = args.title.trim()
    if (title.length === 0 || title.length > 120) throw new ConvexError('El nombre de la prueba debe tener entre 1 y 120 caracteres.')
    if (!Number.isInteger(args.rounds) || args.rounds < 1 || args.rounds > MAX_ROUNDS) {
      throw new ConvexError(`Crea entre 1 y ${MAX_ROUNDS} rondas.`)
    }
    if (!Number.isInteger(args.weeksBetween) || args.weeksBetween < 1) throw new ConvexError('Deja al menos una semana entre rondas.')
    const organization = await ctx.db.get('organizations', args.orgId)
    if (organization == null) throw new ConvexError('Colegio no encontrado.')
    const classGroups = (await ctx.db.query('classGroups').withIndex('by_orgId', (q) => q.eq('orgId', args.orgId)).collect())
      .filter((classGroup) => args.grades.includes(classGroup.grade))
    if (classGroups.length === 0) throw new ConvexError('No hay cursos de esos grados.')

    // G1: a paying school's form holds only original items.
    const tiers = bankTiersForOrg(organization)
    const pools = SESSION_KIND_CONFIG.prueba.eligibilityPools
    const banks = await Promise.all(SUBJECT_IDS.map((subjectId) => collectUsableQuestionsBySubject(ctx, subjectId, pools, tiers)))
    const lastSeenAt = new Map<string, number>()
    const now = Date.now()

    const forms = roundSchedule(args).map((window, index) => {
      const questionIds = banks.flatMap((bank) =>
        pickSimulacroForm({
          questions: bank,
          limit: QUESTIONS_PER_AREA,
          seed: `${args.orgId}:${title}:${index}`,
          lastSeenAt,
          exclude: new Set(),
        }).map((question) => question._id))
      for (const questionId of questionIds) lastSeenAt.set(questionId, index + 1)
      return { ...window, questionIds }
    })
    if (forms.some((form) => form.questionIds.length === 0)) throw new ConvexError('Todavía no hay preguntas disponibles para una prueba en este colegio.')

    // The round running and the next one stay sealed (`loadOpenRoundQuestionIds`):
    // a pair of them that holds a whole area leaves it with nothing to practice or level in.
    const unsettled = (await ctx.db.query('schoolTests').withIndex('by_orgId', (q) => q.eq('orgId', args.orgId)).collect())
      .filter((test) => now <= test.closesAt + ANSWER_GRACE_MS)
    const calendar = [...unsettled, ...forms].sort((a, b) => a.opensAt - b.opensAt)
    const takesAnArea = calendar.some((round, index) => {
      const reserved = new Set<string>([...round.questionIds, ...(calendar[index + 1]?.questionIds ?? [])])
      return banks.some((bank) => bank.length > 0 && bank.every((question) => reserved.has(question._id)))
    })
    if (takesAnArea) {
      throw new ConvexError('Estas rondas usarían todas las preguntas de un área y nadie podría practicarla ni nivelarse. Crea menos rondas o espera a que el banco crezca.')
    }

    for (const [index, { questionIds, ...window }] of forms.entries()) {
      const schoolTestId = await ctx.db.insert('schoolTests', {
        orgId: args.orgId,
        title: args.rounds > 1 ? `${title} · Ronda ${index + 1}` : title,
        grades: args.grades,
        ...window,
        questionIds,
        createdBy,
        createdAt: now,
      })
      for (const classGroup of classGroups) {
        await ctx.db.insert('assignments', {
          classGroupId: classGroup._id,
          orgId: args.orgId,
          createdBy,
          kind: 'prueba',
          schoolTestId,
          dueAt: window.closesAt,
          createdAt: now,
        })
      }
    }
  },
})

/** The round after this one for the class: the plan's "after". */
async function nextClassRound(ctx: QueryCtx, classGroupId: Id<'classGroups'>, test: Doc<'schoolTests'>) {
  const assignments = (await ctx.db
    .query('assignments')
    .withIndex('by_classGroupId', (q) => q.eq('classGroupId', classGroupId))
    .collect()).filter((row) => row.schoolTestId != null && row.schoolTestId !== test._id)
  const later: { test: Doc<'schoolTests'>; assignment: Doc<'assignments'> }[] = []
  for (const assignment of assignments) {
    const candidate = await ctx.db.get('schoolTests', assignment.schoolTestId!)
    if (candidate != null && candidate.opensAt > test.opensAt) later.push({ test: candidate, assignment })
  }
  return later.sort((a, b) => a.test.opensAt - b.test.opensAt)[0] ?? null
}

/**
 * "Generar plan": turns a closed round's evidence into the class's next cycle,
 * with one action per weak subtopic, due when the next round opens.
 */
export const generateImprovementPlan = mutation({
  args: { classGroupId: v.id('classGroups'), schoolTestId: v.id('schoolTests') },
  handler: async (ctx, args) => {
    const { classGroup, accountId } = await requireClassGroupWriter(ctx, args.classGroupId)
    const test = await requireSchoolTest(ctx, args.schoolTestId)
    const now = Date.now()
    if (!isClosed(test, now)) throw new ConvexError('El plan se genera cuando la ronda cierra.')
    const assignment = await classAssignmentFor(ctx, args.classGroupId, args.schoolTestId)

    const existing = (await ctx.db
      .query('classCycles')
      .withIndex('by_classGroupId', (q) => q.eq('classGroupId', args.classGroupId))
      .collect()).find((cycle) => cycle.schoolTestId === args.schoolTestId)
    if (existing != null) return existing._id

    const next = await nextClassRound(ctx, args.classGroupId, test)
    const endsAt = next?.test.opensAt ?? now + PLAN_DEFAULT_DAYS * DAY_MS
    const { completed } = await classParticipation(ctx, assignment)
    const planned = planFromRound(await subtopicRowsOf(ctx, completed), endsAt)
    if (planned.length === 0) throw new ConvexError('Esta ronda todavía no tiene respuestas suficientes para un plan.')

    const evidence = await subtopicEvidenceFromAggregates(ctx, args.classGroupId, planned)
    return ctx.db.insert('classCycles', {
      classGroupId: args.classGroupId,
      orgId: classGroup.orgId,
      createdBy: accountId,
      startedAt: now,
      endsAt,
      subtopics: planned.map(({ subtopicId, subjectId }) => {
        const entry = evidence.get(subtopicId)
        return { subtopicId, subjectId, tier: 'curso' as const, ...(entry == null ? { belowCount: 0, evidencedCount: 0 } : belowFamiliar(entry)) }
      }),
      groups: [],
      schoolTestId: args.schoolTestId,
      actions: planned.map(({ subtopicId, text, dueAt }) => ({ subtopicId, text: `${getSubtopicLabel(subtopicId)}. ${text}`, dueAt })),
    })
  },
})

/** Accuracy per planned subtopic in the plan's round and in the next one, once that closes. */
export const getCycleRoundComparison = query({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupStaff(ctx, args.classGroupId)
    const cycle = await ctx.db
      .query('classCycles')
      .withIndex('by_classGroupId', (q) => q.eq('classGroupId', args.classGroupId))
      .order('desc')
      .first()
    if (cycle?.schoolTestId == null) return null
    const test = await ctx.db.get('schoolTests', cycle.schoolTestId)
    if (test == null) return null
    const assignment = await classAssignmentFor(ctx, args.classGroupId, test._id)
    const before = await subtopicRowsOf(ctx, (await classParticipation(ctx, assignment)).completed)
    const next = await nextClassRound(ctx, args.classGroupId, test)
    const nextClosed = next != null && isClosed(next.test, Date.now())
    const after = nextClosed ? await subtopicRowsOf(ctx, (await classParticipation(ctx, next.assignment)).completed) : []
    const accuracyOf = (rows: typeof before, subtopicId: string) => rows.find((row) => row.subtopicId === subtopicId)?.accuracy ?? null
    return {
      title: test.title,
      nextTitle: next?.test.title ?? null,
      nextClosed,
      rows: cycle.subtopics.map(({ subtopicId }) => ({
        subtopicId,
        before: accuracyOf(before, subtopicId),
        after: accuracyOf(after, subtopicId),
      })),
    }
  },
})
