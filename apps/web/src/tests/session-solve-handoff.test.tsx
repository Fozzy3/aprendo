// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionSolve } from '../components/SessionSolve.tsx'

// Same setup as staff-routes.test.tsx: every hook-carrying package is a stub.
vi.mock('lucide-react', () => {
  const Icon = () => null
  return Object.fromEntries(
    [
      'AArrowDown', 'AArrowUp', 'Activity', 'ArrowLeft', 'BookOpen', 'Bot', 'Check', 'ChevronLeft', 'ChevronRight',
      'CircleCheck', 'CircleX', 'ClipboardCheck', 'CloudOff', 'EyeOff', 'Flag', 'Gauge', 'Hourglass',
      'LayoutGrid', 'MessageSquareWarning', 'RotateCcw', 'Send', 'SlidersHorizontal', 'Sparkles',
      'Strikethrough', 'Timer', 'Trophy', 'Undo2', 'X',
    ].map((name) => [name, Icon]),
  )
})
vi.mock('../components/MarkdownBlock.tsx', () => ({ MarkdownBlock: () => null, default: () => null }))
vi.mock('@tanstack/react-router', () => ({ useBlocker: () => undefined }))
vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (_ref: unknown, args: unknown) => ({ queryKey: ['getSession', args] }),
  useConvexMutation: () => vi.fn(),
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    isPending: false,
    data: {
      session: { _id: 's1', kind: 'recommended', status: 'completed', startedAt: 0 },
      questions: [],
    },
  }),
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('SessionSolve hand-off', () => {
  // The practice layout passes a new callback on every render, and it renders
  // on every router write while the review loads: each extra call restarted
  // that navigation, and the tab froze after "Entregar".
  it('hands a completed session to the review once, whatever callback comes next', () => {
    const onCompleted = vi.fn()
    const render = () =>
      act(() =>
        root.render(
          <SessionSolve sessionId="s1" onExit={() => {}} onCompleted={(id) => onCompleted(id)} />,
        ),
      )

    render()
    render()
    render()

    expect(onCompleted).toHaveBeenCalledTimes(1)
    expect(onCompleted).toHaveBeenCalledWith('s1')
  })
})
