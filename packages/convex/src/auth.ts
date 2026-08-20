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
import type { DataModel, Id } from './_generated/dataModel'

const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'
const trustedOrigins = Array.from(new Set([siteUrl, 'http://localhost:3002', 'http://localhost:3000']))

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
          await ctx.db.patch(existing._id, {
            email,
            updatedAt: now,
            lastSeenAt: now,
          })
          return
        }

        const studentId = await ctx.db.insert('students', {
          email,
          normalizedEmail,
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
        })
        await authComponent.setUserId(ctx, authUser._id, studentId)
      },
      onUpdate: async (ctx, newUser, oldUser) => {
        if (oldUser.email === newUser.email) return
        if (!newUser.userId) return
        const email = (newUser.email ?? '').toString()
        await ctx.db.patch(newUser.userId as Id<'students'>, {
          email,
          normalizedEmail: normalizeEmail(email),
          updatedAt: Date.now(),
        })
      },
      onDelete: async (ctx, authUser) => {
        if (!authUser.userId) return
        const studentId = authUser.userId as Id<'students'>
        const student = await ctx.db.get(studentId)
        if (student) await ctx.db.delete(studentId)
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
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    plugins: [convex({ authConfig })],
  })

export const getCurrentStudent = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.userId) return null
    const student = await ctx.db.get(authUser.userId as Id<'students'>)
    if (!student) return null
    return {
      _id: student._id,
      email: student.email,
      isAdmin: student.isAdmin === true,
    }
  },
})

export const getCurrentAdmin = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser?.userId) return null
    const student = await ctx.db.get(authUser.userId as Id<'students'>)
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

export async function assertOwnsStudent(
  ctx: GenericCtx<DataModel>,
  studentId: Id<'students'>,
) {
  const ownerId = await requireAuthenticatedStudentId(ctx)
  if (ownerId !== studentId) {
    throw new ConvexError('No tienes acceso a este estudiante.')
  }
}

export async function requireAdminStudentId(
  ctx: GenericCtx<DataModel> & Pick<QueryCtx, 'db'>,
): Promise<Id<'students'>> {
  const studentId = await requireAuthenticatedStudentId(ctx)
  const student = await ctx.db.get(studentId)
  if (!student?.isAdmin) {
    throw new ConvexError('Necesitas permisos de administrador.')
  }
  return studentId
}
