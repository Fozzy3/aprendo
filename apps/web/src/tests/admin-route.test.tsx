// @vitest-environment jsdom
import { act, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  staff: null as null | { isAdmin: boolean; reviewerSubjects: string[] },
  search: {} as Record<string, unknown>,
  queries: {} as Record<string, unknown>,
}))

vi.mock('lucide-react', () => {
  const Icon = () => null
  return { UploadCloud: Icon, X: Icon }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useSearch: () => state.search,
    useRouteContext: () => ({ staff: state.staff }),
  }),
  redirect: (options: object) => ({ redirect: options }),
  lazyRouteComponent: (importer: () => Promise<Record<string, ComponentType>>, name = 'default') => ({ load: async () => (await importer())[name] }),
  useNavigate: () => vi.fn(),
  Link: ({ children, search, className }: { children: ReactNode; search?: { tab?: string }; className?: string }) => (
    <a data-tab={search?.tab ?? 'bank'} className={className}>{children}</a>
  ),
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => ({ queryKey: [getFunctionName(ref), args] }),
  useConvexMutation: () => vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: [string] }) => state.queries[options.queryKey[0]] ?? { isPending: true, data: undefined },
  useSuspenseQuery: (options: { queryKey: [string] }) => state.queries[options.queryKey[0]] ?? { data: [] },
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
}))

vi.mock('../components/StaffShell.tsx', () => ({
  StaffShell: ({ nav, role, children }: { nav: ReactNode; role: string; children: ReactNode }) => (
    <div data-role={role}>
      <nav>{nav}</nav>
      {children}
    </div>
  ),
}))
vi.mock('../components/admin/AuditQueue.tsx', () => ({ AuditQueue: () => <p>Pantalla de auditoría</p> }))
vi.mock('../components/admin/ReportsQueue.tsx', () => ({ ReportsQueue: () => <p>Reportes</p> }))
vi.mock('../components/admin/SchoolsAdmin.tsx', () => ({ SchoolsAdmin: () => <p>Colegios</p> }))
vi.mock('../components/admin/PilotPanel.tsx', () => ({ PilotPanel: () => <p>Panel del piloto</p> }))
vi.mock('../components/MarkdownBlock.tsx', () => ({ MarkdownBlock: ({ markdown }: { markdown: string }) => <div>{markdown}</div> }))
vi.mock('../lib/pdf-upload.ts', () => ({ uploadPdfToConvex: vi.fn() }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type RouteOptions = {
  beforeLoad: (args: { context: { queryClient: { ensureQueryData: () => Promise<unknown> } } }) => Promise<unknown>
  validateSearch: (search: Record<string, unknown>) => { tab?: string }
  component: ComponentType | { load: () => Promise<ComponentType> }
}

async function route() {
  const { Route } = (await import('../routes/admin.tsx')) as unknown as { Route: { options: RouteOptions } }
  return Route.options
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  state.staff = { isAdmin: true, reviewerSubjects: [] }
  state.search = {}
  state.queries = { 'pdfs:listPdfUploads': { data: [] } }
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function renderPage() {
  const { component } = await route()
  const Page = 'load' in component ? await component.load() : component
  await act(async () => {
    root.render(<Page />)
  })
}

const tabs = () => [...container.querySelectorAll('nav a')].map((link) => link.textContent?.trim())

describe('/admin', () => {
  it('lets reviewers in and turns everyone else away', async () => {
    const { beforeLoad } = await route()
    const load = (member: unknown) => beforeLoad({ context: { queryClient: { ensureQueryData: async () => member } } })
    await expect(load({ isAdmin: false, reviewerSubjects: ['ingles'] })).resolves.toMatchObject({ staff: { isAdmin: false } })
    await expect(load(null)).rejects.toMatchObject({ redirect: { to: '/login' } })
  })

  it('old links land on the merged tabs', async () => {
    const { validateSearch } = await route()
    expect(validateSearch({ tab: 'uploads' }).tab).toBe('bank')
    expect(validateSearch({ tab: 'questions' }).tab).toBe('bank')
    expect(validateSearch({ tab: 'audit' }).tab).toBe('audit')
    expect(validateSearch({ tab: 'pilot' }).tab).toBe('pilot')
    expect(validateSearch({ tab: 'nada' }).tab).toBeUndefined()
  })

  it('staff see the whole panel, in Spanish, inside the staff shell', async () => {
    await renderPage()
    expect(tabs()).toEqual(['Banco', 'Auditoría', 'Reportes', 'Colegios', 'Piloto'])
    expect(container.querySelector('[data-role="admin"]')).not.toBeNull()
  })

  it('the bank tab has no English left', async () => {
    await renderPage()
    expect(container.textContent).toContain('Subir PDF')
    expect(container.textContent).not.toMatch(/Upload|Browse|Retry|questions|No PDFs/)
  })

  it('the pilot tab opens the pilot panel', async () => {
    state.search = { tab: 'pilot' }
    await renderPage()
    expect(container.textContent).toContain('Panel del piloto')
  })

  it('a reviewer never reaches the pilot panel', async () => {
    state.staff = { isAdmin: false, reviewerSubjects: ['ingles'] }
    state.search = { tab: 'pilot' }
    await renderPage()
    expect(tabs()).toEqual(['Auditoría'])
    expect(container.textContent).not.toContain('Panel del piloto')
  })

  it('a reviewer sees only the audit, whatever the link says', async () => {
    state.staff = { isAdmin: false, reviewerSubjects: ['ingles'] }
    state.search = { tab: 'schools' }
    await renderPage()
    expect(tabs()).toEqual(['Auditoría'])
    expect(container.textContent).toContain('Pantalla de auditoría')
    expect(container.querySelector('[data-role="reviewer"]')).not.toBeNull()
  })
})
