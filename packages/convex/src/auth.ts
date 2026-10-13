import { betterAuth } from 'better-auth/minimal'
import {
  type AuthFunctions,
  createClient,
  type GenericCtx,
} from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { ConvexError } from 'convex/values'
import authConfig from './auth.config'
import { components, internal } from './_generated/api'
import { query } from './_generated/server'
import type { QueryCtx } from './_generated/server'
import type { DataModel, Doc, Id } from './_generated/dataModel'
import { sendEmail } from './email'
import { deleteStudentData } from './students'

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'
// Local dev origins only when no real site is configured: in production they
// would let any page served from the visitor's own machine call the auth API.
const trustedOrigins = process.env.SITE_URL
  ? [siteUrl]
  : ['http://localhost:3000', 'http://localhost:3002']

const emailEnabled = process.env.RESEND_API_KEY != null

const authFunctions: AuthFunctions = internal.auth

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        const email = (authUser.email ?? '').toString()
        const normalizedEmail = normalizeEmail(email)
        const now = Date.now()

        const existing = await ctx.db
          .query('students')
          .withIndex('by_normalizedEmail', (q) =>
            q.eq('normalizedEmail', normalizedEmail),
          )
          .unique()

        if (existing) {
          await authComponent.setUserId(ctx, authUser._id, existing._id)
          await ctx.db.patch("students", existing._id, {
            email,
            updatedAt: now,
            lastSeenAt: now,
          })
          return
        }

        const studentId = await ctx.db.insert('students', {
          email,
          normalizedEmail,
          name: authUser.name?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
        })
        await authComponent.setUserId(ctx, authUser._id, studentId)
      },
      onUpdate: async (ctx, newUser, oldUser) => {
        if (oldUser.email === newUser.email && oldUser.name === newUser.name) return
        if (!newUser.userId) return
        const email = (newUser.email ?? '').toString()
        await ctx.db.patch("students", newUser.userId as Id<'students'>, {
          email,
          normalizedEmail: normalizeEmail(email),
          name: newUser.name?.trim() || undefined,
          updatedAt: Date.now(),
        })
      },
      onDelete: async (ctx, authUser) => {
        if (!authUser.userId) return
        const studentId = authUser.userId as Id<'students'>
        await deleteStudentData(ctx, studentId)
        // The tutor's threads are created with `userId: studentId` (tutor.ts).
        await ctx.runMutation(components.agent.users.deleteAllForUserIdAsync, { userId: studentId })
      },
    },
  },
})

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    // Verification is required once a mail provider is configured; without one
    // it would lock everyone out, so local development stays open.
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: emailEnabled,
      autoSignIn: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: 'Restablece tu contraseña de Aprendo',
          text: `Hola. Para elegir una contraseña nueva abre este enlace (vence en una hora):\n\n${url}\n\nSi no lo pediste, ignora este correo.`,
        })
      },
    },
    emailVerification: {
      sendOnSignUp: emailEnabled,
      // Signing in unverified sends a fresh link, so a lost email is not a dead end.
      sendOnSignIn: emailEnabled,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: 'Confirma tu correo en Aprendo',
          text: `Hola. Confirma tu correo para entrar a Aprendo:\n\n${url}\n\nSi no creaste una cuenta, ignora este correo.`,
        })
      },
    },
    // Self-service deletion (Ley 1581): the `onDelete` trigger above erases
    // everything the student produced.
    user: { deleteUser: { enabled: true } },
    plugins: [convex({ authConfig })],
  })

export const getCurrentStudent = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.userId) return null
    const student = await ctx.db.get("students", authUser.userId as Id<'students'>)
    if (!student) return null
    return {
      _id: student._id,
      email: student.email,
      name: student.name ?? null,
      isAdmin: student.isAdmin === true,
    }
  },
})

export const getCurrentAdmin = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.userId) return null
    const student = await ctx.db.get("students", authUser.userId as Id<'students'>)
    if (!student?.isAdmin) return null
    return {
      _id: student._id,
      email: student.email,
      isAdmin: true,
    }
  },
})

export async function requireAuthenticatedStudentId(
  ctx: GenericCtx<DataModel>,
): Promise<Id<'students'>> {
  const authUser = await authComponent.safeGetAuthUser(ctx)
  if (!authUser?.userId) {
    throw new ConvexError('No has iniciado sesión.')
  }
  return authUser.userId as Id<'students'>
}

/**
 * Only the student themselves. Every mutation on learner data goes through
 * this: a teacher who can read a student must never answer for them.
 */
export async function assertIsStudent(
  ctx: GenericCtx<DataModel>,
  studentId: Id<'students'>,
) {
  const ownerId = await requireAuthenticatedStudentId(ctx)
  if (ownerId !== studentId) {
    throw new ConvexError('No tienes acceso a este estudiante.')
  }
}

const STAFF_ROLES: readonly Doc<'memberships'>['role'][] = ['teacher', 'org_admin']

/**
 * The student, or a teacher or school admin of a school the student belongs
 * to. Read-only queries only (see `assertIsStudent`).
 */
export async function assertCanViewStudent(
  ctx: GenericCtx<DataModel> & Pick<QueryCtx, 'db'>,
  studentId: Id<'students'>,
) {
  const callerId = await requireAuthenticatedStudentId(ctx)
  if (callerId === studentId) return
  const studentOrgs = await ctx.db
    .query('memberships')
    .withIndex('by_accountId', (q) => q.eq('accountId', studentId))
    .collect()
  for (const membership of studentOrgs) {
    if (membership.role !== 'student') continue
    const caller = await getMembership(ctx, membership.orgId, callerId)
    if (caller != null && STAFF_ROLES.includes(caller.role)) return
  }
  throw new ConvexError('No tienes acceso a este estudiante.')
}

export function getMembership(
  ctx: Pick<QueryCtx, 'db'>,
  orgId: Id<'organizations'>,
  accountId: Id<'students'>,
) {
  return ctx.db
    .query('memberships')
    .withIndex('by_orgId_accountId', (q) => q.eq('orgId', orgId).eq('accountId', accountId))
    .unique()
}

/** The caller's membership in `orgId`, if it carries one of `roles`. */
export async function requireOrgRole(
  ctx: GenericCtx<DataModel> & Pick<QueryCtx, 'db'>,
  orgId: Id<'organizations'>,
  roles: readonly Doc<'memberships'>['role'][],
) {
  const callerId = await requireAuthenticatedStudentId(ctx)
  const membership = await getMembership(ctx, orgId, callerId)
  if (membership == null || !roles.includes(membership.role)) {
    throw new ConvexError('No tienes permisos en este colegio.')
  }
  return membership
}

/** Aprendo staff: the shared question bank and the schools' licenses. */
export async function requirePlatformAdmin(
  ctx: GenericCtx<DataModel> & Pick<QueryCtx, 'db'>,
): Promise<Id<'students'>> {
  const studentId = await requireAuthenticatedStudentId(ctx)
  const student = await ctx.db.get("students", studentId)
  if (!student?.isAdmin) {
    throw new ConvexError('Necesitas permisos de administrador.')
  }
  return studentId
}
