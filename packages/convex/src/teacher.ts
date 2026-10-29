/**
 * What a teacher reads about a class: every student's level per area with its
 * evidence, who needs attention and why, and which subtopics the class as a
 * whole gets wrong. Read-only, derived from the same aggregates the student
 * sees, so a teacher and a student never see two different levels.
 */
import { ConvexError, v } from 'convex/values'
import { internalQuery, mutation, query, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { assertIsStudent, requireAuthenticatedStudentId, requireOrgRole } from './auth'
import { LEVELLED_SUBJECT_IDS } from './levels'
import { MASTERY_LEVELS, masteryLevelOf, type MasteryLevel } from './mastery'
import { SUBJECT_WEIGHTS } from './globalScore'
import { buildSubjectLevels } from './progress'
import { collectUsableQuestionsBySubject } from './questionPool'
import { isLicenseActive, listAccountOrganizations } from './schools'
import { competenciaOf, competencyBreakdown, getSubjectIdForSubtopic } from './taxonomy'
import { ASSIGNMENT_QUESTION_COUNT } from './sessionKinds'
import { settledAttempts } from './sessionIntegrity'

/** Days without starting a session before a student counts as inactive. */
export const INACTIVE_DAYS = 14
const DAY_MS = 86_400_000

export type RiskReason = 'sin_nivelacion' | 'inactivo' | 'nivel_bajo'

/**
 * Why a student needs the teacher's attention, most urgent first. Only claims
 * a low level where the area has enough evidence for a level at all.
 */
export function riskReasonsFor(
  student: {
    hasPlacement: boolean
    lastActiveAt: number | null
    subjects: { hasEnoughEvidence: boolean; levelIndex: number | null }[]
  },
  now: number,
): RiskReason[] {
  const reasons: RiskReason[] = []
  if (!student.hasPlacement) reasons.push('sin_nivelacion')
  if (student.lastActiveAt == null || now - student.lastActiveAt > INACTIVE_DAYS * DAY_MS) reasons.push('inactivo')
  if (student.subjects.some((subject) => subject.hasEnoughEvidence && subject.levelIndex === 1)) reasons.push('nivel_bajo')
  return reasons
}

/** Attempts a student needs on a subtopic before the plan counts them there. */
const MIN_STUDENT_ATTEMPTS = 3
/** Students with evidence a subtopic needs before the plan says anything about it. */
const MIN_EVIDENCED_STUDENTS = 5
const WHOLE_CLASS_SHARE = 0.4
const GROUP_SHARE = 0.15
const MAX_GROUP_SIZE = 6
/** Enseñar ocho cosas a la vez es no enseñar ninguna. */
const MAX_WHOLE_CLASS = 2
const MAX_GROUP_SUBTOPICS = 3
const BELOW_FAMILIAR: MasteryLevel[] = ['sin_empezar', 'intentado']

export type SubtopicEvidence = {
  subtopicId: string
  subjectId: string
  students: { studentId: string; attemptCount: number; masteryLevel: MasteryLevel }[]
  /** Answers declared "seguro" and wrong, out of every declared answer. */
  confidentWrong: number
  declared: number
}

/**
 * The teacher's week (plans/ruta-mejora-pedagogica.md, "Metodología"): what to
 * teach the whole class, which students to pull into a small group, and whom
 * to talk to one-to-one. Rules, not a model, so a teacher can see why.
 *
 * Priority = ICFES weight × share below Familiar × (1 + share of confident
 * errors): a confident error is a misconception, and nobody fixes those alone.
 */
const isBelowFamiliar = (student: { masteryLevel: MasteryLevel }) => BELOW_FAMILIAR.includes(student.masteryLevel)

/** Students with evidence on a subtopic, and how many sit below Familiar: a cycle's before and after (F42). */
export function belowFamiliar(subtopic: SubtopicEvidence) {
  const evidenced = subtopic.students.filter((student) => student.attemptCount >= MIN_STUDENT_ATTEMPTS)
  return { belowCount: evidenced.filter(isBelowFamiliar).length, evidencedCount: evidenced.length }
}

export function classTeachingPlan(input: {
  subtopics: SubtopicEvidence[]
  students: { studentId: string; riskReasons: RiskReason[] }[]
}) {
  const ranked = input.subtopics.flatMap((subtopic) => {
    const evidenced = subtopic.students.filter((student) => student.attemptCount >= MIN_STUDENT_ATTEMPTS)
    if (evidenced.length < MIN_EVIDENCED_STUDENTS) return []
    const below = evidenced.filter(isBelowFamiliar)
    const share = below.length / evidenced.length
    const misconceptionShare = subtopic.declared === 0 ? 0 : subtopic.confidentWrong / subtopic.declared
    return [{
      subtopicId: subtopic.subtopicId,
      subjectId: subtopic.subjectId,
      evidencedCount: evidenced.length,
      belowCount: below.length,
      belowStudentIds: below.map((student) => student.studentId),
      misconceptionShare,
      priority: (SUBJECT_WEIGHTS[subtopic.subjectId] ?? 1) * share * (1 + misconceptionShare),
      share,
    }]
  }).sort((a, b) => b.priority - a.priority)

  const wholeClass = ranked
    .filter((item) => item.share >= WHOLE_CLASS_SHARE)
    .slice(0, MAX_WHOLE_CLASS)
    .map(({ belowStudentIds: _ids, ...item }) => item)
  const groups = ranked
    .filter((item) => item.share >= GROUP_SHARE && item.share < WHOLE_CLASS_SHARE)
    .slice(0, MAX_GROUP_SUBTOPICS)
    .flatMap(({ belowStudentIds, ...item }) => {
      const count = Math.ceil(belowStudentIds.length / MAX_GROUP_SIZE)
      const size = Math.ceil(belowStudentIds.length / count)
      return Array.from({ length: count }, (_, index) => ({
        ...item,
        studentIds: belowStudentIds.slice(index * size, (index + 1) * size),
      }))
    })
  const individual = input.students
    .filter((student) => student.riskReasons.length > 0)
    .sort((a, b) => b.riskReasons.length - a.riskReasons.length)

  return { wholeClass, groups, individual }
}

/** Answers a question needs from the class before it counts as a class miss. */
const MIN_ITEM_ANSWERS = 3
const MAX_ITEMS = 5

/**
 * The questions the class misses most, and the wrong option most of them chose:
 * that option is the class's misconception, and the question is the one to put
 * on the board for a vote (peer instruction).
 */
export function classItemAnalysis(answers: { questionId: string; selectedOption: string; isCorrect: boolean }[]) {
  const byQuestion = new Map<string, { answered: number; wrong: number; wrongByOption: Map<string, number> }>()
  for (const answer of answers) {
    const entry = byQuestion.get(answer.questionId) ?? { answered: 0, wrong: 0, wrongByOption: new Map() }
    entry.answered += 1
    if (!answer.isCorrect) {
      entry.wrong += 1
      entry.wrongByOption.set(answer.selectedOption, (entry.wrongByOption.get(answer.selectedOption) ?? 0) + 1)
    }
    byQuestion.set(answer.questionId, entry)
  }
  return [...byQuestion.entries()]
    .filter(([, entry]) => entry.answered >= MIN_ITEM_ANSWERS && entry.wrong > 0)
    .map(([questionId, entry]) => {
      const [topWrongOption, topWrongCount] = [...entry.wrongByOption.entries()].sort((a, b) => b[1] - a[1])[0]!
      return { questionId, answered: entry.answered, wrong: entry.wrong, topWrongOption, topWrongCount }
    })
    .sort((a, b) => b.wrong / b.answered - a.wrong / a.answered || b.answered - a.answered)
    .slice(0, MAX_ITEMS)
}

async function requireClassGroupStaff(ctx: QueryCtx, classGroupId: Id<'classGroups'>) {
  const classGroup = await ctx.db.get('classGroups', classGroupId)
  if (classGroup == null) throw new ConvexError('Curso no encontrado.')
  await requireOrgRole(ctx, classGroup.orgId, ['teacher', 'org_admin'])
  const organization = await ctx.db.get('organizations', classGroup.orgId)
  if (organization == null) throw new ConvexError('Colegio no encontrado.')
  return { classGroup, organization }
}

/**
 * Writes to a class (assignments, cycles) belong to its own teachers or the
 * school admin; any teacher of the school can still read it.
 */
async function requireClassGroupWriter(ctx: QueryCtx, classGroupId: Id<'classGroups'>) {
  const { classGroup, organization } = await requireClassGroupStaff(ctx, classGroupId)
  const accountId = await requireAuthenticatedStudentId(ctx)
  const membership = await requireOrgRole(ctx, classGroup.orgId, ['teacher', 'org_admin'])
  if (membership.role !== 'org_admin') {
    const teachers = await ctx.db
      .query('classGroupMembers')
      .withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', classGroupId).eq('role', 'teacher'))
      .collect()
    if (!teachers.some((row) => row.accountId === accountId)) throw new ConvexError('Solo los docentes de este curso pueden hacer esto.')
  }
  return { classGroup, organization, accountId }
}

/** Only ids of students in the class; anything else is dropped. */
async function classStudentIdsAmong(ctx: QueryCtx, classGroupId: Id<'classGroups'>, studentIds: Id<'students'>[]) {
  const members = new Set((await listClassStudents(ctx, classGroupId)).map((student) => student._id as string))
  return studentIds.filter((studentId) => members.has(studentId))
}

/**
 * A student's recent graded answers from finished sessions only: an open exam
 * is sealed, and a teacher never watches answers live (F40).
 */
async function recentSettledAnswers(ctx: QueryCtx, studentId: Id<'students'>) {
  const [recent, sessions] = await Promise.all([
    ctx.db.query('questionAttempts').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).order('desc').take(RECENT_ANSWERS_PER_STUDENT),
    ctx.db.query('sessions').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect(),
  ])
  return settledAttempts(recent, sessions).filter((attempt) => attempt.isCorrect != null)
}

/**
 * Evidence on a few subtopics from the aggregates alone: what a cycle compares.
 * Light enough for the cycle views and the whole school (no answers read).
 */
async function subtopicEvidenceFromAggregates(
  ctx: QueryCtx,
  classGroupId: Id<'classGroups'>,
  subtopics: { subtopicId: string; subjectId: string }[],
) {
  const bySubtopic = new Map<string, SubtopicEvidence>()
  for (const student of await listClassStudents(ctx, classGroupId)) {
    for (const item of subtopics) {
      const aggregate = await ctx.db
        .query('learnerSubtopicAggregates')
        .withIndex('by_studentId_subtopicId', (q) => q.eq('studentId', student._id).eq('subtopicId', item.subtopicId))
        .first()
      if (aggregate == null) continue
      const entry = bySubtopic.get(item.subtopicId) ?? { subtopicId: item.subtopicId, subjectId: item.subjectId, students: [], confidentWrong: 0, declared: 0 }
      entry.students.push({ studentId: student._id, attemptCount: aggregate.attemptCount, masteryLevel: masteryLevelOf(aggregate) })
      bySubtopic.set(item.subtopicId, entry)
    }
  }
  return bySubtopic
}

async function listClassStudents(ctx: QueryCtx, classGroupId: Id<'classGroups'>) {
  const rows = await ctx.db
    .query('classGroupMembers')
    .withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', classGroupId).eq('role', 'student'))
    .collect()
  const students: Doc<'students'>[] = []
  for (const row of rows) {
    const student = await ctx.db.get('students', row.accountId)
    if (student != null) students.push(student)
  }
  return students
}

/** One student of a class: level per area and why they need attention. */
async function buildStudentRow(ctx: QueryCtx, student: Doc<'students'>, now: number) {
  const completed = (kind: 'nivelacion' | 'diagnostic') =>
    ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind_status', (q) => q.eq('studentId', student._id).eq('kind', kind).eq('status', 'completed'))
      .collect()
  const [snapshot, subjectAggregates, nivelaciones, diagnostics, lastSession] = await Promise.all([
    ctx.db.query('learnerProfileSnapshots').withIndex('by_studentId', (q) => q.eq('studentId', student._id)).unique(),
    ctx.db.query('learnerSubjectAggregates').withIndex('by_studentId', (q) => q.eq('studentId', student._id)).collect(),
    completed('nivelacion'),
    completed('diagnostic'),
    ctx.db.query('sessions').withIndex('by_studentId_startedAt', (q) => q.eq('studentId', student._id)).order('desc').first(),
  ])
  const levels = buildSubjectLevels(subjectAggregates, nivelaciones, snapshot, student)
  const row = {
    studentId: student._id,
    name: student.name ?? null,
    email: student.email,
    careerFamily: student.careerFamily ?? null,
    hasPlacement: nivelaciones.length > 0 || diagnostics.length > 0,
    lastActiveAt: lastSession?.startedAt ?? null,
    subjects: levels.map((level) => ({
      subjectId: level.subjectId,
      attemptCount: level.attemptCount,
      hasEnoughEvidence: level.hasEnoughEvidence,
      score: level.hasEnoughEvidence ? level.currentScore : null,
      levelIndex: level.current?.index ?? null,
      levelLabel: level.current?.band.labelEs ?? null,
      bandCount: level.current?.bandCount ?? null,
    })),
  }
  return { ...row, riskReasons: riskReasonsFor(row, now) }
}

/** Recent answers per student the week plan reads. */
// ponytail: last 100 answers per student plus their questions keeps a 40-student
// class near 8k reads; a per-class rollup table if classes grow or it slows.
const RECENT_ANSWERS_PER_STUDENT = 100

/**
 * Everything the week plan reads about a class: each student's row, the
 * evidence per subtopic and the recent answers. Shared by the plan and the
 * cycle (F42), so both judge the class the same way.
 */
async function gatherClassEvidence(ctx: QueryCtx, classGroupId: Id<'classGroups'>, now: number) {
  const args = { classGroupId }
  const students = await listClassStudents(ctx, args.classGroupId)

  const subtopics = new Map<string, SubtopicEvidence>()
  const evidenceFor = (subtopicId: string, subjectId: string) => {
    const entry = subtopics.get(subtopicId) ?? { subtopicId, subjectId, students: [], confidentWrong: 0, declared: 0 }
    subtopics.set(subtopicId, entry)
    return entry
  }
  const questionCache = new Map<Id<'questions'>, Doc<'questions'> | null>()
  const getQuestion = async (questionId: Id<'questions'>) => {
    if (!questionCache.has(questionId)) questionCache.set(questionId, await ctx.db.get('questions', questionId))
    return questionCache.get(questionId)!
  }
  const answers: { questionId: string; selectedOption: string; isCorrect: boolean }[] = []
  const rows: Awaited<ReturnType<typeof buildStudentRow>>[] = []

  for (const student of students) {
    rows.push(await buildStudentRow(ctx, student, now))
    const aggregates = await ctx.db
      .query('learnerSubtopicAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', student._id))
      .collect()
    for (const aggregate of aggregates) {
      if (aggregate.subtopicId == null || aggregate.attemptCount === 0) continue
      evidenceFor(aggregate.subtopicId, aggregate.subjectId).students.push({
        studentId: student._id,
        attemptCount: aggregate.attemptCount,
        masteryLevel: masteryLevelOf(aggregate),
      })
    }
    for (const attempt of await recentSettledAnswers(ctx, student._id)) {
      if (attempt.isCorrect == null || attempt.selectedOption == null) continue
      answers.push({ questionId: attempt.questionId, selectedOption: attempt.selectedOption, isCorrect: attempt.isCorrect })
      if (attempt.confidence == null) continue
      const question = await getQuestion(attempt.questionId)
      if (question?.primarySubtopicId == null || question.subjectId == null) continue
      const entry = evidenceFor(question.primarySubtopicId, question.subjectId)
      entry.declared += 1
      if (attempt.confidence === 'sure' && !attempt.isCorrect) entry.confidentWrong += 1
    }
  }

  return { rows, subtopics: [...subtopics.values()], answers, getQuestion }
}

/**
 * The teacher's week for one class: whole class, small groups, one-to-one,
 * plus the questions the class misses most (see `classTeachingPlan`).
 */
export const getClassTeachingPlan = query({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupStaff(ctx, args.classGroupId)
    const now = Date.now()
    const { rows, subtopics, answers, getQuestion } = await gatherClassEvidence(ctx, args.classGroupId, now)
    const plan = classTeachingPlan({ subtopics, students: rows })
    const nameOf = new Map(rows.map((row) => [row.studentId as string, { name: row.name, email: row.email }]))
    const items = await Promise.all(classItemAnalysis(answers).map(async (item) => {
      const question = await getQuestion(item.questionId as Id<'questions'>)
      return {
        ...item,
        subtopicId: question?.primarySubtopicId ?? null,
        subjectId: question?.subjectId ?? null,
        correctOption: question?.answerCorrectOption ?? null,
        stem: question?.bodyMarkdown ?? '',
        options: question?.options ?? [],
      }
    }))

    return {
      wholeClass: plan.wholeClass,
      groups: plan.groups.map((group) => ({
        ...group,
        students: group.studentIds.map((studentId) => ({ studentId, ...nameOf.get(studentId) })),
      })),
      individual: plan.individual.map((student) => {
        const row = rows.find((candidate) => candidate.studentId === student.studentId)!
        return { studentId: row.studentId, name: row.name, email: row.email, riskReasons: row.riskReasons, lastActiveAt: row.lastActiveAt }
      }),
      items,
    }
  },
})

/**
 * The class per official ICFES competencia (F35): the words of the school's
 * Informe por Colegio. Pooled over each student's recent answers; only
 * questions tagged with `competencia_oficial` count.
 */
export const getClassCompetencias = query({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupStaff(ctx, args.classGroupId)
    const questionCache = new Map<Id<'questions'>, Doc<'questions'> | null>()
    const answers: { subjectId: string; competencia: string | null; isCorrect: boolean }[] = []
    for (const student of await listClassStudents(ctx, args.classGroupId)) {
      for (const attempt of await recentSettledAnswers(ctx, student._id)) {
        if (attempt.isCorrect == null) continue
        if (!questionCache.has(attempt.questionId)) questionCache.set(attempt.questionId, await ctx.db.get('questions', attempt.questionId))
        const question = questionCache.get(attempt.questionId)
        if (question?.subjectId == null) continue
        answers.push({ subjectId: question.subjectId, competencia: competenciaOf(question), isCorrect: attempt.isCorrect })
      }
    }
    return competencyBreakdown(answers)
  },
})

/**
 * How much of the bank carries a competencia (F35: measure before showing).
 * `bunx convex run teacher:competenciaCoverage`.
 */
export const competenciaCoverage = internalQuery({
  args: {},
  handler: async (ctx) =>
    Promise.all(LEVELLED_SUBJECT_IDS.map(async (subjectId) => {
      const usable = await collectUsableQuestionsBySubject(ctx, subjectId, ['diagnostic', 'practice_only'])
      return { subjectId, usable: usable.length, tagged: usable.filter((question) => competenciaOf(question) != null).length }
    })),
})

const ASSIGNMENT_DEFAULT_DAYS = { practica: 7, tiquete: 1 } as const
/** How long an overdue assignment stays on the student's Hoy. */
const OVERDUE_GRACE_MS = 7 * DAY_MS

/**
 * A teacher assigns practice on one subtopic to the class, a group or some
 * students (F40). Only practice: no grading, no live answers.
 */
export const createAssignment = mutation({
  args: {
    classGroupId: v.id('classGroups'),
    subtopicId: v.string(),
    kind: v.union(v.literal('practica'), v.literal('tiquete')),
    studentIds: v.optional(v.array(v.id('students'))),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { classGroup, accountId } = await requireClassGroupWriter(ctx, args.classGroupId)
    if (getSubjectIdForSubtopic(args.subtopicId) == null) throw new ConvexError('Ese tema no existe.')
    const studentIds = args.studentIds == null ? null : await classStudentIdsAmong(ctx, args.classGroupId, args.studentIds)
    const now = Date.now()
    return ctx.db.insert('assignments', {
      classGroupId: args.classGroupId,
      orgId: classGroup.orgId,
      createdBy: accountId,
      subtopicId: args.subtopicId,
      kind: args.kind,
      ...(studentIds != null && studentIds.length > 0 ? { studentIds } : {}),
      dueAt: args.dueAt ?? now + ASSIGNMENT_DEFAULT_DAYS[args.kind] * DAY_MS,
      createdAt: now,
    })
  },
})

export const deleteAssignment = mutation({
  args: { assignmentId: v.id('assignments') },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get('assignments', args.assignmentId)
    if (assignment == null) return
    await requireClassGroupWriter(ctx, assignment.classGroupId)
    await ctx.db.delete('assignments', args.assignmentId)
  },
})

/** Who an assignment is for: its students, or everyone in the class. */
async function assignmentTargets(ctx: QueryCtx, assignment: Doc<'assignments'>) {
  if (assignment.studentIds != null) return assignment.studentIds
  return (await listClassStudents(ctx, assignment.classGroupId)).map((student) => student._id)
}

/** The class's recent assignments, with how many students did them and how well. */
export const getClassAssignments = query({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupStaff(ctx, args.classGroupId)
    const assignments = await ctx.db
      .query('assignments')
      .withIndex('by_classGroupId', (q) => q.eq('classGroupId', args.classGroupId))
      .order('desc')
      .take(10)
    return Promise.all(assignments.map(async (assignment) => {
      const targets = await assignmentTargets(ctx, assignment)
      const sessions = await ctx.db
        .query('sessions')
        .withIndex('by_assignmentId', (q) => q.eq('assignmentId', assignment._id))
        .collect()
      const done = sessions.filter((session) => session.status === 'completed' && targets.includes(session.studentId))
      const doneStudents = new Set(done.map((session) => session.studentId))
      const inProgress = new Set(sessions
        .filter((session) => session.status === 'in_progress' && !doneStudents.has(session.studentId))
        .map((session) => session.studentId))
      const answered = done.reduce((sum, session) => sum + (session.summary?.questionCount ?? 0), 0)
      const correct = done.reduce((sum, session) => sum + (session.summary?.correctCount ?? 0), 0)
      return {
        assignmentId: assignment._id,
        subtopicId: assignment.subtopicId,
        kind: assignment.kind,
        dueAt: assignment.dueAt,
        isGroup: assignment.studentIds != null,
        targetCount: targets.length,
        doneCount: doneStudents.size,
        inProgressCount: inProgress.size,
        accuracy: answered === 0 ? null : correct / answered,
      }
    }))
  },
})

/** The student's pending assignments, first on Hoy (F40): the classroom leads. */
export const listMyAssignments = query({
  args: { studentId: v.id('students') },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    const now = Date.now()
    const memberships = await ctx.db
      .query('classGroupMembers')
      .withIndex('by_accountId', (q) => q.eq('accountId', args.studentId))
      .collect()
    const result = []
    for (const membership of memberships.filter((row) => row.role === 'student')) {
      const assignments = await ctx.db
        .query('assignments')
        .withIndex('by_classGroupId', (q) => q.eq('classGroupId', membership.classGroupId))
        .collect()
      for (const assignment of assignments) {
        if (assignment.dueAt < now - OVERDUE_GRACE_MS) continue
        if (assignment.studentIds != null && !assignment.studentIds.includes(args.studentId)) continue
        const sessions = (await ctx.db
          .query('sessions')
          .withIndex('by_assignmentId', (q) => q.eq('assignmentId', assignment._id))
          .collect()).filter((session) => session.studentId === args.studentId)
        if (sessions.some((session) => session.status === 'completed')) continue
        const open = sessions.find((session) => session.status === 'in_progress')
        result.push({
          assignmentId: assignment._id,
          subtopicId: assignment.subtopicId,
          kind: assignment.kind,
          questionCount: ASSIGNMENT_QUESTION_COUNT[assignment.kind],
          dueAt: assignment.dueAt,
          status: open != null ? ('en_curso' as const) : ('pendiente' as const),
          sessionId: open?._id ?? null,
        })
      }
    }
    return result.sort((a, b) => a.dueAt - b.dueAt)
  },
})

/** How long a teaching cycle runs: what a topic lasts in class, with time to gather evidence. */
const CYCLE_DAYS = 14

/**
 * Freezes this week's plan as a two-week cycle (F42): the subtopics for the
 * whole class and the groups, each with how many students sat below Familiar
 * at the start. Starting a new cycle simply supersedes the previous one.
 */
export const startCycle = mutation({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    const { classGroup, accountId } = await requireClassGroupWriter(ctx, args.classGroupId)
    const now = Date.now()
    const { rows, subtopics } = await gatherClassEvidence(ctx, args.classGroupId, now)
    const plan = classTeachingPlan({ subtopics, students: rows })
    const evidenceOf = (subtopicId: string) => subtopics.find((entry) => entry.subtopicId === subtopicId)
    const groupSubtopicIds = [...new Set(plan.groups.map((group) => group.subtopicId))]
    return ctx.db.insert('classCycles', {
      classGroupId: args.classGroupId,
      orgId: classGroup.orgId,
      createdBy: accountId,
      startedAt: now,
      endsAt: now + CYCLE_DAYS * DAY_MS,
      subtopics: [
        ...plan.wholeClass.map((item) => ({ subtopicId: item.subtopicId, subjectId: item.subjectId, tier: 'curso' as const })),
        ...groupSubtopicIds.map((subtopicId) => ({
          subtopicId,
          subjectId: evidenceOf(subtopicId)!.subjectId,
          tier: 'grupo' as const,
        })),
      ].map((item) => ({ ...item, ...belowFamiliar(evidenceOf(item.subtopicId)!) })),
      groups: groupSubtopicIds.map((subtopicId) => ({
        subtopicId,
        studentIds: plan.groups.filter((group) => group.subtopicId === subtopicId).flatMap((group) => group.studentIds as Id<'students'>[]),
      })),
    })
  },
})

/**
 * The teacher sets who works a subtopic in a small group during the cycle
 * (F39). A new subtopic joins the cycle with today as its baseline; an empty
 * list removes the group.
 */
export const setCycleGroup = mutation({
  args: { cycleId: v.id('classCycles'), subtopicId: v.string(), studentIds: v.array(v.id('students')) },
  handler: async (ctx, args) => {
    const cycle = await ctx.db.get('classCycles', args.cycleId)
    if (cycle == null) throw new ConvexError('Ese ciclo no existe.')
    await requireClassGroupWriter(ctx, cycle.classGroupId)
    const subjectId = getSubjectIdForSubtopic(args.subtopicId)
    if (subjectId == null) throw new ConvexError('Ese tema no existe.')
    const studentIds = await classStudentIdsAmong(ctx, cycle.classGroupId, args.studentIds)
    const groups = cycle.groups.filter((group) => group.subtopicId !== args.subtopicId)
    if (studentIds.length > 0) groups.push({ subtopicId: args.subtopicId, studentIds })
    let subtopics = cycle.subtopics
    if (!subtopics.some((item) => item.subtopicId === args.subtopicId)) {
      const evidence = await subtopicEvidenceFromAggregates(ctx, cycle.classGroupId, [{ subtopicId: args.subtopicId, subjectId }])
      const entry = evidence.get(args.subtopicId)
      subtopics = [...subtopics, {
        subtopicId: args.subtopicId,
        subjectId,
        tier: 'grupo',
        ...(entry == null ? { belowCount: 0, evidencedCount: 0 } : belowFamiliar(entry)),
      }]
    }
    await ctx.db.patch('classCycles', args.cycleId, { groups, subtopics })
  },
})

/** The class's latest cycle: its groups and, per subtopic, below Familiar then and now. */
export const getCurrentCycle = query({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupStaff(ctx, args.classGroupId)
    const cycle = await ctx.db
      .query('classCycles')
      .withIndex('by_classGroupId', (q) => q.eq('classGroupId', args.classGroupId))
      .order('desc')
      .first()
    if (cycle == null) return null
    const now = Date.now()
    const evidence = await subtopicEvidenceFromAggregates(ctx, args.classGroupId, cycle.subtopics)
    const students = await listClassStudents(ctx, args.classGroupId)
    const nameOf = new Map(students.map((student) => [student._id as string, { name: student.name ?? null, email: student.email }]))
    return {
      cycleId: cycle._id,
      startedAt: cycle.startedAt,
      endsAt: cycle.endsAt,
      isOver: now >= cycle.endsAt,
      progress: cycle.subtopics.map((item) => {
        const entry = evidence.get(item.subtopicId)
        return {
          subtopicId: item.subtopicId,
          subjectId: item.subjectId,
          tier: item.tier,
          before: { belowCount: item.belowCount, evidencedCount: item.evidencedCount },
          after: entry == null ? { belowCount: 0, evidencedCount: 0 } : belowFamiliar(entry),
        }
      }),
      groups: cycle.groups.map((group) => ({
        subtopicId: group.subtopicId,
        students: group.studentIds.map((studentId) => ({ studentId, ...nameOf.get(studentId) })),
      })),
      classStudents: students.map((student) => ({ studentId: student._id, name: student.name ?? null, email: student.email })),
    }
  },
})

/**
 * Every class's recent cycles for the school admin (F42): what each class
 * worked on and how many sat below Familiar then and now. Reads only the
 * subtopic aggregates, so a whole school fits in one query.
 */
export const listSchoolCycles = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    const cycles = await ctx.db
      .query('classCycles')
      .withIndex('by_orgId', (q) => q.eq('orgId', args.orgId))
      .order('desc')
      .take(30)
    const latestPerClass = cycles.filter((cycle, index) => cycles.findIndex((other) => other.classGroupId === cycle.classGroupId) === index)
    return Promise.all(latestPerClass.map(async (cycle) => {
      const classGroup = await ctx.db.get('classGroups', cycle.classGroupId)
      const bySubtopic = await subtopicEvidenceFromAggregates(ctx, cycle.classGroupId, cycle.subtopics)
      return {
        cycleId: cycle._id,
        classGroupName: classGroup?.name ?? '',
        startedAt: cycle.startedAt,
        endsAt: cycle.endsAt,
        progress: cycle.subtopics.map((item) => {
          const evidence = bySubtopic.get(item.subtopicId)
          return {
            subtopicId: item.subtopicId,
            tier: item.tier,
            before: { belowCount: item.belowCount, evidencedCount: item.evidencedCount },
            after: evidence == null ? { belowCount: 0, evidencedCount: 0 } : belowFamiliar(evidence),
          }
        }),
      }
    }))
  },
})

/** Classes the caller teaches, or every class of the schools they administer. */
export const listMyClassGroups = query({
  args: {},
  handler: async (ctx) => {
    const accountId = await requireAuthenticatedStudentId(ctx)
    const now = Date.now()
    const result = []
    for (const { membership, organization } of await listAccountOrganizations(ctx, accountId)) {
      if (membership.role === 'student') continue
      let classGroups: Doc<'classGroups'>[]
      if (membership.role === 'org_admin') {
        classGroups = await ctx.db.query('classGroups').withIndex('by_orgId', (q) => q.eq('orgId', organization._id)).collect()
      } else {
        const assigned = await ctx.db
          .query('classGroupMembers')
          .withIndex('by_orgId_accountId', (q) => q.eq('orgId', organization._id).eq('accountId', accountId))
          .collect()
        classGroups = []
        for (const row of assigned) {
          const classGroup = await ctx.db.get('classGroups', row.classGroupId)
          if (classGroup != null) classGroups.push(classGroup)
        }
      }
      for (const classGroup of classGroups) {
        const students = await ctx.db
          .query('classGroupMembers')
          .withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', classGroup._id).eq('role', 'student'))
          .collect()
        result.push({
          _id: classGroup._id,
          name: classGroup.name,
          grade: classGroup.grade,
          orgId: organization._id,
          orgName: organization.name,
          licenseActive: isLicenseActive(organization, now),
          studentCount: students.length,
        })
      }
    }
    return result.sort((a, b) => a.orgName.localeCompare(b.orgName, 'es') || a.name.localeCompare(b.name, 'es', { numeric: true }))
  },
})

/**
 * Students × areas for one class. Reads the same aggregates as the student's
 * Progreso (`buildSubjectLevels`), one student at a time.
 *
 * ponytail: ~5 indexed reads per student; fine to a few hundred students per
 * class, a per-student summary row if classes ever grow past that.
 */
export const getClassOverview = query({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    const { classGroup, organization } = await requireClassGroupStaff(ctx, args.classGroupId)
    const now = Date.now()

    const students = await Promise.all(
      (await listClassStudents(ctx, args.classGroupId)).map((student) => buildStudentRow(ctx, student, now)),
    )

    const subjects = LEVELLED_SUBJECT_IDS.map((subjectId) => {
      const levelled = students
        .map((student) => student.subjects.find((subject) => subject.subjectId === subjectId))
        .filter((subject) => subject?.levelIndex != null)
      const scores = levelled.map((subject) => subject!.score!)
      return {
        subjectId,
        levelledCount: levelled.length,
        averageScore: scores.length === 0 ? null : Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
        lowLevelCount: levelled.filter((subject) => subject!.levelIndex === 1).length,
      }
    })

    return {
      classGroup: { _id: classGroup._id, name: classGroup.name, grade: classGroup.grade, inviteCode: classGroup.inviteCode },
      organization: { _id: organization._id, name: organization.name, licenseActive: isLicenseActive(organization, now) },
      subjects,
      students: students.sort((a, b) => b.riskReasons.length - a.riskReasons.length || (a.name ?? a.email).localeCompare(b.name ?? b.email, 'es')),
    }
  },
})

/**
 * The class per subtopic (competency), weakest first: how many students
 * practiced it, the pooled accuracy and how the class spreads over the mastery
 * levels. Subtopics nobody practiced are left out — no number without evidence.
 */
export const getCompetencyReport = query({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupStaff(ctx, args.classGroupId)
    const bySubtopic = new Map<string, {
      subtopicId: string
      subjectId: string
      studentCount: number
      attemptCount: number
      correctCount: number
      masteryCounts: Record<MasteryLevel, number>
    }>()
    for (const student of await listClassStudents(ctx, args.classGroupId)) {
      const aggregates = await ctx.db
        .query('learnerSubtopicAggregates')
        .withIndex('by_studentId', (q) => q.eq('studentId', student._id))
        .collect()
      for (const aggregate of aggregates) {
        if (aggregate.subtopicId == null || aggregate.attemptCount === 0) continue
        const entry = bySubtopic.get(aggregate.subtopicId) ?? {
          subtopicId: aggregate.subtopicId,
          subjectId: aggregate.subjectId,
          studentCount: 0,
          attemptCount: 0,
          correctCount: 0,
          masteryCounts: Object.fromEntries(MASTERY_LEVELS.map((level) => [level, 0])) as Record<MasteryLevel, number>,
        }
        entry.studentCount += 1
        entry.attemptCount += aggregate.attemptCount
        entry.correctCount += aggregate.correctCount
        entry.masteryCounts[masteryLevelOf(aggregate)] += 1
        bySubtopic.set(aggregate.subtopicId, entry)
      }
    }
    return [...bySubtopic.values()]
      .map((entry) => ({ ...entry, accuracy: entry.correctCount / entry.attemptCount }))
      .sort((a, b) => a.accuracy - b.accuracy)
  },
})
