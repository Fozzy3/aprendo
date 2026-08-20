import { internalMutation } from './_generated/server'

/**
 * One-off dev migration: wipe all session-related data so the unified
 * `sessions` schema (kind instead of type, timed sessions, etc.) can be
 * adopted cleanly. The question bank (questions / pdfUploads) is NOT touched.
 *
 * Run with: `bunx convex run migrations:resetSessionData`
 */
export const resetSessionData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      'questionAttempts',
      'sessionQuestions',
      'sessions',
      'learnerSubjectAggregates',
      'learnerSubtopicAggregates',
      'learnerProfileSnapshots',
      'practiceTutorThreads',
      'practiceTutorArtifacts',
    ] as const

    const deleted: Record<string, number> = {}
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect()
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
      deleted[table] = rows.length
    }

    return deleted
  },
})
