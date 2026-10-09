import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'
import {
  MAX_TRIES,
  enqueue,
  failItem,
  overlayQueue,
  parseQueue,
  readyToSend,
  releaseBackoff,
  settleItem,
} from '../lib/answer-queue'

const answer = (sessionQuestionId: string, selectedOption: string) => ({
  type: 'answer' as const,
  sessionQuestionId,
  selectedOption,
  responseTimeMs: 1000,
})

describe('enqueue', () => {
  it('keeps the last write per question and tool, in arrival order', () => {
    let queue = enqueue([], answer('q1', 'A'), 'a')
    queue = enqueue(queue, { type: 'flag', sessionQuestionId: 'q1', flagged: true }, 'b')
    queue = enqueue(queue, answer('q1', 'C'), 'c')

    expect(queue.map((item) => item.id)).toEqual(['b', 'c'])
    expect(queue[1]).toMatchObject({ selectedOption: 'C', tries: 0 })
  })

  it('treats a clear as the same slot as an answer', () => {
    let queue = enqueue([], answer('q1', 'A'), 'a')
    queue = enqueue(queue, { type: 'clear', sessionQuestionId: 'q1' }, 'b')
    expect(queue.map((item) => item.type)).toEqual(['clear'])
  })

  it('does not merge different questions', () => {
    let queue = enqueue([], answer('q1', 'A'), 'a')
    queue = enqueue(queue, answer('q2', 'B'), 'b')
    expect(queue).toHaveLength(2)
  })
})

describe('readyToSend', () => {
  const three = () =>
    enqueue(enqueue(enqueue([], answer('q1', 'A'), 'a'), answer('q2', 'B'), 'b'), answer('q3', 'C'), 'c')

  it('hands over every write not yet sent, in order', () => {
    expect(readyToSend(three(), new Set(), 0).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(readyToSend(three(), new Set(['a']), 0).map((item) => item.id)).toEqual(['b', 'c'])
    expect(readyToSend([], new Set(), 0)).toEqual([])
  })

  it('stops at a write waiting out its backoff, so none overtakes it', () => {
    const backingOff = failItem(three(), 'b', new Error('network'), 1_000).queue

    expect(readyToSend(backingOff, new Set(['a']), 1_500)).toEqual([])
    expect(readyToSend(backingOff, new Set(['a']), 2_000).map((item) => item.id)).toEqual(['b', 'c'])
  })
})

describe('releaseBackoff', () => {
  it('makes every write ready to send now', () => {
    const backingOff = failItem(enqueue([], answer('q1', 'A'), 'a'), 'a', new Error('x'), 5_000).queue
    expect(releaseBackoff(backingOff)).toEqual([{ ...answer('q1', 'A'), id: 'a', tries: 1, notBefore: 0 }])
  })
})

describe('settleItem / failItem', () => {
  it('removes a saved item, and is a no-op for an item a newer write replaced', () => {
    const queue = enqueue([], answer('q1', 'A'), 'a')
    expect(settleItem(queue, 'a')).toEqual([])
    expect(settleItem(queue, 'gone')).toBe(queue)
  })

  it('retries a transient failure with a growing backoff', () => {
    const queue = enqueue([], answer('q1', 'A'), 'a')
    const once = failItem(queue, 'a', new Error('network'), 0)
    const twice = failItem(once.queue, 'a', new Error('network'), 0)

    expect(once.dropped).toBeNull()
    expect(once.queue[0]).toMatchObject({ tries: 1, notBefore: 1_000 })
    expect(twice.queue[0]).toMatchObject({ tries: 2, notBefore: 2_000 })
  })

  it('drops an item the server refused on purpose (a ConvexError)', () => {
    const queue = enqueue([], answer('q1', 'A'), 'a')
    const result = failItem(queue, 'a', new ConvexError('Se acabó el tiempo de esta sesión.'), 0)
    expect(result.queue).toEqual([])
    expect(result.dropped?.id).toBe('a')
  })

  it('gives up after MAX_TRIES transient failures', () => {
    let queue = enqueue([], answer('q1', 'A'), 'a')
    let dropped = null
    for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
      const result = failItem(queue, 'a', new Error('boom'), 0)
      queue = result.queue
      dropped = result.dropped
    }
    expect(queue).toEqual([])
    expect(dropped).not.toBeNull()
  })
})

describe('overlayQueue', () => {
  it('folds pending writes into what each question should show', () => {
    let queue = enqueue([], answer('q1', 'A'), 'a')
    queue = enqueue(queue, { type: 'flag', sessionQuestionId: 'q1', flagged: true }, 'b')
    queue = enqueue(queue, { type: 'eliminate', sessionQuestionId: 'q2', options: ['B'] }, 'c')
    queue = enqueue(queue, { type: 'clear', sessionQuestionId: 'q3' }, 'd')

    const overlay = overlayQueue(queue)
    expect(overlay.get('q1')).toEqual({ selectedOption: 'A', confidence: undefined, flagged: true })
    expect(overlay.get('q2')).toEqual({ eliminatedOptions: ['B'] })
    expect(overlay.get('q3')).toEqual({ selectedOption: null, confidence: undefined })
    expect(overlay.has('q4')).toBe(false)
  })
})

describe('parseQueue', () => {
  it('restores a saved queue and makes it ready to send at once', () => {
    const saved = JSON.stringify(failItem(enqueue([], answer('q1', 'A'), 'a'), 'a', new Error('x'), 5_000).queue)
    expect(parseQueue(saved)).toEqual([
      { ...answer('q1', 'A'), id: 'a', tries: 1, notBefore: 0 },
    ])
  })

  it('ignores missing or corrupt storage', () => {
    expect(parseQueue(null)).toEqual([])
    expect(parseQueue('{not json')).toEqual([])
    expect(parseQueue(JSON.stringify([{ type: 'answer' }, 'x', null]))).toEqual([])
    expect(parseQueue(JSON.stringify({ type: 'flag' }))).toEqual([])
  })
})
