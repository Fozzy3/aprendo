// @vitest-environment jsdom
import { act, createElement, useState, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// See staff-routes.test.tsx: hook-carrying packages are replaced by a few lines
// that use the test's React.
const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  current: {} as Record<string, unknown>,
  mutation: vi.fn(),
  navigate: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  changePassword: vi.fn(),
  deleteUser: vi.fn(),
  fetchQuery: vi.fn(),
  track: vi.fn(),
  history: [] as unknown[],
}))

vi.mock('lucide-react', () =>
  new Proxy({}, { has: () => true, get: (_, name) => (name === 'then' ? undefined : () => null) }))
// Motion is checked in the browser; here every motion.* is its plain element.
vi.mock('motion/react', () => {
  const MOTION_PROPS = ['variants', 'initial', 'animate', 'exit', 'transition', 'custom']
  const motion = new Proxy({}, {
    get: (_, tag: string) => ({ children, ref, ...props }: Record<string, unknown> & { children?: ReactNode; ref?: unknown }) =>
      createElement(tag, { ...Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.includes(key))), ref }, children),
  })
  const Pass = ({ children }: { children?: ReactNode }) => children
  return { motion, AnimatePresence: Pass, MotionConfig: Pass, useReducedMotion: () => true, animate: () => ({ stop() {} }) }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}), useParams: () => ({}) }),
  Link: ({ to, children, className, 'aria-current': current, 'aria-label': label }: {
    to: string; children: ReactNode; className?: string; 'aria-current'?: 'page'; 'aria-label'?: string
  }) => (
    <a href={to} className={className} aria-current={current} aria-label={label}>
      {children}
    </a>
  ),
  Outlet: () => null,
  lazyRouteComponent: (importer: () => Promise<Record<string, ComponentType>>, name = 'default') => ({
    load: async () => (await importer())[name],
  }),
  redirect: (options: object) => ({ redirectedTo: options }),
  useChildMatches: ({ select }: { select: (matches: unknown[]) => unknown }) => select([]),
  useNavigate: () => state.navigate,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useLocation: () => ({ pathname: '/', searchStr: '' }),
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => ({
    queryKey: [getFunctionName(ref), args],
  }),
  useConvexMutation: () => state.mutation,
}))

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: 'keep',
  useQuery: (options: { queryKey: [string]; enabled?: boolean }) =>
    state.queries[options.queryKey[0]] ?? { isPending: true, data: undefined },
  useQueryClient: () => ({ invalidateQueries: async () => {}, fetchQuery: state.fetchQuery }),
  useMutation: ({ mutationFn, onSuccess }: {
    mutationFn: (variables: unknown) => Promise<unknown>
    onSuccess?: (data: unknown) => Promise<void> | void
  }) => {
    const [result, setResult] = useState<{ status: string; data?: unknown; error?: unknown; variables?: unknown }>({ status: 'idle' })
    return {
      ...result,
      isPending: result.status === 'pending',
      isSuccess: result.status === 'success',
      reset: () => setResult({ status: 'idle' }),
      mutate: (variables?: unknown) => {
        setResult({ status: 'pending', variables })
        mutationFn(variables).then(
          async (data) => {
            await onSuccess?.(data)
            setResult({ status: 'success', data, variables })
          },
          (error: unknown) => setResult({ status: 'error', error, variables }),
        )
      },
    }
  },
}))

vi.mock('convex/react', () => ({
  usePaginatedQuery: () => ({ status: 'Exhausted', results: state.history, loadMore: vi.fn() }),
}))
vi.mock('../lib/student-session.ts', () => ({ useCurrentStudent: () => state.current }))
vi.mock('../lib/use-track.ts', () => ({ useTrack: () => state.track }))
vi.mock('../lib/use-signed-in.ts', () => ({ useSignedIn: () => state.current.session }))
vi.mock('../lib/auth-client.ts', () => ({
  authClient: {
    signOut: state.signOut,
    updateUser: state.updateUser,
    changePassword: state.changePassword,
    deleteUser: state.deleteUser,
  },
}))
vi.mock('../components/ThemeToggle.tsx', () => ({ ThemeToggle: () => <button type="button">Tema</button> }))
vi.mock('../components/SessionSolve.tsx', () => ({ SessionSolve: () => <div>resolviendo</div> }))
vi.mock('../components/Welcome.tsx', () => ({ Welcome: () => <div>bienvenida</div> }))
vi.mock('../components/PracticeBuilder.tsx', () => ({
  PracticeBuilder: ({ expanded }: { expanded: boolean }) => <div data-testid="builder" data-expanded={String(expanded)} />,
}))
vi.mock('../components/TimedSessionIntro.tsx', () => ({
  TimedSessionIntro: ({ children }: { children?: ReactNode }) => <div>intro{children}</div>,
}))
vi.mock('../components/GlobalScoreCard.tsx', () => ({ GlobalScoreCard: () => null }))
vi.mock('../components/CareerPicker.tsx', () => ({ CareerCard: () => <div>carrera</div> }))
vi.mock('../components/ExamCountdown.tsx', () => ({
  ExamCountdown: () => <div>fecha del examen</div>,
  TargetGap: () => null,
}))
vi.mock('../components/StudyTimeCard.tsx', () => ({ StudyTimeCard: () => null }))
vi.mock('../components/AreaLevelsChart.tsx', () => ({ AreaLevelsChart: () => null }))
vi.mock('../components/MasteryBadge.tsx', () => ({ MasteryBadge: () => null, MasteryLegend: () => null }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

const appState = (overrides: object = {}) => ({
  isPending: false,
  isError: false,
  data: {
    hasPlacement: true,
    hasConsent: true,
    onboarded: true,
    isStaff: false,
    roles: ['student'],
    placedSubjectIds: [],
    defaultRoute: '/today',
    ...overrides,
  },
})

beforeEach(() => {
  state.current = { session: { studentId: 's1', email: 'ana@x.co', name: 'Ana Ruiz' }, isReady: true, isError: false }
  state.queries = {
    'schools:getMySchools': { isPending: false, data: [] },
    'students:getStudentAppState': appState(),
  }
  state.history = []
  for (const mock of [state.mutation, state.navigate, state.signOut, state.updateUser, state.changePassword, state.deleteUser, state.fetchQuery, state.track]) {
    mock.mockReset()
  }
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

function button(name: string) {
  const found = [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === name)
  if (found == null) throw new Error(`no button "${name}" in: ${container.textContent}`)
  return found
}

function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setValue.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.requestSubmit()
  })
}

const hrefs = (selector: string) => [...container.querySelectorAll(selector)].map((link) => link.getAttribute('href'))

async function redirectOf(path: string) {
  const { Route } = (await import(path)) as { Route: { options: { beforeLoad: () => void } } }
  try {
    Route.options.beforeLoad()
  } catch (thrown) {
    return thrown
  }
  throw new Error(`${path} did not redirect`)
}

const pathData = {
  isPending: false,
  data: {
    subjectId: 'matematicas',
    subjectLabel: 'Matemáticas',
    level: { hasEnoughEvidence: false, attemptsNeeded: 8, score: null, placement: null },
    nodes: [
      { subtopicId: 'a', label: 'Fracciones', categoryId: 'n', categoryLabel: 'Números', questionCount: 5, hasLesson: true, attemptCount: 12, accuracy: 0.75 },
      { subtopicId: 'b', label: 'Proporciones', categoryId: 'n', categoryLabel: 'Números', questionCount: 5, hasLesson: false },
    ],
  },
}

function seedAprende() {
  state.queries['path:getLearningPath'] = pathData
  state.queries['path:listPathSubjects'] = {
    isPending: false,
    data: [
      { subjectId: 'matematicas', label: 'Matemáticas' },
      { subjectId: 'ingles', label: 'Inglés' },
    ],
  }
  state.queries['progress:getStudentProgress'] = {
    isPending: false,
    data: { subtopicMastery: [{ subtopicId: 'a', masteryLevel: 'competente' }], subjectAggregates: [], retoReady: true },
  }
  state.queries['today:getTodayDashboard'] = {
    isPending: false,
    data: { plan: { nextSubtopics: [{ subtopicId: 'b', subjectId: 'matematicas', level: 'familiar' }] } },
  }
}

describe('the old routes', () => {
  it('sends /syllabus to Aprende', async () => {
    expect(await redirectOf('../routes/syllabus.tsx')).toEqual({ redirectedTo: { to: '/path' } })
  })

  it('sends /history to Yo', async () => {
    expect(await redirectOf('../routes/history.tsx')).toEqual({ redirectedTo: { to: '/progress' } })
  })
})

describe('the shell', () => {
  it('has the four tabs, on the phone bar and the desktop bar alike', async () => {
    seedAprende()
    await render('../routes/path.tsx')
    const labels = (selector: string) => [...container.querySelectorAll(selector)].map((link) => link.textContent)
    expect(labels('.student-tabbar a')).toEqual(['Hoy', 'Aprende', 'Retos', 'Yo'])
    expect(labels('.student-topnav a')).toEqual(['Hoy', 'Aprende', 'Retos', 'Yo'])
    expect(container.querySelector('.student-tabbar [aria-current="page"]')?.textContent).toBe('Aprende')
  })

  it('keeps Cuenta, Salir and the theme where the phone can hide them', async () => {
    seedAprende()
    await render('../routes/path.tsx')
    const account = container.querySelector('.student-topbar-account')!
    expect(account.textContent).toContain('Cuenta')
    expect(account.textContent).toContain('Salir')
    expect(account.textContent).toContain('Tema')
  })

  it('labels the school where the account is a student, not the one it teaches at', async () => {
    seedAprende()
    state.queries['schools:getMySchools'] = {
      isPending: false,
      data: [
        { orgId: 'o1', name: 'Donde enseña', role: 'teacher', classGroups: [] },
        { orgId: 'o2', name: 'Donde estudia', role: 'student', classGroups: [{ name: '11B' }] },
      ],
    }
    await render('../routes/path.tsx')
    expect(container.querySelector('.school-label')?.textContent).toContain('Donde estudia')
    expect(container.querySelector('.school-label')?.textContent).not.toContain('Donde enseña')
  })

  it('offers the other side to a multi-role account, and nothing to a student', async () => {
    seedAprende()
    await render('../routes/path.tsx')
    expect(hrefs('.student-topbar a')).not.toContain('/teacher')

    act(() => root.unmount())
    root = createRoot(container)
    state.queries['students:getStudentAppState'] = appState({ roles: ['teacher', 'student'] })
    await render('../routes/path.tsx')
    expect(hrefs('.student-topbar a')).toContain('/teacher')
  })

  it('signs out from Salir', async () => {
    seedAprende()
    state.signOut.mockResolvedValue(undefined)
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    await render('../routes/path.tsx')
    await act(async () => button('Salir').click())
    expect(state.signOut).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith('/')
    vi.unstubAllGlobals()
  })
})

describe('the student guard', () => {
  it('sends an unplaced student to the diagnostic', async () => {
    seedAprende()
    state.queries['students:getStudentAppState'] = appState({ hasPlacement: false })
    await render('../routes/path.tsx')
    expect(state.navigate).toHaveBeenCalledWith({ to: '/diagnostic' })
    expect(container.querySelector('.student-shell')).toBeNull()
  })

  it('lets staff in without placement', async () => {
    seedAprende()
    state.queries['students:getStudentAppState'] = appState({ hasPlacement: false, isStaff: true })
    await render('../routes/path.tsx')
    expect(state.navigate).not.toHaveBeenCalled()
    expect(container.querySelector('.student-shell')).not.toBeNull()
  })

  it('sends a placed student without consent to the welcome, to come back after', async () => {
    seedAprende()
    state.queries['students:getStudentAppState'] = appState({ hasConsent: false, onboarded: false })
    await render('../routes/path.tsx')
    expect(state.navigate).toHaveBeenCalledWith({ to: '/diagnostic', search: { volver: '/' } })
    expect(container.querySelector('.student-shell')).toBeNull()
  })
})

describe('/app', () => {
  it('sends each role to its home, audit tab included', async () => {
    state.queries['students:getStudentAppState'] = appState({ defaultRoute: '/admin', defaultSearch: { tab: 'audit' } })
    await render('../routes/app.tsx')
    expect(state.navigate).toHaveBeenCalledWith({ to: '/admin', search: { tab: 'audit' } })
  })

  it('sends a signed-out visitor to login', async () => {
    state.current = { session: null, isReady: true, isError: false }
    await render('../routes/app.tsx')
    expect(state.navigate).toHaveBeenCalledWith({ to: '/login' })
  })

  it('says so when the account cannot be read, instead of spinning', async () => {
    state.queries['students:getStudentAppState'] = { isPending: false, isError: true, data: undefined }
    await render('../routes/app.tsx')
    expect(state.navigate).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Algo se rompió')
  })

  it('does not take a read failure for a signed-out visitor', async () => {
    state.current = { session: null, isReady: true, isError: true }
    await render('../routes/app.tsx')
    expect(state.navigate).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Algo se rompió')
  })

  it('treats a missing account row as an error too', async () => {
    state.queries['students:getStudentAppState'] = { isPending: false, isError: false, data: null }
    await render('../routes/app.tsx')
    expect(container.textContent).toContain('Algo se rompió')
  })
})

describe('/diagnostic', () => {
  beforeEach(() => {
    state.queries['sessions:listSessions'] = { isPending: false, data: [] }
    state.queries['students:getStudent'] = { isPending: false, data: { _id: 's1', name: 'Ana Ruiz' } }
  })

  it('opens with the welcome until the student has finished it', async () => {
    state.queries['students:getStudentAppState'] = appState({ hasPlacement: false, hasConsent: false, onboarded: false })
    await render('../routes/diagnostic.tsx')
    expect(container.textContent).toContain('bienvenida')
    expect(container.textContent).not.toContain('intro')
  })

  it('skips the welcome once it is done', async () => {
    state.queries['students:getStudentAppState'] = appState({ hasPlacement: false })
    await render('../routes/diagnostic.tsx')
    expect(container.textContent).not.toContain('bienvenida')
  })

  it('wears the student chrome, without tabs before the first placement', async () => {
    state.queries['students:getStudentAppState'] = appState({ hasPlacement: false })
    await render('../routes/diagnostic.tsx')
    expect(container.querySelector('.student-shell')).not.toBeNull()
    expect(container.querySelector('.diagnostic-shell')).toBeNull()
    expect(container.querySelector('.student-tabbar')).toBeNull()
    expect(container.querySelector('.student-topnav')).toBeNull()
    expect(container.querySelector('.student-shell.has-no-tabs')).not.toBeNull()
  })

  it('shows the tabs once the student is placed', async () => {
    await render('../routes/diagnostic.tsx')
    expect(container.querySelector('.student-tabbar')).not.toBeNull()
  })

  it('offers one general diagnostic of the five areas, not an area picker', async () => {
    state.queries['students:getStudentAppState'] = appState({ hasPlacement: false })
    await render('../routes/diagnostic.tsx')
    expect(container.querySelectorAll('.welcome-areas li')).toHaveLength(5)
    expect(container.textContent).not.toContain('Elige un área')
    expect(container.querySelectorAll('.ruled-list button')).toHaveLength(0)
  })
})

describe('/path, Aprende', () => {
  it('heads the area in its colour and counts topics in words', async () => {
    seedAprende()
    await render('../routes/path.tsx')
    const head = container.querySelector<HTMLElement>('.aprende-head')!
    expect(head.style.getPropertyValue('--area')).toBe('var(--subject-matematicas)')
    expect(container.querySelector('h1')?.textContent).toBe('Matemáticas')
    expect(head.textContent).toContain('1/2 temas')
    expect(head.textContent).not.toContain('Te faltan')
  })

  it('opens on the area Hoy linked to', async () => {
    seedAprende()
    const { LearningPathPage } = await import('../components/LearningPathPage.tsx')
    await act(async () => root.render(<LearningPathPage studentId="s1" initialSubjectId="ingles" />))
    expect(container.querySelector('[aria-pressed="true"]')?.textContent).toBe('Inglés')
  })

  it('has one primary action, on the plan’s pick, and it starts that topic', async () => {
    seedAprende()
    state.mutation.mockResolvedValue('new-session')
    await render('../routes/path.tsx')
    const primaries = container.querySelectorAll('.btn-primary')
    expect(primaries).toHaveLength(1)
    expect(primaries[0]?.textContent).toContain('Proporciones')
    await act(async () => (primaries[0] as HTMLButtonElement).click())
    expect(state.mutation).toHaveBeenCalledWith({
      studentId: 's1',
      kind: 'topic',
      subjectId: 'matematicas',
      subtopicId: 'b',
    })
    expect(state.navigate).toHaveBeenCalledWith({ to: '/practice/$sessionId', params: { sessionId: 'new-session' } })
  })

  it('lists every topic under its category, each opening its lesson', async () => {
    seedAprende()
    await render('../routes/path.tsx')
    expect(container.textContent).toContain('Números')
    expect(hrefs('.aprende-topic a')).toEqual(['/lesson/$subtopicId', '/lesson/$subtopicId'])
    expect(container.querySelector('.aprende-slot')).toBeNull()
    expect(container.querySelector('.aprende-topic.is-current')?.textContent).toContain('Siguiente')
    expect(hrefs('a')).not.toContain('/syllabus')
    expect(container.textContent).toContain('75 % de 12')
  })

  it('starts any topic from its own row', async () => {
    seedAprende()
    state.mutation.mockResolvedValue('new-session')
    await render('../routes/path.tsx')
    const row = container.querySelector('.aprende-topic')!
    await act(async () => (row.querySelector('button') as HTMLButtonElement).click())
    expect(state.mutation).toHaveBeenCalledWith({
      studentId: 's1',
      kind: 'topic',
      subjectId: 'matematicas',
      subtopicId: 'a',
    })
  })
})

function seedHoy(tasks: object[] = [
  {
    id: 'practice:b', kind: 'practice', title: 'Proporciones', minutes: 10,
    reason: 'Donde más puntos ganas',
    action: { type: 'session', kind: 'topic', subtopicId: 'matematicas.number_proportionality.ratios_proportions_percent' },
  },
  {
    id: 'lesson:a', kind: 'lesson', title: 'Lección: Fracciones', minutes: 5, reason: 'Primero la idea',
    action: { type: 'lesson', subtopicId: 'a' },
  },
  {
    id: 'simulacro', kind: 'simulacro', title: 'Simulacro · Sesión 1', minutes: 270, reason: 'Tu punto de partida',
    action: { type: 'session', kind: 'simulacro', simulacroSessionNumber: 1 },
  },
]) {
  state.queries['today:getTodayDashboard'] = {
    isPending: false,
    data: {
      plan: {
        tasks,
        nextSubtopics: [],
        hero: {
          questionCount: 5, minutes: 5, action: { type: 'session', kind: 'recommended' },
          goalQuestions: 5, answeredToday: 2, missionComplete: false,
        },
      },
      streakDays: 4, shields: 1, xp: { today: 30, thisWeek: 120 }, firstWeek: { active: false }, examPlan: null,
      practicedToday: true, shieldUsedDay: null, comeback: false,
      week: ['done', 'open', 'today', 'upcoming', 'upcoming', 'upcoming', 'upcoming'].map((status, index) => ({
        day: 20_402 + index, status, isToday: status === 'today',
      })),
    },
  }
  state.queries['today:getStickerAlbum'] = {
    isPending: false,
    data: {
      subjects: [
        { subjectId: 'matematicas', label: 'Matemáticas', earnedCount: 1, stickers: [{}, {}, {}] },
        { subjectId: 'ingles', label: 'Inglés', earnedCount: 0, stickers: [{}] },
      ],
    },
  }
  state.queries['path:listPathSubjects'] = {
    isPending: false,
    data: [{ subjectId: 'matematicas', level: { placement: { band: { labelEs: 'Nivel 2' } } } }],
  }
  state.queries['sessions:getActiveSession'] = { isPending: false, data: null }
}

describe('/today, Hoy', () => {
  it('leads with the plan’s next step and says why', async () => {
    seedHoy()
    await render('../routes/today.tsx')
    const next = container.querySelector('[aria-labelledby="hoy-next-title"]')!
    expect(next.textContent).toContain('Proporciones')
    expect(next.textContent).toContain('Donde más puntos ganas')
    expect(container.querySelectorAll('.btn-primary')).toHaveLength(1)
  })

  it('starts the next step on the yellow button', async () => {
    seedHoy()
    state.mutation.mockResolvedValue('new-session')
    await render('../routes/today.tsx')
    await act(async () => (container.querySelector('.btn-primary') as HTMLButtonElement).click())
    expect(state.mutation).toHaveBeenCalledWith({
      studentId: 's1',
      kind: 'topic',
      subtopicId: 'matematicas.number_proportionality.ratios_proportions_percent',
    })
    expect(state.navigate).toHaveBeenCalledWith({ to: '/practice/$sessionId', params: { sessionId: 'new-session' } })
  })

  it('lists the rest of the day, each going where it starts', async () => {
    seedHoy()
    await render('../routes/today.tsx')
    const rest = container.querySelector('[aria-labelledby="hoy-rest-title"]')!
    expect(rest.textContent).toContain('Lección: Fracciones')
    expect(rest.textContent).toContain('Primero la idea')
    expect([...rest.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual(['/lesson/$subtopicId', '/practice'])
  })

  it('names every area with its topics done and its ICFES level, no stickers', async () => {
    seedHoy()
    await render('../routes/today.tsx')
    const areas = container.querySelector('[aria-labelledby="hoy-areas-title"]')!
    expect(areas.textContent).toContain('Matemáticas')
    expect(areas.textContent).toContain('1/3 temas')
    expect(areas.textContent).toContain('Nivel 2')
    expect(areas.textContent).toContain('Sin nivel')
    expect(container.querySelector('.sticker')).toBeNull()
  })

  it('offers the short practice when the plan has nothing listed', async () => {
    seedHoy([])
    await render('../routes/today.tsx')
    expect(container.querySelector('[aria-labelledby="hoy-next-title"]')?.textContent).toContain('Práctica recomendada')
    expect(container.querySelector('[aria-labelledby="hoy-rest-title"]')).toBeNull()
  })

  it('puts an open session first', async () => {
    seedHoy()
    state.queries['sessions:getActiveSession'] = { isPending: false, data: { _id: 'open1', kind: 'topic', questionCount: 10 } }
    await render('../routes/today.tsx')
    const next = container.querySelector('[aria-labelledby="hoy-next-title"]')!
    expect(next.textContent).toContain('Sigue donde ibas')
    expect(next.querySelector('a.btn-primary')?.getAttribute('href')).toBe('/practice/$sessionId')
  })

  type Dashboard = { plan: { hero: Record<string, unknown> } } & Record<string, unknown>
  const dashboard = () => (state.queries['today:getTodayDashboard'] as { data: Dashboard }).data

  it('meters the daily goal, before and once it is met', async () => {
    seedHoy()
    await render('../routes/today.tsx')
    const meter = container.querySelector('.goal-meter')!
    expect(meter.textContent).toContain('2/5')
    expect(meter.classList.contains('is-met')).toBe(false)

    act(() => root.unmount())
    root = createRoot(container)
    Object.assign(dashboard().plan.hero, { answeredToday: 6, missionComplete: true })
    await render('../routes/today.tsx')
    expect(container.querySelector('.goal-meter.is-met')?.textContent).toContain('Meta cumplida')
    expect(container.textContent).not.toContain('Meta del día cumplida')
  })

  it('shows the week Monday to Sunday, a past day without practice in neutral words', async () => {
    seedHoy()
    await render('../routes/today.tsx')
    const days = [...container.querySelectorAll('.week-strip li')]
    expect(days).toHaveLength(7)
    expect(days.map((day) => day.getAttribute('aria-label'))).toEqual([
      'Lunes: practicaste', 'Martes: sin práctica', 'Miércoles: hoy', 'Jueves: por venir',
      'Viernes: por venir', 'Sábado: por venir', 'Domingo: por venir',
    ])
    expect(days[1]?.classList.contains('is-open')).toBe(true)
  })

  it('says once that a shield looked after the streak yesterday', async () => {
    seedHoy()
    dashboard().shieldUsedDay = 20_403
    await render('../routes/today.tsx')
    expect(container.textContent).toContain('Un escudo cuidó tu racha ayer')
    await act(async () => button('Entendido').click())
    expect(container.textContent).not.toContain('Un escudo cuidó tu racha ayer')

    act(() => root.unmount())
    root = createRoot(container)
    await render('../routes/today.tsx')
    expect(container.textContent).not.toContain('Un escudo cuidó tu racha ayer')
  })

  it('late in the day, a streak not yet kept reads as alive, with the goal that keeps it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T23:30:00Z')) // 18:30 in Colombia
    seedHoy()
    dashboard().practicedToday = false
    await render('../routes/today.tsx')
    expect(container.querySelector('.next-card')?.textContent).toContain('Cuida tu racha de 4 días')
    vi.useRealTimers()
  })

  it('in the morning it says nothing about the streak', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T14:00:00Z')) // 9:00 in Colombia
    seedHoy()
    dashboard().practicedToday = false
    await render('../routes/today.tsx')
    expect(container.querySelector('.next-card')?.textContent).not.toContain('Cuida tu racha')
    vi.useRealTimers()
  })

  it('after days away, opens soft with one button for five questions', async () => {
    seedHoy()
    dashboard().comeback = true
    state.mutation.mockResolvedValue('new-session')
    await render('../routes/today.tsx')
    const next = container.querySelector('[aria-labelledby="hoy-next-title"]')!
    expect(next.textContent).toContain('¡Qué bueno verte!')
    expect(container.querySelectorAll('.btn-primary')).toHaveLength(1)
    await act(async () => (next.querySelector('.btn-primary') as HTMLButtonElement).click())
    expect(state.mutation).toHaveBeenCalledWith({
      studentId: 's1', kind: 'topic', subtopicId: 'matematicas.number_proportionality.ratios_proportions_percent', questionLimit: 5,
    })
  })

  it('shows the class league when there is one', async () => {
    seedHoy()
    state.queries['league:getClassLeague'] = {
      isPending: false,
      data: { status: 'no_xp_yet' },
    }
    await render('../routes/today.tsx')
    expect(container.querySelector('.league')?.textContent).toContain('liga de tu curso')
  })

  it('offers the pilot survey while it is due, and counts that it was shown', async () => {
    seedHoy()
    dashboard().surveyDue = true
    await render('../routes/today.tsx')
    const card = [...container.querySelectorAll('a')].find((link) => link.textContent?.includes('Cuéntanos cómo te va'))
    expect(card?.getAttribute('href')).toBe('/encuesta')
    expect(state.track).toHaveBeenCalledWith('survey_shown')
    expect(container.querySelectorAll('.btn-primary')).toHaveLength(1)
  })

  it('says nothing about the survey when it is not due', async () => {
    seedHoy()
    dashboard().surveyDue = false
    await render('../routes/today.tsx')
    expect(container.textContent).not.toContain('Cuéntanos cómo te va')
    expect(state.track).not.toHaveBeenCalledWith('survey_shown')
  })
})

describe('/encuesta', () => {
  it('opens the survey on who is answering, in the student look', async () => {
    state.queries['pilotSurvey:getMine'] = { isPending: false, data: null }
    await render('../routes/encuesta.tsx')
    expect(container.querySelector('.student-shell')).not.toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('¿Quién responde?')
  })

  it('says thanks instead of asking again once answered', async () => {
    state.queries['pilotSurvey:getMine'] = { isPending: false, data: { submittedAt: 1 } }
    await render('../routes/encuesta.tsx')
    expect(container.querySelector('h1')?.textContent).toBe('Ya la respondiste, gracias')
    expect(container.querySelector('[role="progressbar"]')).toBeNull()
  })
})

function seedYo() {
  state.queries['progress:getStudentProgress'] = {
    isPending: false,
    data: {
      snapshot: { overallSummary: { accuracy: 0.5 } },
      subjectLevels: [],
      subtopicMastery: [
        { subtopicId: 'a', masteryLevel: 'competente' },
        { subtopicId: 'b', masteryLevel: 'dominado' },
        { subtopicId: 'c', masteryLevel: 'familiar' },
      ],
      globalScore: { career: null },
    },
  }
  state.queries['progress:getProgressTrends'] = { isPending: false, data: { weekly: [], totalAttempts: 40, activeDays: 6 } }
  state.queries['today:getTodayDashboard'] = {
    isPending: false,
    data: { plan: { nextSubtopics: [] }, globalScore: {}, studyTime: {}, examPlan: null, examDate: null },
  }
  state.queries['history:getActivitySummary'] = {
    isPending: false,
    data: { days: [], stats: { currentStreakDays: 3, longestStreakDays: 5, activeDayCount: 6, totalAnswered: 40, totalCorrect: 20, accuracy: 0.5 } },
  }
}

describe('/progress, Yo', () => {
  it('leads with the student and their topics in words', async () => {
    seedYo()
    await render('../routes/progress.tsx')
    expect(container.querySelector('h1')?.textContent).toBe('Ana Ruiz')
    expect(container.querySelector('.yo-cover')?.textContent).toContain('2 temas en Competente+')
    expect(container.querySelector('.student-tabbar [aria-current="page"]')?.textContent).toBe('Yo')
  })

  it('carries the study calendar and the sessions that used to be /history', async () => {
    seedYo()
    state.history = [
      { _id: 'h1', kind: 'topic', status: 'completed', startedAt: 1, summary: { correctCount: 3, questionCount: 5, accuracy: 0.6, durationMs: 60_000 } },
    ]
    await render('../routes/progress.tsx')
    expect(container.querySelector('[aria-labelledby="history-days-title"]')).not.toBeNull()
    expect(container.querySelector('[aria-labelledby="history-sessions-title"]')?.textContent).toContain('3 de 5')
  })

  it('holds the career, the exam date, the theme, the account and sign out', async () => {
    seedYo()
    await render('../routes/progress.tsx')
    expect(container.textContent).toContain('carrera')
    expect(container.textContent).toContain('fecha del examen')
    const settings = container.querySelector('[aria-labelledby="yo-settings-title"]')!
    expect(settings.textContent).toContain('Tema')
    expect(settings.textContent).toContain('Salir')
    expect([...settings.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toContain('/cuenta')
  })

  it('still reaches the account before there is anything to measure', async () => {
    seedYo()
    state.queries['progress:getStudentProgress'] = { isPending: false, data: { snapshot: null, subtopicMastery: [] } }
    await render('../routes/progress.tsx')
    expect(container.textContent).toContain('Hacer el diagnóstico')
    expect(container.querySelector('[aria-labelledby="yo-settings-title"]')?.textContent).toContain('Salir')
  })

  it('offers the pilot survey in the settings until it is answered', async () => {
    seedYo()
    state.queries['pilotSurvey:getMine'] = { isPending: false, data: null }
    await render('../routes/progress.tsx')
    const settings = container.querySelector('[aria-labelledby="yo-settings-title"]')!
    const row = [...settings.querySelectorAll('a')].find((link) => link.getAttribute('href') === '/encuesta')
    expect(row?.textContent).toBe('¿Qué te pareció Aprendo?')
  })

  it('hides the survey row once answered, or while it loads', async () => {
    seedYo()
    await render('../routes/progress.tsx')
    expect(container.querySelector('a[href="/encuesta"]')).toBeNull()
    state.queries['pilotSurvey:getMine'] = { isPending: false, data: { submittedAt: 1 } }
    await render('../routes/progress.tsx')
    expect(container.querySelector('a[href="/encuesta"]')).toBeNull()
  })
})

describe('/practice, Retos', () => {
  function seedRetos({ dueCount = 3, retoReady = true, sessions = [] as unknown[] } = {}) {
    state.queries['sessions:listSessions'] = { isPending: false, data: sessions }
    state.queries['sessions:getReviewQueue'] = { isPending: false, data: { dueCount } }
    state.queries['progress:getStudentProgress'] = { isPending: false, data: { retoReady } }
  }
  const tiles = () => [...container.querySelectorAll<HTMLButtonElement>('.reto-tile')]
  const tile = (name: string) => tiles().find((element) => element.textContent?.includes(name))!

  it('launches Repaso, Reto and Simulacro, and nothing else', async () => {
    seedRetos()
    await render('../routes/practice.tsx')
    expect(tiles().map((element) => element.querySelector('.reto-tile-name')?.textContent)).toEqual(['Repaso', 'Reto', 'Simulacro'])
    expect(container.textContent).not.toContain('Práctica por tema')
    expect(container.textContent).not.toContain('Práctica recomendada')
    expect(container.textContent).not.toContain('Nivelación')
  })

  it('keeps the custom builder collapsed', async () => {
    seedRetos()
    await render('../routes/practice.tsx')
    expect(container.querySelector('[data-testid="builder"]')?.getAttribute('data-expanded')).toBe('false')
  })

  it('makes Repaso the primary action when something is due, and starts it', async () => {
    seedRetos()
    state.mutation.mockResolvedValue('new-session')
    await render('../routes/practice.tsx')
    expect(tile('Repaso').classList.contains('is-primary')).toBe(true)
    expect(container.querySelectorAll('.reto-tile.is-primary')).toHaveLength(1)
    await act(async () => tile('Repaso').click())
    expect(state.mutation).toHaveBeenCalledWith({ studentId: 's1', kind: 'repaso' })
  })

  it('moves the primary action to the Reto when nothing is due, and locks Repaso', async () => {
    seedRetos({ dueCount: 0 })
    await render('../routes/practice.tsx')
    expect(tile('Repaso').disabled).toBe(true)
    expect(tile('Reto').classList.contains('is-primary')).toBe(true)
  })

  it('locks the Reto until three topics were practised', async () => {
    seedRetos({ dueCount: 0, retoReady: false })
    await render('../routes/practice.tsx')
    expect(tile('Reto').disabled).toBe(true)
    expect(tile('Simulacro').classList.contains('is-primary')).toBe(true)
  })

  it('opens the simulacro picker instead of starting a 4-hour exam on one tap', async () => {
    seedRetos()
    await render('../routes/practice.tsx')
    act(() => tile('Simulacro').click())
    expect(state.mutation).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Sesión 1')
    expect(container.textContent).toContain('Por área')
  })

  it('shows what is unfinished, ready to resume', async () => {
    seedRetos({
      sessions: [{ _id: 'open1', kind: 'topic', status: 'in_progress', startedAt: 1, questionCount: 5, subtopicId: 'a' }],
    })
    await render('../routes/practice.tsx')
    expect(container.querySelector('[aria-labelledby="hub-resume-title"]')?.textContent).toContain('Continuar')
  })

  it('lets staff use the hub without placement', async () => {
    seedRetos()
    state.queries['students:getStudentAppState'] = appState({ hasPlacement: false, isStaff: true })
    await render('../routes/practice.tsx')
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('sends an unplaced student to the diagnostic, as every student tab does', async () => {
    seedRetos()
    state.queries['students:getStudentAppState'] = appState({ hasPlacement: false })
    await render('../routes/practice.tsx')
    expect(state.navigate).toHaveBeenCalledWith({ to: '/diagnostic' })
    expect(container.querySelector('.retos')).toBeNull()
  })

  it('sends a placed student without consent to the welcome, to come back after', async () => {
    seedRetos()
    state.queries['students:getStudentAppState'] = appState({ hasConsent: false, onboarded: false })
    await render('../routes/practice.tsx')
    expect(state.navigate).toHaveBeenCalledWith({ to: '/diagnostic', search: { volver: '/' } })
    expect(container.querySelector('.retos')).toBeNull()
  })
})

describe('/cuenta', () => {
  const download = vi.fn()

  beforeEach(() => {
    download.mockReset()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download(this.download)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lives inside the student shell for a student', async () => {
    await render('../routes/cuenta.tsx')
    expect(container.querySelector('.student-shell')).not.toBeNull()
    expect(container.querySelector('.auth-page')).toBeNull()
  })

  it('lives inside the staff shell for a teacher', async () => {
    state.queries['schools:getMySchools'] = {
      isPending: false,
      data: [{ orgId: 'o1', name: 'Colegio', role: 'teacher', classGroups: [] }],
    }
    await render('../routes/cuenta.tsx')
    expect(container.querySelector('.staff-shell')).not.toBeNull()
  })

  it('saves a new name', async () => {
    state.updateUser.mockResolvedValue({ error: null })
    await render('../routes/cuenta.tsx')
    const form = container.querySelector<HTMLFormElement>('[aria-labelledby="cuenta-name-title"] form')!
    expect(form.querySelector('input')?.value).toBe('Ana Ruiz')
    type(form.querySelector('input')!, '  Ana María  ')
    await submit(form)
    expect(state.updateUser).toHaveBeenCalledWith({ name: 'Ana María' })
  })

  it('will not save an empty name', async () => {
    await render('../routes/cuenta.tsx')
    const form = container.querySelector<HTMLFormElement>('[aria-labelledby="cuenta-name-title"] form')!
    type(form.querySelector('input')!, '   ')
    expect(form.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)
  })

  it('changes the password and says when the current one is wrong', async () => {
    state.changePassword.mockResolvedValue({ error: { code: 'INVALID_PASSWORD' } })
    await render('../routes/cuenta.tsx')
    const section = container.querySelector('[aria-labelledby="cuenta-password-title"]')!
    const inputs = section.querySelectorAll('input')
    type(inputs[0]!, 'vieja-clave')
    type(inputs[1]!, 'nueva-clave-1')
    await submit(section.querySelector('form')!)
    expect(state.changePassword).toHaveBeenCalledWith({
      currentPassword: 'vieja-clave',
      newPassword: 'nueva-clave-1',
      revokeOtherSessions: true,
    })
    expect(section.querySelector('[role="alert"]')?.textContent).toBe('La contraseña actual no coincide.')
  })

  it('refuses a new password that is too short, before asking the server', async () => {
    await render('../routes/cuenta.tsx')
    const section = container.querySelector('[aria-labelledby="cuenta-password-title"]')!
    const inputs = section.querySelectorAll('input')
    type(inputs[0]!, 'vieja-clave')
    type(inputs[1]!, 'corta')
    await submit(section.querySelector('form')!)
    expect(state.changePassword).not.toHaveBeenCalled()
    expect(section.querySelector('[role="alert"]')?.textContent).toContain('8')
  })

  it('downloads the student’s data as a JSON file', async () => {
    state.fetchQuery.mockResolvedValue({ account: { email: 'ana@x.co' } })
    await render('../routes/cuenta.tsx')
    await act(async () => button('Descargar mis datos').click())
    expect(state.fetchQuery).toHaveBeenCalledOnce()
    expect(state.fetchQuery.mock.calls[0]?.[0].queryKey).toEqual(['accountExport:exportMyData', { studentId: 's1' }])
    expect(download).toHaveBeenCalledOnce()
    expect(download.mock.calls[0]?.[0]).toMatch(/^aprendo-mis-datos-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('says when the download fails', async () => {
    state.fetchQuery.mockRejectedValue(new Error('x'))
    await render('../routes/cuenta.tsx')
    await act(async () => button('Descargar mis datos').click())
    expect(download).not.toHaveBeenCalled()
    expect(container.querySelector('[aria-labelledby="cuenta-export-title"] [role="alert"]')).not.toBeNull()
  })

  it('has its own Salir', async () => {
    await render('../routes/cuenta.tsx')
    expect(container.querySelector('[aria-labelledby="cuenta-signout-title"] button')?.textContent).toBe('Salir')
  })

  it('shows reminder emails as on and turns them off', async () => {
    state.queries['students:getStudent'] = { isPending: false, data: { _id: 's1' } }
    state.mutation.mockResolvedValue(null)
    await render('../routes/cuenta.tsx')
    const toggle = container.querySelector<HTMLInputElement>('[aria-labelledby="cuenta-reminders-title"] [role="switch"]')!
    expect(toggle.checked).toBe(true)
    await act(async () => toggle.click())
    expect(state.mutation).toHaveBeenCalledWith({ studentId: 's1', off: true })
    expect(toggle.checked).toBe(false)
  })

  it('shows reminders the student turned off as off, and puts the switch back if saving fails', async () => {
    state.queries['students:getStudent'] = { isPending: false, data: { _id: 's1', remindersOff: true } }
    state.mutation.mockRejectedValue(new Error('x'))
    await render('../routes/cuenta.tsx')
    const toggle = container.querySelector<HTMLInputElement>('[aria-labelledby="cuenta-reminders-title"] [role="switch"]')!
    expect(toggle.checked).toBe(false)
    await act(async () => toggle.click())
    expect(state.mutation).toHaveBeenCalledWith({ studentId: 's1', off: false })
    expect(toggle.checked).toBe(false)
  })

  it('no longer carries the pilot survey', async () => {
    state.queries['pilotSurvey:getMine'] = { isPending: false, data: null }
    await render('../routes/cuenta.tsx')
    expect(container.querySelector('[aria-labelledby="cuenta-survey-title"]')).toBeNull()
    expect(container.querySelector('a[href="/encuesta"]')).toBeNull()
  })
})
