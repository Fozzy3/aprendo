// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RewardScreen } from '../components/RewardScreen.tsx'
import { LessonSteps } from '../components/LessonSteps.tsx'

const speech = vi.hoisted(() => ({ speak: vi.fn(), stopSpeaking: vi.fn(), canSpeak: vi.fn(() => true) }))

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
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }))
vi.mock('@convex-dev/react-query', () => ({ convexQuery: (_: unknown, args: unknown) => ({ queryKey: [args] }) }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }))
vi.mock('../components/MarkdownBlock.tsx', () => ({ MarkdownBlock: ({ markdown }: { markdown: string }) => <p>{markdown}</p> }))
vi.mock('../lib/speech.ts', () => speech)
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  speech.speak.mockClear()
  speech.stopSpeaking.mockClear()
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const REWARD: { xp: number; medals: string[]; streakDays: number; previousStreakDays?: number; shieldEarned?: boolean } =
  { xp: 50, medals: ['primera_sesion'], streakDays: 6 }

function renderReward(reward: typeof REWARD | null, isFresh = false) {
  act(() =>
    root.render(
      <RewardScreen
        studentId="s"
        subjectId="matematicas"
        reward={reward}
        changes={[{ subtopicId: 'matematicas.functions_variation.functions_graphs', from: 'intentado', to: 'familiar' }]}
        correctCount={3}
        questionCount={5}
        isFresh={isFresh}
      >
        <button type="button">Seguir</button>
      </RewardScreen>,
    ),
  )
}

describe('RewardScreen', () => {
  it('reads the score first, then how each topic moved, then XP, streak and medal', () => {
    renderReward(REWARD)
    const text = container.textContent ?? ''
    const order = ['3 de 5', 'Tus temas', '50 XP', 'días', 'Primera sesión'].map((piece) => text.indexOf(piece))
    expect(order.every((position) => position >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(container.querySelector('.sticker')).toBeNull()
  })

  it('heads with the topic that went up when one did', () => {
    renderReward(REWARD)
    expect(container.querySelector('h1')?.textContent).toBe('Subiste a Familiar en Funciones y gráficas')
  })

  it('heads with the score when nothing went up', () => {
    act(() =>
      root.render(
        <RewardScreen studentId="s" subjectId={null} reward={null} changes={[]} correctCount={3} questionCount={5} isFresh={false}>
          <button type="button">Seguir</button>
        </RewardScreen>,
      ),
    )
    expect(container.querySelector('h1')?.textContent).toBe('3 de 5 correctas')
  })

  it('shows no XP on an old session without a reward', () => {
    renderReward(null)
    expect(container.textContent).not.toContain('XP')
    expect(container.textContent).toContain('3 de 5')
  })

  it('replaces the score with the note while a school test is sealed', () => {
    act(() =>
      root.render(
        <RewardScreen studentId="s" subjectId={null} reward={REWARD} changes={[]} correctCount={0} questionCount={5} isFresh={false} sealedNote="Tus resultados llegan al cerrar la prueba.">
          <button type="button">Seguir</button>
        </RewardScreen>,
      ),
    )
    expect(container.textContent).toContain('Tus resultados llegan al cerrar la prueba.')
    expect(container.textContent).not.toContain('correctas')
  })

  it('celebrates the first day without pretending it is a streak', () => {
    renderReward({ ...REWARD, streakDays: 1 })
    expect(container.textContent).toContain('Empezaste tu racha')
  })

  describe('the streak', () => {
    afterEach(() => vi.useRealTimers())

    it('ticks up on the day’s first session, on a fresh close', () => {
      vi.useFakeTimers()
      renderReward({ ...REWARD, streakDays: 5, previousStreakDays: 4 }, true)
      expect(container.querySelector('.reward-gains')?.textContent).toContain('Racha de 4 días')
      act(() => vi.runAllTimers())
      expect(container.querySelector('.reward-gains')?.textContent).toContain('Racha de 5 días')
    })

    it('stays put on a later session or a revisit', () => {
      vi.useFakeTimers()
      renderReward({ ...REWARD, streakDays: 5, previousStreakDays: 5 }, true)
      expect(container.querySelector('.reward-gains')?.textContent).toContain('Racha de 5 días')
      renderReward({ ...REWARD, streakDays: 5, previousStreakDays: 4 }, false)
      expect(container.querySelector('.reward-gains')?.textContent).toContain('Racha de 5 días')
    })

    it('gives 3, 7, 14 and 30 days a moment of their own', () => {
      renderReward({ ...REWARD, streakDays: 7, previousStreakDays: 6 }, true)
      const moment = container.querySelector('.streak-moment')
      expect(moment?.textContent).toContain('7')
      expect(moment?.textContent).toContain('días seguidos')
    })

    it('no moment for any other day, or on a revisit', () => {
      renderReward({ ...REWARD, streakDays: 8, previousStreakDays: 7 }, true)
      expect(container.querySelector('.streak-moment')).toBeNull()
      renderReward({ ...REWARD, streakDays: 7, previousStreakDays: 6 }, false)
      expect(container.querySelector('.streak-moment')).toBeNull()
    })

    it('says so when the session earned a shield', () => {
      renderReward({ ...REWARD, shieldEarned: true })
      expect(container.querySelector('.reward-gains')?.textContent).toContain('escudo de racha')
      renderReward({ ...REWARD, shieldEarned: false })
      expect(container.querySelector('.reward-gains')?.textContent).not.toContain('escudo')
    })
  })
})

describe('LessonSteps', () => {
  const STEPS = [
    { predict: '¿Qué pasa si duplicas?', reveal: 'Se duplica también.' },
    { predict: '¿Y si divides?', reveal: 'Se reduce igual.' },
  ]
  const button = (name: string) => [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(name))
  const click = (name: string) => act(() => button(name)!.click())

  beforeEach(() => {
    act(() => root.render(<LessonSteps steps={STEPS} />))
  })

  it('asks before it shows', () => {
    expect(container.textContent).toContain('¿Qué pasa si duplicas?')
    expect(container.textContent).not.toContain('Se duplica también.')
    click('Ver por qué')
    expect(container.textContent).toContain('Se duplica también.')
  })

  it('walks to the next step, hiding its reveal again', () => {
    click('Ver por qué')
    click('Siguiente')
    expect(container.textContent).toContain('¿Y si divides?')
    expect(container.textContent).not.toContain('Se reduce igual.')
  })

  it('reads aloud what is on screen, and stops on a step change', () => {
    click('Escuchar')
    expect(speech.speak).toHaveBeenCalledWith('¿Qué pasa si duplicas?')
    click('Ver por qué')
    click('Escuchar')
    expect(speech.speak).toHaveBeenLastCalledWith('¿Qué pasa si duplicas? Se duplica también.')
    speech.stopSpeaking.mockClear()
    click('Siguiente')
    expect(speech.stopSpeaking).toHaveBeenCalled()
  })

  it('names the step it is on, to assistive tech only', () => {
    expect(container.querySelector('.lesson-step')?.getAttribute('aria-label')).toBe('Paso 1 de 2')
    expect(container.textContent).not.toContain('Paso 1 de 2')
  })

  it('has no "Siguiente" on the last step, and points to practice instead', () => {
    click('Ver por qué')
    click('Siguiente')
    click('Ver por qué')
    expect(button('Siguiente')).toBeUndefined()
    expect(container.querySelector('a[href="#practica"]')?.textContent).toContain('Practicar este tema')
  })
})
