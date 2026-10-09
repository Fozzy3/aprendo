import { describe, expect, test } from 'bun:test'
import {
  COACH_REFRESH_MS,
  coachFailurePatch,
  coachSummaryForDisplay,
  decideCoachClaim,
} from '../src/coach'

const NOW = 1_700_000_000_000
const VERSION = 'v2'

function ready(generatedAt: number) {
  return { status: 'ready' as const, promptVersion: VERSION, updatedAt: generatedAt, generatedAt }
}

describe('decideCoachClaim', () => {
  test('keeps a summary when nothing was answered since it was written', () => {
    const existing = ready(NOW - 2 * COACH_REFRESH_MS)
    expect(
      decideCoachClaim({ existing, promptVersion: VERSION, now: NOW, lastActivityAt: NOW - 3 * COACH_REFRESH_MS }),
    ).toBe('skip')
  })

  // The week keeps going after the first visit: a summary written on Monday
  // must not still be the one shown on Friday after four more days of study.
  test('rewrites a summary once there is new activity and it is old enough', () => {
    const existing = ready(NOW - COACH_REFRESH_MS)
    expect(
      decideCoachClaim({ existing, promptVersion: VERSION, now: NOW, lastActivityAt: NOW - 1000 }),
    ).toBe('reclaim')
  })

  test('does not rewrite more often than the refresh interval', () => {
    const existing = ready(NOW - COACH_REFRESH_MS + 1)
    expect(
      decideCoachClaim({ existing, promptVersion: VERSION, now: NOW, lastActivityAt: NOW - 1000 }),
    ).toBe('skip')
  })

  test('still applies the shared policy: create, failed and stale prompt', () => {
    expect(
      decideCoachClaim({ existing: null, promptVersion: VERSION, now: NOW, lastActivityAt: null }),
    ).toBe('create')
    expect(
      decideCoachClaim({
        existing: { ...ready(NOW), status: 'failed' },
        promptVersion: VERSION,
        now: NOW,
        lastActivityAt: null,
      }),
    ).toBe('reclaim')
    expect(
      decideCoachClaim({ existing: ready(NOW), promptVersion: 'v3', now: NOW, lastActivityAt: null }),
    ).toBe('reclaim')
  })

  // A failed rewrite puts the old summary back (see `coachFailurePatch`) and
  // stamps `updatedAt`, so a model outage is not retried on every visit.
  test('a failed refresh waits a full interval before trying again', () => {
    const restored = { ...ready(NOW - 2 * COACH_REFRESH_MS), updatedAt: NOW - 1000 }
    expect(
      decideCoachClaim({ existing: restored, promptVersion: VERSION, now: NOW, lastActivityAt: NOW - 500 }),
    ).toBe('skip')
    expect(
      decideCoachClaim({
        existing: { ...restored, updatedAt: NOW - COACH_REFRESH_MS },
        promptVersion: VERSION,
        now: NOW,
        lastActivityAt: NOW - 500,
      }),
    ).toBe('reclaim')
  })

  // A failed rewrite of an old-prompt summary keeps its old promptVersion, which
  // the shared policy alone would reclaim on every visit during an outage.
  test('a failed refresh of an old-prompt summary also waits a full interval', () => {
    const restored = { ...ready(NOW - 2 * COACH_REFRESH_MS), promptVersion: 'v1', failureReason: 'timeout', updatedAt: NOW - 1000 }
    expect(
      decideCoachClaim({ existing: restored, promptVersion: VERSION, now: NOW, lastActivityAt: null }),
    ).toBe('skip')
    expect(
      decideCoachClaim({
        existing: { ...restored, updatedAt: NOW - COACH_REFRESH_MS },
        promptVersion: VERSION,
        now: NOW,
        lastActivityAt: null,
      }),
    ).toBe('reclaim')
  })
})

describe('coachFailurePatch', () => {
  test('a failed refresh keeps the last good summary', () => {
    expect(coachFailurePatch({ body: 'Buena semana.' }, 'timeout', NOW)).toEqual({
      status: 'ready',
      failureReason: 'timeout',
      updatedAt: NOW,
    })
  })

  test('a first summary that fails has nothing to keep', () => {
    expect(coachFailurePatch({}, 'timeout', NOW).status).toBe('failed')
  })
})

describe('coachSummaryForDisplay', () => {
  test('while a rewrite runs, the last good summary stays on screen', () => {
    const shown = coachSummaryForDisplay({ status: 'generating' as const, body: 'Buena semana.' })
    expect(shown).toEqual({ status: 'ready', body: 'Buena semana.' })
  })

  test('with nothing written yet, it reads as generating', () => {
    expect(coachSummaryForDisplay({ status: 'generating' as const }).status).toBe('generating')
  })
})
