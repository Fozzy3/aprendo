// @vitest-environment jsdom
import { act, type ComponentType, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Same setup as staff-routes.test.tsx: dependencies with hooks are replaced by
// a few lines that use the test's React.
const state = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
  contactEmail: null as string | null,
  resetPassword: vi.fn(),
  signInEmail: vi.fn(),
}))

vi.mock('lucide-react', () => {
  const Icon = () => null
  return { ArrowRight: Icon, BookOpen: Icon, Check: Icon, House: Icon, Trophy: Icon, UserRound: Icon, X: Icon }
})

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => state.search }),
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  lazyRouteComponent: (importer: () => Promise<Record<string, ComponentType>>, name = 'default') => ({
    load: async () => (await importer())[name],
  }),
}))

vi.mock('../lib/student-session.ts', () => ({ useCurrentStudent: () => ({}) }))
vi.mock('../components/ThemeToggle.tsx', () => ({ ThemeToggle: () => <button type="button" data-testid="theme" /> }))
vi.mock('../lib/contact.ts', () => ({
  get CONTACT_EMAIL() {
    return state.contactEmail
  },
}))
vi.mock('../lib/auth-client.ts', () => ({
  authClient: { resetPassword: state.resetPassword, signIn: { email: state.signInEmail } },
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  state.search = {}
  state.contactEmail = null
  state.resetPassword.mockReset()
  state.signInEmail.mockReset()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllEnvs()
  vi.resetModules()
})

type RouteModule = {
  Route: {
    options: {
      component: ComponentType | { load: () => Promise<ComponentType> }
      head?: () => { meta?: unknown[]; links?: unknown[]; scripts?: { type: string; children: string }[] }
    }
  }
}

async function render(path: string) {
  const { Route } = (await import(path)) as RouteModule
  const { component } = Route.options
  const Page = 'load' in component ? await component.load() : component
  await act(async () => root.render(<Page />))
}

function link(name: string) {
  return [...container.querySelectorAll('a')].find((element) => element.textContent?.trim() === name)
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

function expectPublicChrome() {
  expect(container.querySelector('[data-testid="theme"]')).not.toBeNull()
  expect(container.querySelector('footer a[href="/terminos"]')).not.toBeNull()
  expect(container.querySelector('footer a[href="/privacidad"]')).not.toBeNull()
}

describe('/', () => {
  it('states the general diagnostic length from the real constant', async () => {
    await render('../routes/index.tsx')
    expect(container.textContent).toContain(`${getConfiguredQuestionCount(SESSION_KIND_CONFIG.diagnostic)} preguntas de las cinco áreas`)
    expect(container.textContent).not.toContain('Nivelación por área')
    expect(container.textContent).not.toMatch(/quince/i)
  })

  it('has a single title and the theme toggle and footer', async () => {
    await render('../routes/index.tsx')
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expectPublicChrome()
  })

  it('writes to the school inbox when there is one', async () => {
    state.contactEmail = 'colegios@aprendo.test'
    await render('../routes/index.tsx')
    const cta = link('Hablar con nosotros')
    expect(cta?.getAttribute('href')).toContain('mailto:colegios@aprendo.test')
  })

  it('still offers a way in with no inbox configured', async () => {
    await render('../routes/index.tsx')
    expect(link('Hablar con nosotros')).toBeUndefined()
    expect(link('Crear una cuenta de prueba')?.getAttribute('href')).toBe('/login')
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('labels every product fragment as an example', async () => {
    await render('../routes/index.tsx')
    const fragments = [...container.querySelectorAll('[data-ui]')]
    expect(fragments.length).toBeGreaterThanOrEqual(3)
    for (const fragment of fragments) {
      expect(fragment.closest('figure')?.querySelector('figcaption')?.textContent).toMatch(/ejemplo/i)
    }
  })

  it('never claims teacher verification, or sells ICFES content', async () => {
    await render('../routes/index.tsx')
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/verificad/i)
    expect(text).toMatch(/banco original/i)
    expect(text).toMatch(/no hacen parte de lo que un colegio paga/i)
  })

  it('speaks to the student first: free pilot, sign-up and sign-in', async () => {
    await render('../routes/index.tsx')
    expect(container.querySelector('h1')?.textContent).toMatch(/Saber 11/)
    expect(container.textContent).toMatch(/gratis mientras dure el piloto/i)
    expect(link('Empezar gratis')?.getAttribute('href')).toBe('/login')
    expect(link('Ya tengo cuenta')?.getAttribute('href')).toBe('/login')
  })

  it('covers what students and schools ask about', async () => {
    await render('../routes/index.tsx')
    const text = container.textContent ?? ''
    expect(text).toContain('Qué mide')
    expect(text).toContain('Para docentes y colegios')
    expect(text).toContain('Plan de la semana')
    expect(text).toContain('Tus datos')
    expect(text).toMatch(/menor de edad/)
    expect(text).toContain('De dónde salen las preguntas')
  })

  it('publishes Organization and WebSite, and no FAQ or HowTo', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://aprendo.test/')
    const { Route } = (await import('../routes/index.tsx')) as RouteModule
    const script = Route.options.head!().scripts![0]!
    expect(script.type).toBe('application/ld+json')
    expect(JSON.parse(script.children)['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual([
      'Organization',
      'WebSite',
    ])
    expect(script.children).not.toMatch(/FAQPage|HowTo/)
  })
})

describe('publicHead', () => {
  it('points sharing and the canonical at the deployed site', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://aprendo.test/')
    const { publicHead } = await import('../lib/site.ts')
    const head = publicHead({ title: 'T', description: 'D', path: '/privacidad' })
    expect(head.links).toEqual([{ rel: 'canonical', href: 'https://aprendo.test/privacidad' }])
    expect(head.meta).toContainEqual({ property: 'og:image', content: 'https://aprendo.test/og.png' })
    expect(head.meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(head.meta).toContainEqual({ name: 'robots', content: 'index, follow' })
  })

  it('leaves out what needs the address when it is not known', async () => {
    vi.stubEnv('VITE_SITE_URL', '')
    const { publicHead } = await import('../lib/site.ts')
    const head = publicHead({ title: 'T', description: 'D', path: '/' })
    expect(head.links).toEqual([])
    expect(JSON.stringify(head.meta)).not.toContain('og:image')
  })
})

describe('/login', () => {
  it('signs in by default, with the theme toggle and footer', async () => {
    await render('../routes/login.tsx')
    expect(container.querySelector('h1')?.textContent).toBe('Entra a Aprendo')
    expectPublicChrome()
  })

  it('opens on sign-up from the landing', async () => {
    state.search = { modo: 'registro' }
    await render('../routes/login.tsx')
    expect(container.querySelector('h1')?.textContent).toBe('Crea tu cuenta')
  })

  it('refuses a short password before calling anyone', async () => {
    await render('../routes/login.tsx')
    type(container.querySelector('input[type="email"]')!, 'ana@x.co')
    type(container.querySelector('input[type="password"]')!, 'corta')
    await submit(container.querySelector('form')!)
    expect(state.signInEmail).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('al menos 8 caracteres')
  })
})

describe('/reset-password', () => {
  it('stays out of the index', async () => {
    const { Route } = (await import('../routes/reset-password.tsx')) as RouteModule
    expect(Route.options.head).toBeUndefined()
  })

  it('says the link is dead and goes back to sign in', async () => {
    await render('../routes/reset-password.tsx')
    expect(container.querySelector('h1')?.textContent).toBe('Este enlace ya no sirve')
    expect(link('Volver a iniciar sesión')?.getAttribute('href')).toBe('/login')
    expectPublicChrome()
  })

  it('saves the new password with the token from the link', async () => {
    state.search = { token: 'tok123' }
    state.resetPassword.mockResolvedValue({ error: null })
    await render('../routes/reset-password.tsx')
    type(container.querySelector('input[type="password"]')!, 'nueva-clave')
    await submit(container.querySelector('form')!)
    expect(state.resetPassword).toHaveBeenCalledWith({ newPassword: 'nueva-clave', token: 'tok123' })
    expect(container.querySelector('h1')?.textContent).toBe('Listo, ya tienes contraseña nueva')
  })
})

describe('legal pages', () => {
  it.each(['../routes/terminos.tsx', '../routes/privacidad.tsx'])('%s dates itself', async (path) => {
    await render(path)
    expect(container.textContent).toMatch(/Última actualización/)
    expectPublicChrome()
  })

  it('/privacidad covers leagues, nicknames, avatars, guardians, export and deletion', async () => {
    await render('../routes/privacidad.tsx')
    const text = container.textContent ?? ''
    for (const term of ['liga', 'apodo', 'avatar', 'acudiente', 'Descargar mis datos', 'Eliminar mi cuenta']) {
      expect(text).toContain(term)
    }
  })

  it('/privacidad names the data controller and covers reminders, the survey and the age question', async () => {
    const { DATA_CONTROLLER } = await import('../lib/site.ts')
    await render('../routes/privacidad.tsx')
    const text = container.textContent ?? ''
    for (const term of [DATA_CONTROLLER.legalName, DATA_CONTROLLER.nit, DATA_CONTROLLER.address, DATA_CONTROLLER.email]) {
      expect(text).toContain(term)
    }
    for (const term of ['recordatorio', 'encuesta', 'edad']) {
      expect(text).toContain(term)
    }
  })

  it('/terminos names the data controller and declares the pilot free and non-commercial', async () => {
    const { DATA_CONTROLLER } = await import('../lib/site.ts')
    await render('../routes/terminos.tsx')
    const text = container.textContent ?? ''
    expect(text).toContain(DATA_CONTROLLER.legalName)
    expect(text).toContain('gratuito')
    expect(text).toContain('sin fines comerciales')
  })
})
