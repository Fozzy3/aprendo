// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RewardScreen } from '../components/RewardScreen.tsx'
import { LessonSteps } from '../components/LessonSteps.tsx'

const speech = vi.hoisted(() => ({ speak: vi.fn(), stopSpeaking: vi.fn(), canSpeak: vi.fn(() => true) }))

vi.mock('lucide-react', () =>
  new Proxy({}, { has: () => true, get: (_, name) => (name === 'then' ? undefined : () => null) }))
vi.mock('motion/react', () => ({
  animate: vi.fn(),
  useReducedMotion: () => true,
  motion: { li: ({ children }: { children: ReactNode }) => <li>{children}</li> },
}))
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

const REWARD = { xp: 50, medals: ['primera_sesion'], streakDays: 6 }

function renderReward(reward: typeof REWARD | null) {
  act(() =>
    root.render(
      <RewardScreen
        studentId="s"
        subjectId="matematicas"
        reward={reward}
        changes={[{ subtopicId: 'matematicas.functions_variation.functions_graphs', from: 'intentado', to: 'familiar' }]}
        correctCount={3}
        questionCount={5}
        isFresh={false}
      >
        <button type="button">Seguir</button>
      </RewardScreen>,
    ),
  )
}

describe('RewardScreen', () => {
  it('reads XP, streak, medal, mastery, and the score last', () => {
    renderReward(REWARD)
    const text = container.textContent ?? ''
    const order = ['50', 'días', 'Primera sesión', 'Funciones y gráficas', '3 de 5'].map((piece) => text.indexOf(piece))
    expect(order.every((position) => position >= 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
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

  it('has no "Siguiente" on the last step', () => {
    click('Ver por qué')
    click('Siguiente')
    click('Ver por qué')
    expect(button('Siguiente')).toBeUndefined()
  })
})
