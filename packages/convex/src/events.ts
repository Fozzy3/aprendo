import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, type MutationCtx } from './_generated/server'
import { assertIsStudent } from './auth'
import { eventNameValidator, eventPropsValidator } from './validators'

/**
 * Pilot measurement: onboarding, screens, email clicks, the survey. Only what
 * sessions and attempts cannot already tell. Read by `measurement.getPilotFunnel`.
 */

export type EventName = typeof eventNameValidator.type
export type EventProps = typeof eventPropsValidator.type

const MAX_PROP_KEYS = 8
const MAX_KEY_LENGTH = 40
const MAX_VALUE_LENGTH = 200

/** Server code (the reminder cron) records here; the client goes through `track`. */
export async function recordEvent(ctx: MutationCtx, studentId: Id<'students'>, name: EventName, props?: EventProps) {
  if (props != null) {
    const entries = Object.entries(props)
    if (
      entries.length > MAX_PROP_KEYS
      || entries.some(([key, value]) => key.length > MAX_KEY_LENGTH || (typeof value === 'string' && value.length > MAX_VALUE_LENGTH))
    ) {
      throw new ConvexError('El evento trae demasiados datos.')
    }
  }
  await ctx.db.insert('events', { studentId, name, at: Date.now(), props })
}

export const track = mutation({
  args: { studentId: v.id('students'), name: eventNameValidator, props: v.optional(eventPropsValidator) },
  handler: async (ctx, { studentId, name, props }) => {
    await assertIsStudent(ctx, studentId)
    if (name === 'reminder_sent') throw new ConvexError('Ese evento solo lo registra el servidor.')
    await recordEvent(ctx, studentId, name, props)
  },
})
