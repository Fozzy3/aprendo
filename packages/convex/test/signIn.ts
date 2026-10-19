import { convexTest, type TestConvex } from 'convex-test'
import schema from '../src/schema'
import { components } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { modules } from './convexModules'

// The Better Auth component, registered the way its own `test.ts` does but
// without `import.meta.glob` (bun has none).
const betterAuthDir = `${import.meta.dir}/../node_modules/@convex-dev/better-auth/src/component`
const { default: betterAuthSchema } = await import(`${betterAuthDir}/schema.ts`)
const betterAuthModules = Object.fromEntries(
  [...new Bun.Glob('**/*.ts').scanSync(betterAuthDir)].map((path) => [
    `./component/${path}`,
    () => import(`${betterAuthDir}/${path}`),
  ]),
)

// The agent component (tutor threads), the same way.
const agentDir = `${import.meta.dir}/../node_modules/@convex-dev/agent/src/component`
const { default: agentSchema } = await import(`${agentDir}/schema.ts`)
const agentModules = Object.fromEntries(
  [...new Bun.Glob('**/*.ts').scanSync(agentDir)]
    .filter((path) => !path.endsWith('.test.ts'))
    .map((path) => [`./component/${path}`, () => import(`${agentDir}/${path}`)]),
)

export function setupTest() {
  const t = convexTest(schema, modules)
  t.registerComponent('betterAuth', betterAuthSchema, betterAuthModules)
  t.registerComponent('agent', agentSchema, agentModules)
  return t
}

type Test = ReturnType<typeof setupTest>

/** A `students` row (the account) plus a live Better Auth session for it. */
export async function signUp(t: Test, email: string, extra: { isAdmin?: boolean } = {}) {
  const now = Date.now()
  const studentId = await t.run((ctx) =>
    ctx.db.insert('students', {
      email, normalizedEmail: email, createdAt: now, updatedAt: now, lastSeenAt: now, ...extra,
    }),
  )
  return { studentId, as: await signIn(t, studentId, email) }
}

export async function signIn(t: Test, studentId: Id<'students'>, email: string): Promise<TestConvex<typeof schema>> {
  const now = Date.now()
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: 'user',
      data: { name: email, email, emailVerified: true, createdAt: now, updatedAt: now, userId: studentId },
    },
  })
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: 'session',
      data: { token: `token-${email}`, expiresAt: now + 3_600_000, createdAt: now, updatedAt: now, userId: user._id },
    },
  })
  return t.withIdentity({ subject: user._id, sessionId: session._id })
}
