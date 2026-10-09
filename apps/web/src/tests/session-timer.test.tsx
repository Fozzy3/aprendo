// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionTimer } from '../lib/useSessionTimer'

// @testing-library/react loads its own React under this config (see
// timed-session-intro.test.tsx), so the hook is mounted with react-dom directly.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const NOW = 1_000_000

let root: Root
let container: HTMLDivElement

function mountTimer(options: Parameters<typeof useSessionTimer>[0]) {
  function Probe() {
    useSessionTimer(options)
    return null
  }
  act(() => root.render(<Probe />))
}

describe('useSessionTimer warning', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
  })

  it('warns once when the clock crosses the threshold', () => {
    const onWarn = vi.fn()
    mountTimer({
      startedAt: NOW,
      expiresAt: NOW + 5 * 60_000 + 2_000,
      timeLimitMs: 10 * 60_000,
      warnBeforeMs: 5 * 60_000,
      onWarn,
    })

    expect(onWarn).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(3_000))
    expect(onWarn).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(10_000))
    expect(onWarn).toHaveBeenCalledTimes(1)
  })

  it('does not warn once the time is already up', () => {
    const onWarn = vi.fn()
    mountTimer({
      startedAt: NOW - 60_000,
      expiresAt: NOW - 1,
      timeLimitMs: 60_000,
      warnBeforeMs: 5 * 60_000,
      onWarn,
    })
    expect(onWarn).not.toHaveBeenCalled()
  })

  it('never warns an untimed session', () => {
    const onWarn = vi.fn()
    mountTimer({ startedAt: NOW, warnBeforeMs: 5 * 60_000, onWarn })
    act(() => vi.advanceTimersByTime(3_000))
    expect(onWarn).not.toHaveBeenCalled()
  })
})
