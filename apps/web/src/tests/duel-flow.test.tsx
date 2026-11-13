// @vitest-environment jsdom
import { act, useState, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getFunctionName } from 'convex/server'
import { ConvexError } from 'convex/values'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The live class duel in three steps: the teacher opens it, the projector
// tells the room how to enter, and a student enters with one tap.
// See staff-routes.test.tsx for why the hook-carrying packages are replaced.
const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  params: {} as Record<string, string>,
  mutation: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('lucide-react', () =>
  new Proxy({}, { has: () => true, get: (_, name) => (name === 'then' ? undefined : () => null) }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}), useParams: () => state.params }),
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
  lazyRouteComponent: (importer: () => Promise<Record<string, ComponentType>>, name = 'default') => ({
    load: async () => (await importer())[name],
  }),
  useNavigate: () => state.navigate,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useLocation: () => ({ pathname: '/', searchStr: '' }),
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => ({ queryKey: [getFunctionName(ref), args] }),
  useConvexMutation: () => state.mutation,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: [string] }) => state.queries[options.queryKey[0]] ?? { isPending: true, data: undefined },
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
  useMutation: ({ mutationFn, onSuccess }: {
    mutationFn: (variables: unknown) => Promise<unknown>
    onSuccess?: (data: unknown) => Promise<void> | void
  }) => {
    const [result, setResult] = useState<{ status: string; error?: unknown }>({ status: 'idle' })
    return {
      ...result,
      isPending: result.status === 'pending',
      mutate: (variables?: unknown) => {
        setResult({ status: 'pending' })
        mutationFn(variables).then(
          async (data) => {
            await onSuccess?.(data)
            setResult({ status: 'success' })
          },
          (error: unknown) => setResult({ status: 'error', error }),
        )
      },
    }
  },
}))

vi.mock('../lib/use-track.ts', () => ({ useTrack: () => () => {} }))
vi.mock('../lib/use-signed-in.ts', () => ({ useSignedIn: () => ({ studentId: 's1', email: 'profe@colegio.co', name: 'Ana' }) }))
vi.mock('../lib/student-session.ts', () => ({ useCurrentStudent: () => ({}) }))
vi.mock('../components/ThemeToggle.tsx', () => ({ ThemeToggle: () => null }))
vi.mock('../lib/auth-client.ts', () => ({ authClient: { signOut: async () => {} } }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  state.queries = { 'schools:getMySchools': { isPending: false, data: [{ role: 'teacher', name: 'Colegio' }] } }
  state.params = {}
  state.mutation.mockReset()
  state.navigate.mockReset()
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render(path: string) {
  const { Route } = (await import(path)) as {
    Route: { options: { component: ComponentType | { load: () => Promise<ComponentType> } } }
  }
  const { component } = Route.options
  const Page = 'load' in component ? await component.load() : component
  await act(async () => root.render(<Page />))
}

function buttons(name: string) {
  return [...container.querySelectorAll('button')].filter((element) => element.textContent?.trim() === name)
}

function button(name: string) {
  const found = buttons(name)[0]
  if (found == null) throw new Error(`no button "${name}" in: ${container.textContent}`)
  return found
}

const overview = {
  canWrite: true,
  organization: { name: 'Colegio', licenseActive: true },
  classGroup: { name: '11B', grade: 11, inviteCode: 'ABCD2345' },
  subjects: [],
  students: [],
}

describe('teacher: one click opens the duel', () => {
  it('puts "Duelo en vivo" at the top of the course, above the tabs, and opens the projector', async () => {
    state.params = { classGroupId: 'c1' }
    state.queries['teacher:getClassOverview'] = {
      isPending: false,
      isError: false,
      data: { ...overview, students: [{ studentId: 'st1', name: 'Luis', email: 'l@x.co', riskReasons: [], lastActiveAt: null, subjects: [] }] },
    }
    state.mutation.mockResolvedValue('d1')
    await render('../routes/teacher.$classGroupId.tsx')
    const go = button('Duelo en vivo')
    expect(go.compareDocumentPosition(container.querySelector('.tab-nav')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await act(async () => go.click())
    expect(state.mutation).toHaveBeenCalledWith({ classGroupId: 'c1' })
    expect(state.navigate).toHaveBeenCalledWith({ to: '/teacher/duelo/$id', params: { id: 'd1' } })
  })

  it('says what is missing, with the class code, when the class cannot play yet', async () => {
    state.params = { classGroupId: 'c1' }
    state.queries['teacher:getClassOverview'] = { isPending: false, isError: false, data: overview }
    state.mutation.mockRejectedValue(new ConvexError('Hacen falta al menos dos estudiantes en el curso. Compárteles el código ABCD2345.'))
    await render('../routes/teacher.$classGroupId.tsx')
    await act(async () => button('Duelo en vivo').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('ABCD2345')
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('offers no duel to a teacher not assigned to the class', async () => {
    state.params = { classGroupId: 'c1' }
    state.queries['teacher:getClassOverview'] = { isPending: false, isError: false, data: { ...overview, canWrite: false } }
    await render('../routes/teacher.$classGroupId.tsx')
    expect(buttons('Duelo en vivo')).toHaveLength(0)
  })

  it('puts the duel on every course card of the teacher home', async () => {
    const course = (id: string, name: string) => ({
      _id: id, name, grade: '11', orgId: 'o1', orgName: 'Colegio', licenseActive: true, nextTest: null, studentCount: 30,
    })
    state.queries['teacher:listMyClassGroups'] = { isPending: false, data: [course('c1', '11A'), course('c2', '11B')] }
    state.mutation.mockResolvedValue('d2')
    await render('../routes/teacher.index.tsx')
    expect(buttons('Duelo en vivo')).toHaveLength(2)
    await act(async () => buttons('Duelo en vivo')[1]!.click())
    expect(state.mutation).toHaveBeenCalledWith({ classGroupId: 'c2' })
    expect(state.navigate).toHaveBeenCalledWith({ to: '/teacher/duelo/$id', params: { id: 'd2' } })
  })
})

describe('projector: the room learns how to enter', () => {
  const lobby = (sizes: [number, number]) => ({
    isPending: false,
    isError: false,
    data: {
      status: 'lobby',
      classGroupId: 'c1',
      classGroupName: '11A',
      inviteCode: 'ABCD2345',
      endsAt: Date.now() + 600_000,
      teams: [{ name: 'Cóndores', size: sizes[0], score: 0 }, { name: 'Jaguares', size: sizes[1], score: 0 }],
      question: null,
      answeredCount: 0,
      closedQuestion: null,
    },
  })

  it('shows the three steps, the app address with its QR, the class code and who joined per team', async () => {
    state.params = { id: 'd1' }
    state.queries['duels:getDuelHostView'] = lobby([1, 0])
    await render('../routes/teacher.duelo.$id.tsx')
    const steps = [...container.querySelectorAll('.duel-steps li')].map((step) => step.textContent)
    expect(steps).toEqual(['1Abre Aprendo', '2Hoy', '3Entrar'])
    expect(container.textContent).toContain('aprendo-nine.vercel.app')
    expect(container.querySelector('img[src="/qr-aprendo.svg"]')).not.toBeNull()
    expect(container.textContent).toContain('ABCD2345')
    expect([...container.querySelectorAll('.duel-team-count')].map((count) => count.textContent)).toEqual(['1', '0'])
    expect(button('Empezar').disabled).toBe(true)
    expect(container.textContent).toContain('Falta 1')
  })

  it('lets the teacher start once two students are in', async () => {
    state.params = { id: 'd1' }
    state.queries['duels:getDuelHostView'] = lobby([1, 1])
    state.mutation.mockResolvedValue(undefined)
    await render('../routes/teacher.duelo.$id.tsx')
    expect(button('Empezar').disabled).toBe(false)
    await act(async () => button('Empezar').click())
    expect(state.mutation).toHaveBeenCalledWith({ duelId: 'd1' })
  })
})

describe('student: one tap enters the duel', () => {
  const playerView = (status: string) => ({
    isPending: false,
    isError: false,
    data: {
      status,
      endsAt: Date.now() + 600_000,
      teamIndex: null,
      teams: [{ name: 'Cóndores', size: 0, score: 0 }, { name: 'Jaguares', size: 0, score: 0 }],
      question: null,
      answered: null,
    },
  })

  it('joins on arrival, without a second button', async () => {
    state.params = { id: 'd1' }
    state.queries['duels:getDuelPlayerView'] = playerView('lobby')
    state.mutation.mockResolvedValue(undefined)
    await render('../routes/duelo.$id.tsx')
    expect(state.mutation).toHaveBeenCalledTimes(1)
    expect(state.mutation).toHaveBeenCalledWith({ duelId: 'd1', studentId: 's1' })
  })

  it('does not try to join a finished duel', async () => {
    state.params = { id: 'd1' }
    state.queries['duels:getDuelPlayerView'] = playerView('finished')
    await render('../routes/duelo.$id.tsx')
    expect(state.mutation).not.toHaveBeenCalled()
  })
})
