/**
 * What a teacher reads about a class: every student's level per area with its
 * evidence, who needs attention and why, and which subtopics the class as a
 * whole gets wrong. Read-only, derived from the same aggregates the student
 * sees, so a teacher and a student never see two different levels.
 */
import { ConvexError, v } from 'convex/values'
import { query, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireAuthenticatedStudentId, requireOrgRole } from './auth'
import { LEVELLED_SUBJECT_IDS } from './levels'
import { MASTERY_LEVELS, masteryLevelOf, type MasteryLevel } from './mastery'
import { buildSubjectLevels } from './progress'
import { isLicenseActive, listAccountOrganizations } from './schools'

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

async function requireClassGroupStaff(ctx: QueryCtx, classGroupId: Id<'classGroups'>) {
  const classGroup = await ctx.db.get('classGroups', classGroupId)
  if (classGroup == null) throw new ConvexError('Curso no encontrado.')
  await requireOrgRole(ctx, classGroup.orgId, ['teacher', 'org_admin'])
  const organization = await ctx.db.get('organizations', classGroup.orgId)
  if (organization == null) throw new ConvexError('Colegio no encontrado.')
  return { classGroup, organization }
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

    const students = await Promise.all((await listClassStudents(ctx, args.classGroupId)).map(async (student) => {
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
    }))

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
