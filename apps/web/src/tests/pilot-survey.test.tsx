// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PILOT_SURVEY_QUESTIONS } from '@aprendo/convex/pilotSurveyQuestions'
import { PilotSurvey } from '../components/PilotSurvey'
import { pilotSurveyCsv } from '../lib/pilot-survey-csv'

const state = vi.hoisted(() => ({ submit: vi.fn() }))

// See welcome.test.tsx: icons and motion are plain elements here.
vi.mock('lucide-react', () =>
  new Proxy({}, { has: () => true, get: (_, name) => (name === 'then' ? undefined : () => null) }))
vi.mock('motion/react', () => {
  const MOTION_PROPS = ['variants', 'initial', 'animate', 'exit', 'transition', 'custom']
  const motion = new Proxy({}, {
    get: (_, tag: string) => ({ children, ref, ...props }: Record<string, unknown> & { children?: ReactNode; ref?: unknown }) =>
      createElement(tag, { ...Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.includes(key))), ref }, children),
  })
  const Pass = ({ children }: { children?: ReactNode }) => children
  return { motion, AnimatePresence: Pass, MotionConfig: Pass }
})
vi.mock('@convex-dev/react-query', () => ({ useConvexMutation: () => state.submit }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => <a href={to} className={className}>{children}</a>,
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  state.submit = vi.fn(async () => null)
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const render = () => act(() => root.render(<PilotSurvey studentId="s1" />))
const heading = () => container.querySelector('h1')?.textContent
const progress = () => container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuetext')
const button = (name: string) => {
  const target = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
  if (target == null) throw new Error(`no button "${name}" in: ${container.textContent}`)
  return target
}
const hasButton = (name: string) => [...container.querySelectorAll('button')].some((b) => b.textContent?.trim() === name)
const click = (name: string) => act(async () => button(name).click())
const choose = (label: string) => {
  const input = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === label)?.querySelector('input')
  if (input == null) throw new Error(`no option "${label}" in: ${container.textContent}`)
  act(() => input.click())
}
const write = (value: string) => {
  const textarea = container.querySelector('textarea')!
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  act(() => {
    setValue.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('PilotSurvey', () => {
  it('asks one question per screen, back keeps the answer, and sends what was answered', async () => {
    render()
    expect(heading()).toBe('¿Qué tan fácil fue empezar a usar Aprendo?')
    expect(progress()).toBe('Pregunta 1 de 15')
    expect(hasButton('Atrás')).toBe(false)
    // Required: no skipping, and no going on without an answer.
    expect(hasButton('Saltar')).toBe(false)
    expect(button('Siguiente').disabled).toBe(true)
    choose('4')
    await click('Siguiente')

    expect(heading()).toBe('¿El diagnóstico inicial reflejó bien tu nivel?')
    await click('Atrás')
    expect(container.querySelector<HTMLInputElement>('input[value="4"]')?.checked).toBe(true)
    await click('Siguiente')

    for (const value of ['3', '5']) {
      choose(value)
      await click('Siguiente')
    }
    expect(heading()).toContain('qué tan útiles fueron la explicación y el tutor')
    choose('No lo usé')
    await click('Siguiente')
    for (const value of ['4', '5']) {
      choose(value)
      await click('Siguiente')
    }

    expect(heading()).toBe('¿Qué te hizo volver a practicar?')
    expect(container.textContent).toContain('Puedes marcar varias')
    choose('La racha')
    choose('El XP')
    await click('Siguiente')

    // Optional and unanswered: skip.
    expect(heading()).toBe('¿Qué te impidió practicar más?')
    await click('Saltar')
    choose('Celular propio')
    await click('Siguiente')
    await click('Saltar')
    choose('Muy decepcionado')
    await click('Siguiente')

    expect(heading()).toBe('¿Qué tan probable es que se lo recomiendes a un compañero?')
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(11)
    choose('9')
    await click('Siguiente')
    await click('Saltar')

    expect(heading()).toBe('¿Qué fue lo más confuso o molesto?')
    write('  El temporizador  ')
    await click('Siguiente')
    expect(progress()).toBe('Pregunta 15 de 15')
    await click('Enviar')

    expect(state.submit).toHaveBeenCalledWith({
      studentId: 's1',
      answers: {
        start_ease: 4, diagnostic_fit: 3, today_clarity: 5, help_useful: 'na', saber_likeness: 4, helps_improve: 5,
        come_back: ['racha', 'xp'], device: 'celular_propio', disappointment: 'muy', recommend: 9,
        confusing: 'El temporizador',
      },
    })
    expect(heading()).toBe('Gracias por contarnos')
    expect(container.querySelector('a.btn-primary')?.getAttribute('href')).toBe('/today')
  })

  it('unticking every option of a multiple choice leaves it unanswered', async () => {
    render()
    for (let index = 0; index < 6; index += 1) {
      choose(index === 3 ? 'No lo usé' : '3')
      await click('Siguiente')
    }
    choose('La liga')
    expect(hasButton('Siguiente')).toBe(true)
    choose('La liga')
    expect(hasButton('Saltar')).toBe(true)
  })

  it('stays on the last question and says why when sending fails', async () => {
    state.submit = vi.fn(async () => {
      throw new Error('x')
    })
    render()
    for (let index = 0; index < 6; index += 1) {
      choose(index === 3 ? 'No lo usé' : '3')
      await click('Siguiente')
    }
    for (let index = 6; index < 14; index += 1) await click('Saltar')
    await click('Enviar')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('No pudimos enviar')
    expect(progress()).toBe('Pregunta 15 de 15')
  })
})

describe('pilotSurveyCsv', () => {
  it('has one row per response and one column per question, in words', () => {
    const csv = pilotSurveyCsv([
      { submittedAt: Date.UTC(2026, 10, 11, 15), answers: { start_ease: 4, help_useful: 'na', come_back: ['racha', 'xp'], device: 'celular_propio', confusing: 'Dice "hola", y ya' } },
      { submittedAt: Date.UTC(2026, 10, 12, 15), answers: { recommend: 0, change: '=1+1' } },
    ])
    const [header, first, second] = csv.replace(/^﻿/, '').split('\r\n')
    expect(header?.startsWith('Fecha,1. ¿Qué tan fácil fue empezar a usar Aprendo?,')).toBe(true)
    expect(header).toContain('"3. Al abrir ""Hoy"", ¿tenías claro qué hacer?"')
    expect(header).toContain('15. ¿Qué le cambiarías o agregarías?')
    expect(first).toContain('2026-11-11')
    expect(first).toContain(',4,,,No lo usé,,,La racha; El XP,,Celular propio,')
    expect(first).toContain('"Dice ""hola"", y ya"')
    // A cell that a spreadsheet would run as a formula is kept as text.
    expect(second).toContain(`'=1+1`)
    expect(second?.split(',')).toHaveLength(1 + PILOT_SURVEY_QUESTIONS.length)
  })
})
