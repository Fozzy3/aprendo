/**
 * Schools: the B2B tenant.
 *
 * Aprendo staff create a school with its license and first school admin; the
 * school admin adds teachers and opens classes; students join a class with its
 * invite code. Learner data never moves: a school reaches a student only
 * through `memberships` (see `assertCanViewStudent` in `auth.ts`).
 */
import { ConvexError, v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { getMembership, requireAuthenticatedStudentId, requireOrgRole, requirePlatformAdmin } from './auth'
import { organizationPlanValidator } from './validators'

// No 0/O or 1/I: the code is read off a board and typed on a phone.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITE_CODE_LENGTH = 8
const MAX_NAME_CHARS = 120

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase()
}

export function isLicenseActive(organization: Pick<Doc<'organizations'>, 'licenseEndsAt'>, now: number) {
  return organization.licenseEndsAt > now
}

function cleanName(name: string, what: string) {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_CHARS) {
    throw new ConvexError(`${what} debe tener entre 1 y ${MAX_NAME_CHARS} caracteres.`)
  }
  return trimmed
}

function validateLicense(args: { seatLimit: number; licenseEndsAt: number }) {
  if (!Number.isInteger(args.seatLimit) || args.seatLimit < 1) {
    throw new ConvexError('Los cupos deben ser un número entero mayor que cero.')
  }
  if (!Number.isFinite(args.licenseEndsAt)) throw new ConvexError('Fecha de licencia inválida.')
}

async function newInviteCode(ctx: MutationCtx) {
  for (;;) {
    const code = Array.from(
      { length: INVITE_CODE_LENGTH },
      () => INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)],
    ).join('')
    const taken = await ctx.db.query('classGroups').withIndex('by_inviteCode', (q) => q.eq('inviteCode', code)).first()
    if (taken == null) return code
  }
}

async function requireAccountByEmail(ctx: Pick<QueryCtx, 'db'>, email: string) {
  const account = await ctx.db
    .query('students')
    .withIndex('by_normalizedEmail', (q) => q.eq('normalizedEmail', email.trim().toLowerCase()))
    .unique()
  if (account == null) {
    throw new ConvexError(`La cuenta ${email.trim()} no existe todavía: pídele que se registre en Aprendo primero.`)
  }
  return account
}

async function crestUrl(ctx: Pick<QueryCtx, 'storage'>, organization: Doc<'organizations'>) {
  return organization.crestStorageId == null ? null : await ctx.storage.getUrl(organization.crestStorageId)
}

function countStudents(ctx: Pick<QueryCtx, 'db'>, orgId: Id<'organizations'>) {
  return ctx.db
    .query('memberships')
    .withIndex('by_orgId_role', (q) => q.eq('orgId', orgId).eq('role', 'student'))
    .collect()
    .then((rows) => rows.length)
}

/** Every school the account belongs to, with its membership. */
export async function listAccountOrganizations(ctx: Pick<QueryCtx, 'db'>, accountId: Id<'students'>) {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_accountId', (q) => q.eq('accountId', accountId))
    .collect()
  const result: { membership: Doc<'memberships'>; organization: Doc<'organizations'> }[] = []
  for (const membership of memberships) {
    const organization = await ctx.db.get('organizations', membership.orgId)
    if (organization != null) result.push({ membership, organization })
  }
  return result
}

async function removeClassGroupMembers(ctx: MutationCtx, rows: Doc<'classGroupMembers'>[]) {
  for (const row of rows) await ctx.db.delete('classGroupMembers', row._id)
}

// ── Aprendo staff ────────────────────────────────────────────────────────────

export const createOrganization = mutation({
  args: {
    name: v.string(),
    plan: organizationPlanValidator,
    seatLimit: v.number(),
    licenseEndsAt: v.number(),
    adminEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    validateLicense(args)
    const admin = await requireAccountByEmail(ctx, args.adminEmail)
    const now = Date.now()
    const orgId = await ctx.db.insert('organizations', {
      name: cleanName(args.name, 'El nombre del colegio'),
      plan: args.plan,
      seatLimit: args.seatLimit,
      licenseEndsAt: args.licenseEndsAt,
      createdAt: now,
    })
    await ctx.db.insert('memberships', { orgId, accountId: admin._id, role: 'org_admin', createdAt: now })
    return orgId
  },
})

export const listOrganizations = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    const organizations = await ctx.db.query('organizations').withIndex('by_createdAt').order('desc').collect()
    const now = Date.now()
    return Promise.all(
      organizations.map(async (organization) => {
        const admins = await ctx.db
          .query('memberships')
          .withIndex('by_orgId_role', (q) => q.eq('orgId', organization._id).eq('role', 'org_admin'))
          .collect()
        const adminEmails = []
        for (const admin of admins) {
          const account = await ctx.db.get('students', admin.accountId)
          if (account != null) adminEmails.push(account.email)
        }
        return {
          _id: organization._id,
          name: organization.name,
          plan: organization.plan,
          seatLimit: organization.seatLimit,
          licenseEndsAt: organization.licenseEndsAt,
          licenseActive: isLicenseActive(organization, now),
          seatsUsed: await countStudents(ctx, organization._id),
          adminEmails,
        }
      }),
    )
  },
})

export const updateOrganizationLicense = mutation({
  args: {
    orgId: v.id('organizations'),
    plan: organizationPlanValidator,
    seatLimit: v.number(),
    licenseEndsAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    validateLicense(args)
    await ctx.db.patch('organizations', args.orgId, {
      plan: args.plan,
      seatLimit: args.seatLimit,
      licenseEndsAt: args.licenseEndsAt,
    })
  },
})

/** A school whose only admin left (or a second admin): promote an account. */
export const addOrgAdmin = mutation({
  args: { orgId: v.id('organizations'), email: v.string() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    const account = await requireAccountByEmail(ctx, args.email)
    const existing = await getMembership(ctx, args.orgId, account._id)
    if (existing == null) {
      await ctx.db.insert('memberships', { orgId: args.orgId, accountId: account._id, role: 'org_admin', createdAt: Date.now() })
    } else if (existing.role !== 'org_admin') {
      await ctx.db.patch('memberships', existing._id, { role: 'org_admin' })
    }
  },
})

// ── School admin ─────────────────────────────────────────────────────────────

export const getSchoolAdmin = query({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    const organization = await ctx.db.get('organizations', args.orgId)
    if (organization == null) throw new ConvexError('Colegio no encontrado.')

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_orgId_role', (q) => q.eq('orgId', args.orgId))
      .collect()
    const classGroups = await ctx.db.query('classGroups').withIndex('by_orgId', (q) => q.eq('orgId', args.orgId)).collect()

    const members = []
    for (const membership of memberships) {
      const account = await ctx.db.get('students', membership.accountId)
      if (account == null) continue
      members.push({
        membershipId: membership._id,
        accountId: account._id,
        email: account.email,
        name: account.name ?? null,
        role: membership.role,
      })
    }

    const groups = []
    for (const classGroup of classGroups) {
      const rows = await ctx.db
        .query('classGroupMembers')
        .withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', classGroup._id))
        .collect()
      groups.push({
        _id: classGroup._id,
        name: classGroup.name,
        grade: classGroup.grade,
        inviteCode: classGroup.inviteCode,
        teacherIds: rows.filter((row) => row.role === 'teacher').map((row) => row.accountId),
        studentCount: rows.filter((row) => row.role === 'student').length,
      })
    }

    return {
      organization: {
        _id: organization._id,
        name: organization.name,
        plan: organization.plan,
        seatLimit: organization.seatLimit,
        licenseEndsAt: organization.licenseEndsAt,
        licenseActive: isLicenseActive(organization, Date.now()),
        crestUrl: await crestUrl(ctx, organization),
      },
      seatsUsed: members.filter((member) => member.role === 'student').length,
      members: members.sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, 'es')),
      classGroups: groups.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })),
    }
  },
})

export const renameOrganization = mutation({
  args: { orgId: v.id('organizations'), name: v.string() },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    await ctx.db.patch('organizations', args.orgId, { name: cleanName(args.name, 'El nombre del colegio') })
  },
})

export const generateCrestUploadUrl = mutation({
  args: { orgId: v.id('organizations') },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    return ctx.storage.generateUploadUrl()
  },
})

const MAX_CREST_BYTES = 1_000_000

export const setCrest = mutation({
  args: { orgId: v.id('organizations'), storageId: v.union(v.id('_storage'), v.null()) },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    const organization = await ctx.db.get('organizations', args.orgId)
    if (organization == null) throw new ConvexError('Colegio no encontrado.')
    if (args.storageId != null) {
      const file = await ctx.db.system.get('_storage', args.storageId)
      if (file == null || !file.contentType?.startsWith('image/') || file.size > MAX_CREST_BYTES) {
        await ctx.storage.delete(args.storageId)
        throw new ConvexError('El escudo debe ser una imagen de máximo 1 MB.')
      }
    }
    if (organization.crestStorageId != null) await ctx.storage.delete(organization.crestStorageId)
    await ctx.db.patch('organizations', args.orgId, { crestStorageId: args.storageId ?? undefined })
  },
})

export const addTeacher = mutation({
  args: { orgId: v.id('organizations'), email: v.string() },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    const account = await requireAccountByEmail(ctx, args.email)
    const existing = await getMembership(ctx, args.orgId, account._id)
    if (existing?.role === 'student') {
      throw new ConvexError('Esa cuenta ya está en el colegio como estudiante.')
    }
    if (existing != null) return existing._id
    return ctx.db.insert('memberships', { orgId: args.orgId, accountId: account._id, role: 'teacher', createdAt: Date.now() })
  },
})

/** Takes the account out of the school and all its classes; a student's seat frees up. */
export const removeMember = mutation({
  args: { membershipId: v.id('memberships') },
  handler: async (ctx, args) => {
    const membership = await ctx.db.get('memberships', args.membershipId)
    if (membership == null) return
    const caller = await requireOrgRole(ctx, membership.orgId, ['org_admin'])
    if (caller._id === membership._id) {
      throw new ConvexError('No puedes quitarte a ti mismo del colegio.')
    }
    await removeClassGroupMembers(
      ctx,
      await ctx.db
        .query('classGroupMembers')
        .withIndex('by_orgId_accountId', (q) => q.eq('orgId', membership.orgId).eq('accountId', membership.accountId))
        .collect(),
    )
    await ctx.db.delete('memberships', membership._id)
  },
})

export const createClassGroup = mutation({
  args: { orgId: v.id('organizations'), name: v.string(), grade: v.string() },
  handler: async (ctx, args) => {
    await requireOrgRole(ctx, args.orgId, ['org_admin'])
    return ctx.db.insert('classGroups', {
      orgId: args.orgId,
      name: cleanName(args.name, 'El nombre del curso'),
      grade: cleanName(args.grade, 'El grado'),
      inviteCode: await newInviteCode(ctx),
      createdAt: Date.now(),
    })
  },
})

async function requireClassGroupAdmin(ctx: MutationCtx, classGroupId: Id<'classGroups'>) {
  const classGroup = await ctx.db.get('classGroups', classGroupId)
  if (classGroup == null) throw new ConvexError('Curso no encontrado.')
  await requireOrgRole(ctx, classGroup.orgId, ['org_admin'])
  return classGroup
}

/** Students stay in the school (and keep their seat); only the class goes. */
export const deleteClassGroup = mutation({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupAdmin(ctx, args.classGroupId)
    await removeClassGroupMembers(
      ctx,
      await ctx.db
        .query('classGroupMembers')
        .withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', args.classGroupId))
        .collect(),
    )
    await ctx.db.delete('classGroups', args.classGroupId)
  },
})

export const regenerateInviteCode = mutation({
  args: { classGroupId: v.id('classGroups') },
  handler: async (ctx, args) => {
    await requireClassGroupAdmin(ctx, args.classGroupId)
    const inviteCode = await newInviteCode(ctx)
    await ctx.db.patch('classGroups', args.classGroupId, { inviteCode })
    return inviteCode
  },
})

export const assignTeacher = mutation({
  args: { classGroupId: v.id('classGroups'), accountId: v.id('students') },
  handler: async (ctx, args) => {
    const classGroup = await requireClassGroupAdmin(ctx, args.classGroupId)
    const membership = await getMembership(ctx, classGroup.orgId, args.accountId)
    if (membership == null || membership.role === 'student') {
      throw new ConvexError('Solo puedes asignar docentes del colegio.')
    }
    const assigned = await ctx.db
      .query('classGroupMembers')
      .withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', args.classGroupId).eq('role', 'teacher'))
      .collect()
    if (assigned.some((row) => row.accountId === args.accountId)) return
    await ctx.db.insert('classGroupMembers', {
      classGroupId: args.classGroupId,
      orgId: classGroup.orgId,
      accountId: args.accountId,
      role: 'teacher',
      joinedAt: Date.now(),
    })
  },
})

export const unassignTeacher = mutation({
  args: { classGroupId: v.id('classGroups'), accountId: v.id('students') },
  handler: async (ctx, args) => {
    await requireClassGroupAdmin(ctx, args.classGroupId)
    const assigned = await ctx.db
      .query('classGroupMembers')
      .withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', args.classGroupId).eq('role', 'teacher'))
      .collect()
    await removeClassGroupMembers(ctx, assigned.filter((row) => row.accountId === args.accountId))
  },
})

// ── Every account ────────────────────────────────────────────────────────────

/**
 * Join a class with the code the teacher shares. Takes a seat the first time
 * the student enters the school; joining more classes of the same school does
 * not take another. The license and the seats are checked here, not in the UI.
 */
export const joinClassGroup = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const accountId = await requireAuthenticatedStudentId(ctx)
    const classGroup = await ctx.db
      .query('classGroups')
      .withIndex('by_inviteCode', (q) => q.eq('inviteCode', normalizeInviteCode(args.inviteCode)))
      .unique()
    if (classGroup == null) throw new ConvexError('Ese código no corresponde a ningún curso. Revísalo con tu docente.')
    const organization = await ctx.db.get('organizations', classGroup.orgId)
    if (organization == null || !isLicenseActive(organization, Date.now())) {
      throw new ConvexError('La licencia del colegio está vencida. Avísale a tu docente.')
    }

    const membership = await getMembership(ctx, classGroup.orgId, accountId)
    if (membership != null && membership.role !== 'student') {
      throw new ConvexError('Tu cuenta es de docente en este colegio; los códigos de curso son para estudiantes.')
    }
    if (membership == null) {
      if ((await countStudents(ctx, classGroup.orgId)) >= organization.seatLimit) {
        throw new ConvexError('El colegio ya no tiene cupos disponibles. Avísale a tu docente.')
      }
      await ctx.db.insert('memberships', {
        orgId: classGroup.orgId,
        accountId,
        role: 'student',
        createdAt: Date.now(),
      })
    }

    const already = await ctx.db
      .query('classGroupMembers')
      .withIndex('by_orgId_accountId', (q) => q.eq('orgId', classGroup.orgId).eq('accountId', accountId))
      .collect()
    if (!already.some((row) => row.classGroupId === classGroup._id)) {
      await ctx.db.insert('classGroupMembers', {
        classGroupId: classGroup._id,
        orgId: classGroup.orgId,
        accountId,
        role: 'student',
        joinedAt: Date.now(),
      })
    }
    return { orgId: classGroup.orgId, classGroupName: classGroup.name, schoolName: organization.name }
  },
})

/** The caller's schools, for the cover label and the teacher/school menus. */
export const getMySchools = query({
  args: {},
  handler: async (ctx) => {
    const accountId = await requireAuthenticatedStudentId(ctx)
    const now = Date.now()
    const schools = []
    for (const { membership, organization } of await listAccountOrganizations(ctx, accountId)) {
      const rows = await ctx.db
        .query('classGroupMembers')
        .withIndex('by_orgId_accountId', (q) => q.eq('orgId', organization._id).eq('accountId', accountId))
        .collect()
      const classGroups = []
      for (const row of rows) {
        const classGroup = await ctx.db.get('classGroups', row.classGroupId)
        if (classGroup != null) classGroups.push({ _id: classGroup._id, name: classGroup.name })
      }
      schools.push({
        orgId: organization._id,
        name: organization.name,
        crestUrl: await crestUrl(ctx, organization),
        role: membership.role,
        licenseActive: isLicenseActive(organization, now),
        licenseEndsAt: organization.licenseEndsAt,
        classGroups,
      })
    }
    return schools
  },
})
