import { describe, expect, test } from 'bun:test'
import { AI_GENERATION_TIMEOUT_MS, decideClaim, type ClaimableRow } from '../src/aiCache'

const NOW = 1_700_000_000_000
const VERSION = 'v1'

function row(overrides: Partial<ClaimableRow>): ClaimableRow {
  return { status: 'ready', promptVersion: VERSION, updatedAt: NOW, ...overrides }
}

describe('decideClaim', () => {
  test('creates when no row exists', () => {
    expect(decideClaim({ existing: null, promptVersion: VERSION, now: NOW })).toBe('create')
  })

  test('skips a ready row on the current prompt version', () => {
    expect(decideClaim({ existing: row({ status: 'ready' }), promptVersion: VERSION, now: NOW }))
      .toBe('skip')
  })

  test('skips a generating row that is still within the timeout', () => {
    const existing = row({ status: 'generating', updatedAt: NOW - AI_GENERATION_TIMEOUT_MS + 1 })
    expect(decideClaim({ existing, promptVersion: VERSION, now: NOW })).toBe('skip')
  })

  test('reclaims a failed row', () => {
    expect(decideClaim({ existing: row({ status: 'failed' }), promptVersion: VERSION, now: NOW }))
      .toBe('reclaim')
  })

  test('reclaims a ready row produced by an older prompt version', () => {
    const existing = row({ status: 'ready', promptVersion: 'v0' })
    expect(decideClaim({ existing, promptVersion: VERSION, now: NOW })).toBe('reclaim')
  })

  test('reclaims a generating row whose action died (stuck past the timeout)', () => {
    const existing = row({ status: 'generating', updatedAt: NOW - AI_GENERATION_TIMEOUT_MS - 1 })
    expect(decideClaim({ existing, promptVersion: VERSION, now: NOW })).toBe('reclaim')
  })

  test('does not reclaim a stale row that is still generating within the timeout', () => {
    // A fresh re-claim bumps updatedAt; an in-flight generation on an old version
    // should be left alone until it finishes or the timeout elapses.
    const existing = row({ status: 'generating', promptVersion: 'v0', updatedAt: NOW })
    expect(decideClaim({ existing, promptVersion: VERSION, now: NOW })).toBe('skip')
  })
})
