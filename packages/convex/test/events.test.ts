import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import { recordEvent } from '../src/events'
import { setupTest, signUp } from './signIn'

const events = (t: ReturnType<typeof setupTest>) => t.run((ctx) => ctx.db.query('events').collect())

describe('events.track', () => {
  test('a student records their own event, with when it happened', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    await ana.as.mutation(api.events.track, { studentId: ana.studentId, name: 'screen_view', props: { path: '/today' } })
    const rows = await events(t)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ studentId: ana.studentId, name: 'screen_view', props: { path: '/today' } })
    expect(typeof rows[0]!.at).toBe('number')
  })

  test('nobody records events for someone else, nor signed out', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const luis = await signUp(t, 'luis@x.co')
    await expect(luis.as.mutation(api.events.track, { studentId: ana.studentId, name: 'screen_view' })).rejects.toThrow()
    await expect(t.mutation(api.events.track, { studentId: ana.studentId, name: 'screen_view' })).rejects.toThrow()
    expect(await events(t)).toEqual([])
  })

  test('a reminder can only be recorded by the server', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    await expect(ana.as.mutation(api.events.track, { studentId: ana.studentId, name: 'reminder_sent' })).rejects.toThrow()
    await t.run((ctx) => recordEvent(ctx, ana.studentId, 'reminder_sent', { kind: 'streak' }))
    expect((await events(t)).map((row) => row.name)).toEqual(['reminder_sent'])
  })

  test('props stay small', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const track = (props: Record<string, string>) => ana.as.mutation(api.events.track, { studentId: ana.studentId, name: 'screen_view', props })
    await expect(track({ path: 'x'.repeat(201) })).rejects.toThrow()
    await expect(track(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, 'v'])))).rejects.toThrow()
    await expect(track({ ['k'.repeat(41)]: 'v' })).rejects.toThrow()
    expect(await events(t)).toEqual([])
  })
})
