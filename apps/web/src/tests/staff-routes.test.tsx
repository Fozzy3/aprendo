// @vitest-environment jsdom
import { act, useState, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Packages loaded outside Vite bring their own copy of React under this config
// (see timed-session-intro.test.tsx), so every hook-carrying dependency of the
// routes is replaced by a few lines that use the test's React.
const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  search: {} as Record<string, unknown>,
  params: {} as Record<string, string>,
  mutation: vi.fn(),
  navigate: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('lucide-react', () => {
  const Icon = () => null
  return { ArrowLeft: Icon, ArrowRight: Icon, Copy: Icon, Printer: Icon, RefreshCw: Icon, Trash2: Icon }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useSearch: () => state.search,
    useParams: () => state.params,
  }),
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  // The router plugin splits a route's component into its own chunk.
  lazyRouteComponent: (importer: () => Promise<Record<string, ComponentType>>, name = 'default') => ({
    load: async () => (await importer())[name],
  }),
  useNavigate: () => state.navigate,
  useRouter: () => ({ history: { back: vi.fn() } }),
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => ({
    queryKey: [getFunctionName(ref), args],
  }),
  useConvexMutation: () => state.mutation,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: [string] }) =>
    state.queries[options.queryKey[0]] ?? { isPending: true, data: undefined },
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
  // Just enough of useMutation for a form: pending, error, success and data.
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (variables: unknown) => Promise<unknown>
    onSuccess?: () => Promise<void> | void
  }) => {
    const [result, setResult] = useState<{ status: string; data?: unknown; error?: unknown }>({ status: 'idle' })
    return {
      ...result,
      isPending: result.status === 'pending',
      isSuccess: result.status === 'success',
      mutate: (variables?: unknown) => {
        setResult({ status: 'pending' })
        mutationFn(variables).then(
          async (data) => {
            await onSuccess?.()
            setResult({ status: 'success', data })
          },
          (error: unknown) => setResult({ status: 'error', error }),
        )
      },
    }
  },
}))

vi.mock('../lib/use-signed-in.ts', () => ({
  useSignedIn: () => ({ studentId: 's1', email: 'docente@colegio.edu.co', name: 'Ana Ruiz' }),
}))
vi.mock('../lib/student-session.ts', () => ({ useCurrentStudent: () => ({}) }))
vi.mock('../components/ThemeToggle.tsx', () => ({ ThemeToggle: () => null }))
vi.mock('../lib/auth-client.ts', () => ({
  authClient: { deleteUser: state.deleteUser, signOut: async () => {} },
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  state.queries = { 'schools:getMySchools': { isPending: false, data: [] } }
  state.search = {}
  state.params = {}
  state.mutation.mockReset()
  state.deleteUser.mockReset()
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

/** Types into a React-controlled input (React tracks the native value setter). */
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

describe('/join', () => {
  it('sends the code in capitals and confirms the class and the school', async () => {
    state.mutation.mockResolvedValue({ classGroupName: '11B', schoolName: 'Colegio San José' })
    await render('../routes/join.tsx')
    type(container.querySelector('input')!, 'abcd2345')
    await submit(container.querySelector('form')!)
    expect(state.mutation).toHaveBeenCalledWith({ inviteCode: 'ABCD2345' })
    expect(container.querySelector('h1')?.textContent).toBe('Ya estás en 11B')
    expect(container.textContent).toContain('Colegio San José')
  })

  it('arrives with the code from the shared link', async () => {
    state.search = { codigo: 'XYZW6789' }
    await render('../routes/join.tsx')
    expect(container.querySelector('input')?.value).toBe('XYZW6789')
  })

  it('says why the server refused', async () => {
    const { ConvexError } = await import('convex/values')
    state.mutation.mockRejectedValue(new ConvexError('El colegio ya usó todos sus cupos.'))
    await render('../routes/join.tsx')
    type(container.querySelector('input')!, 'ABCD2345')
    await submit(container.querySelector('form')!)
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('El colegio ya usó todos sus cupos.')
  })
})

describe('/cuenta', () => {
  it('asks for the password before deleting, and says when it is wrong', async () => {
    state.deleteUser.mockResolvedValue({ error: { code: 'INVALID_PASSWORD' } })
    await render('../routes/cuenta.tsx')
    expect(container.querySelector('input[type="password"]')).toBeNull()
    act(() => button('Eliminar mi cuenta…').click())
    type(container.querySelector('input[type="password"]')!, 'equivocada')
    await submit(container.querySelector('form')!)
    expect(state.deleteUser).toHaveBeenCalledWith({ password: 'equivocada' })
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('La contraseña no coincide.')
  })

  it('lists the schools that can see the student, with role and classes', async () => {
    state.queries['schools:getMySchools'] = {
      isPending: false,
      data: [{ orgId: 'o1', name: 'Colegio San José', role: 'student', classGroups: [{ name: '11B' }] }],
    }
    await render('../routes/cuenta.tsx')
    expect(container.textContent).toContain('Colegio San José')
    expect(container.textContent).toContain('Estudiante · 11B')
  })
})

describe('/teacher', () => {
  it('tells an account with no school how a teacher gets added', async () => {
    state.queries['teacher:listMyClassGroups'] = { isPending: false, data: [] }
    await render('../routes/teacher.index.tsx')
    expect(container.textContent).toContain('Tu cuenta no es docente en ningún colegio')
    expect(container.textContent).toContain('docente@colegio.edu.co')
  })

  it('lists the classes and warns when the license ran out', async () => {
    state.queries['schools:getMySchools'] = {
      isPending: false,
      data: [{ orgId: 'o1', name: 'Colegio San José', role: 'teacher', classGroups: [] }],
    }
    state.queries['teacher:listMyClassGroups'] = {
      isPending: false,
      data: [{ _id: 'c1', name: '11B', grade: 11, orgName: 'Colegio San José', studentCount: 1, licenseActive: false }],
    }
    await render('../routes/teacher.index.tsx')
    expect(container.textContent).toContain('11B')
    expect(container.textContent).toContain('1 estudiante')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('La licencia de Colegio San José venció')
  })
})

describe('/teacher/$classGroupId', () => {
  const overview = {
    organization: { name: 'Colegio San José', licenseActive: true },
    classGroup: { name: '11B', grade: 11, inviteCode: 'ABCD2345' },
    subjects: [{ subjectId: 'matematicas', averageScore: null, levelledCount: 0, lowLevelCount: 0 }],
    students: [
      {
        studentId: 'st1',
        name: 'Luis Gómez',
        email: 'luis@x.co',
        riskReasons: ['sin_nivelacion'],
        lastActiveAt: null,
        subjects: [{ subjectId: 'matematicas', levelLabel: null, levelIndex: null, score: null, attemptCount: 2 }],
      },
      {
        studentId: 'st2',
        name: 'Sara Díaz',
        email: 'sara@x.co',
        riskReasons: [],
        lastActiveAt: Date.now(),
        subjects: [{ subjectId: 'matematicas', levelLabel: 'Nivel 3', levelIndex: 3, score: 62, attemptCount: 30 }],
      },
    ],
  }

  it('names who needs attention and shows a dash, not a guess, without evidence', async () => {
    state.params = { classGroupId: 'c1' }
    state.queries['teacher:getClassOverview'] = { isPending: false, isError: false, data: overview }
    state.queries['teacher:getCompetencyReport'] = { isPending: false, data: [] }
    state.queries['teacher:getClassTeachingPlan'] = {
      isPending: false,
      data: {
        wholeClass: [],
        groups: [],
        items: [],
        individual: [{ studentId: 's2', name: 'Luis Gómez', email: 'luis@x.co', riskReasons: ['sin_nivelacion'], lastActiveAt: null }],
      },
    }
    await render('../routes/teacher.$classGroupId.tsx')
    const oneToOne = container.querySelector('[aria-labelledby="week-individual-title"]')!
    expect(oneToOne.textContent).toContain('Luis Gómez')
    expect(oneToOne.textContent).toContain('Para abrir la charla')
    expect(oneToOne.textContent).not.toContain('Sara Díaz')
    const rows = [...container.querySelectorAll('[aria-labelledby="levels-title"] tbody tr')]
    expect(rows.find((row) => row.textContent?.includes('Luis Gómez'))?.textContent).toContain('—')
    expect(rows.find((row) => row.textContent?.includes('Sara Díaz'))?.textContent).toContain('Nivel 3')
    expect(container.textContent).toContain('ABCD2345')
  })

  it('prints the class report', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    state.params = { classGroupId: 'c1' }
    state.queries['teacher:getClassOverview'] = { isPending: false, isError: false, data: overview }
    state.queries['teacher:getCompetencyReport'] = { isPending: false, data: [] }
    await render('../routes/teacher.$classGroupId.tsx')
    act(() => button('Imprimir').click())
    expect(print).toHaveBeenCalledOnce()
    print.mockRestore()
  })

  it('says it cannot open a class the teacher no longer reaches', async () => {
    state.params = { classGroupId: 'c1' }
    state.queries['teacher:getClassOverview'] = { isPending: false, isError: true, error: new Error('x'), data: undefined }
    await render('../routes/teacher.$classGroupId.tsx')
    expect(container.textContent).toContain('No pudimos abrir este curso')
  })
})

describe('/school', () => {
  const admin = {
    organization: { _id: 'o1', name: 'Colegio San José', seatLimit: 2, licenseActive: true, licenseEndsAt: Date.now() + 86_400_000, crestUrl: null },
    seatsUsed: 2,
    classGroups: [],
    members: [
      { membershipId: 'm1', accountId: 'a1', role: 'org_admin', name: 'Ana Ruiz', email: 'docente@colegio.edu.co' },
      { membershipId: 'm2', accountId: 'a2', role: 'teacher', name: 'Pedro Pérez', email: 'pedro@colegio.edu.co' },
      { membershipId: 'm3', accountId: 'a3', role: 'student', name: 'Luis Gómez', email: 'luis@x.co' },
    ],
  }

  beforeEach(() => {
    state.queries['schools:getMySchools'] = {
      isPending: false,
      data: [{ orgId: 'o1', name: 'Colegio San José', role: 'org_admin', classGroups: [] }],
    }
    state.queries['schools:getSchoolAdmin'] = { isPending: false, isError: false, data: admin }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('warns when every seat is taken', async () => {
    await render('../routes/school.tsx')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('No quedan cupos')
  })

  it('creates a class with its name and grade', async () => {
    state.mutation.mockResolvedValue('c1')
    await render('../routes/school.tsx')
    const form = container.querySelector('[aria-labelledby="classes-title"] form') as HTMLFormElement
    type(form.querySelector('input')!, '11C')
    await submit(form)
    expect(state.mutation).toHaveBeenCalledWith({ orgId: 'o1', name: '11C', grade: '11' })
  })

  it('never offers the admin to remove themself', async () => {
    await render('../routes/school.tsx')
    const rows = [...container.querySelectorAll('[aria-labelledby="teachers-title"] .ruled-row')]
    expect(rows.find((row) => row.textContent?.includes('Ana Ruiz'))?.querySelector('button')).toBeNull()
    expect(rows.find((row) => row.textContent?.includes('Pedro Pérez'))?.querySelector('button')).not.toBeNull()
  })

  it('says why a teacher could not be removed', async () => {
    const { ConvexError } = await import('convex/values')
    state.mutation.mockRejectedValue(new ConvexError('El colegio necesita al menos un administrador.'))
    await render('../routes/school.tsx')
    const teachers = container.querySelector('[aria-labelledby="teachers-title"]')!
    await act(async () => {
      ;(teachers.querySelector('.ruled-row button') as HTMLButtonElement).click()
    })
    expect(state.mutation).toHaveBeenCalledWith({ membershipId: 'm2' })
    expect(teachers.querySelector('[role="alert"]')?.textContent).toBe('El colegio necesita al menos un administrador.')
  })
})
