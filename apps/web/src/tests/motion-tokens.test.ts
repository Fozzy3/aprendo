import { describe, expect, it } from 'vitest'
import { readMotionTokens } from '../lib/motion-tokens'

const style = (values: Record<string, string>) => ({ getPropertyValue: (name: string) => values[name] ?? '' })

describe('readMotionTokens', () => {
  it('reads student.css durations in seconds and the strong ease-out as a bezier', () => {
    const tokens = readMotionTokens(style({
      '--duration-quick': ' 160ms',
      '--duration-step': '280ms',
      '--duration-spring': '0.4s',
      '--duration-stagger': '50ms',
      '--ease-out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
    }))
    expect(tokens).toEqual({ quick: 0.16, step: 0.28, spring: 0.4, stagger: 0.05, ease: [0.23, 1, 0.32, 1] })
  })

  it('without the student look nothing moves', () => {
    expect(readMotionTokens(style({}))).toEqual({ quick: 0, step: 0, spring: 0, stagger: 0, ease: 'easeOut' })
  })
})
