// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Welcome, type WelcomeStudent } from '../components/Welcome'

const state = vi.hoisted(() => ({
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  track: vi.fn(),
}))

// See timed-session-intro.test.tsx: icons are stubbed so a single React runs.
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
vi.mock('@convex-dev/react-query', () => ({
  useConvexMutation: (ref: Parameters<typeof getFunctionName>[0]) => state.mutations[getFunctionName(ref)],
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}))
vi.mock('../lib/use-track.ts', () => ({ useTrack: () => state.track }))
vi.mock('../components/ExamCountdown.tsx', () => ({ ExamCountdown: () => <p>fecha del examen</p> }))
vi.mock('../components/AvatarEditor.tsx', () => ({ AvatarEditor: () => <p>editor del personaje</p> }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const STUDENT = { _id: 's1', name: 'Ana María Ruiz' } as unknown as WelcomeStudent

let container: HTMLElement
let root: Root
let onDone: ReturnType<typeof vi.fn>

beforeEach(() => {
  state.mutations = Object.fromEntries(
    ['recordConsent', 'setDailyGoal', 'setWeeklyGoal', 'setReminders', 'completeOnboarding']
      .map((name) => [`students:${name}`, vi.fn(async () => null)]),
  )
  state.track = vi.fn()
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
  onDone = vi.fn(async () => {})
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const render = (props: { short?: boolean; student?: WelcomeStudent } = {}) =>
  act(() => root.render(<Welcome student={props.student ?? STUDENT} short={props.short} onDone={onDone} />))
const heading = () => container.querySelector('h1')?.textContent
const button = (name: string) => {
  const target = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name))
  if (target == null) throw new Error(`no button "${name}"`)
  return target
}
const click = (name: string) => act(async () => button(name).click())
const choose = (label: string) => {
  const input = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(label))?.querySelector('input')
  if (input == null) throw new Error(`no option "${label}"`)
  act(() => input.click())
}
const mutation = (name: string) => state.mutations[`students:${name}`]!
const progress = () => container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuetext')
const steps = () => state.track.mock.calls.filter(([name]) => name === 'onboarding_step').map(([, props]) => props)

describe('Welcome', () => {
  it('walks the seven steps, saving each decision, and starts the diagnostic', async () => {
    render()
    expect(heading()).toBe('Hola, Ana')
    expect(container.querySelectorAll('.welcome-areas li')).toHaveLength(5)
    expect(progress()).toBe('Paso 1 de 7')
    expect([...container.querySelectorAll('button')].some((b) => b.textContent?.includes('Atrás'))).toBe(false)

    await click('Empezar')
    expect(heading()).toBe('Antes de empezar')
    choose('Tengo menos de 18')
    expect(container.textContent).toContain('Mi acudiente sabe que uso Aprendo y lo autoriza')
    choose('Mi acudiente')
    await click('Continuar')
    expect(mutation('recordConsent')).toHaveBeenCalledWith({ studentId: 's1', isMinor: true })

    expect(heading()).toBe('Tu examen')
    await click('Ahora no')

    expect(heading()).toBe('Tu meta diaria')
    expect(container.textContent).toContain('unos 20 min')
    choose('10 preguntas')
    expect(container.querySelector('.welcome-week')?.textContent).toContain('50 preguntas')
    await click('Siguiente')
    expect(mutation('setDailyGoal')).toHaveBeenCalledWith({ studentId: 's1', questions: 10 })
    expect(mutation('setWeeklyGoal')).toHaveBeenCalledWith({ studentId: 's1', minutes: 100 })

    expect(heading()).toBe('Tu personaje')
    await click('Siguiente')

    expect(heading()).toBe('Recordatorios')
    const toggle = container.querySelector<HTMLInputElement>('input[role="switch"]')!
    expect(toggle.checked).toBe(true)
    await act(async () => toggle.click())
    expect(mutation('setReminders')).toHaveBeenCalledWith({ studentId: 's1', off: true })
    await click('Siguiente')

    expect(heading()).toBe('Tu diagnóstico')
    expect(container.textContent).toContain('Sin tutor y sin explicaciones')
    expect(mutation('completeOnboarding')).not.toHaveBeenCalled()
    await click('Empezar mi diagnóstico')
    expect(onDone).toHaveBeenCalledOnce()
    expect(mutation('completeOnboarding')).toHaveBeenCalledWith({ studentId: 's1' })
    expect(state.track).toHaveBeenLastCalledWith('onboarding_done')
    expect(steps()).toEqual(['hello', 'consent', 'exam', 'goal', 'avatar', 'reminders', 'diagnostic'].map((step) => ({ step })))
  })

  it('does not go past consent without an age and the box ticked', async () => {
    render()
    await click('Empezar')
    expect(button('Continuar').disabled).toBe(true)
    choose('Tengo 18 o más')
    expect(container.querySelector('a[href="/terminos"]')).not.toBeNull()
    expect(container.querySelector('a[href="/privacidad"]')).not.toBeNull()
    expect(button('Continuar').disabled).toBe(true)
    choose('Acepto')
    expect(button('Continuar').disabled).toBe(false)
    // Another age means another box to tick.
    choose('Tengo menos de 18')
    expect(button('Continuar').disabled).toBe(true)
  })

  it('goes back a step from the second one on', async () => {
    render()
    await click('Empezar')
    await click('Atrás')
    expect(heading()).toBe('Hola, Ana')
    expect(progress()).toBe('Paso 1 de 7')
  })

  it('stays on the step and says why when the diagnostic cannot start', async () => {
    onDone = vi.fn(async () => {
      throw new Error('sin red')
    })
    render({ student: { ...STUDENT, isMinor: false, consentAt: 1 } })
    for (const next of ['Empezar', 'Continuar', 'Ahora no', 'Siguiente', 'Siguiente', 'Siguiente']) await click(next)
    await click('Empezar mi diagnóstico')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('No pudimos iniciar el diagnóstico')
    expect(mutation('completeOnboarding')).not.toHaveBeenCalled()
  })

  it('the short version asks only consent and the daily goal, then hands back', async () => {
    render({ short: true })
    expect(heading()).toBe('Antes de empezar')
    expect(progress()).toBe('Paso 1 de 2')
    choose('Tengo 18 o más')
    choose('Acepto')
    await click('Continuar')
    expect(heading()).toBe('Tu meta diaria')
    await click('Listo')
    expect(mutation('setDailyGoal')).toHaveBeenCalledWith({ studentId: 's1', questions: 5 })
    expect(mutation('completeOnboarding')).toHaveBeenCalledWith({ studentId: 's1' })
    expect(onDone).toHaveBeenCalledOnce()
    expect(state.track).toHaveBeenLastCalledWith('onboarding_done', { short: true })
    expect(steps()).toEqual([{ step: 'consent', short: true }, { step: 'goal', short: true }])
  })
})
