// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueueItem } from '../lib/answer-queue'
import { useAnswerQueue } from '../lib/useAnswerQueue'

// Mounted with react-dom directly, as in session-timer.test.tsx.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Queue = ReturnType<typeof useAnswerQueue>

let root: Root
let hook: { current: Queue }

function mountQueue(send: (item: QueueItem) => Promise<unknown>) {
  hook = { current: null as unknown as Queue }
  function Probe() {
    hook.current = useAnswerQueue('s1', send)
    return null
  }
  act(() => root.render(<Probe />))
}

const answer = (sessionQuestionId: string) => ({
  type: 'answer' as const,
  sessionQuestionId,
  selectedOption: 'A',
  responseTimeMs: 1_000,
})

const sentQuestions = (send: ReturnType<typeof vi.fn>) =>
  send.mock.calls.map(([item]) => (item as QueueItem).sessionQuestionId)

describe('useAnswerQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    root = createRoot(document.createElement('div'))
  })
  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
  })

  // Offline, a send never settles. Every answer must already be in the Convex
  // client's ordered outbox when the completion is queued behind them.
  it('hands every pending write over at once, not one at a time', () => {
    const send = vi.fn(() => new Promise<never>(() => {}))
    mountQueue(send)

    act(() => {
      hook.current.push(answer('q40'))
      hook.current.push(answer('q41'))
      hook.current.push(answer('q42'))
    })

    expect(sentQuestions(send)).toEqual(['q40', 'q41', 'q42'])
  })

  it('sends a write waiting out a backoff before a flush lets the caller complete', async () => {
    const send = vi
      .fn<(item: QueueItem) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementation(() => new Promise<never>(() => {}))
    mountQueue(send)

    await act(async () => {
      hook.current.push(answer('q40'))
      await Promise.resolve()
    })
    expect(send).toHaveBeenCalledTimes(1)

    let flushed = false
    await act(async () => {
      void hook.current.flush(8_000).then(() => {
        flushed = true
      })
      await Promise.resolve()
    })
    expect(sentQuestions(send)).toEqual(['q40', 'q40'])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000)
    })
    expect(flushed).toBe(true)
  })
})
