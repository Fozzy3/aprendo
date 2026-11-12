// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { summarizeSurvey } from '@aprendo/convex/pilotSurveyQuestions'

const state = vi.hoisted(() => ({ queries: {} as Record<string, unknown> }))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => ({ queryKey: [getFunctionName(ref), args] }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: [string] }) => state.queries[options.queryKey[0]] ?? { isPending: true, data: undefined },
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const funnel = {
  steps: [
    { key: 'signedUp', count: 20 },
    { key: 'consented', count: 18 },
    { key: 'onboarded', count: 15 },
    { key: 'diagnosed', count: 10 },
    { key: 'practiced', count: 8 },
    { key: 'active2Days', count: 6 },
    { key: 'active7Days', count: 2 },
  ],
  d1Return: { eligible: 10, returned: 4, rate: 0.4 },
  d7Return: { eligible: 0, returned: 0, rate: null },
  reminders: { sent: 12, clicked: 3 },
}

const engagement = {
  day7Return: { eligible: 4, returned: 1, rate: 0.25 },
  weeklySessions: [{ weekStartMs: Date.UTC(2026, 10, 9, 5), sessions: 30, activeStudents: 12, sessionsPerActiveStudent: 2.5 }],
  classes: [{
    classGroupId: 'c1', name: '11A', organizationName: 'Piloto', schoolLeagueEnabled: true, classLeagueOff: false,
    studentCount: 20, bottomQuartile: { recent: 0.5, previous: 1 },
  }],
}

const REQUIRED = { start_ease: 4, diagnostic_fit: 3, today_clarity: 5, help_useful: 'na', saber_likeness: 4, helps_improve: 5 }
const responses = [
  { submittedAt: Date.UTC(2026, 10, 10, 15), answers: { ...REQUIRED, recommend: 10, disappointment: 'muy', come_back: ['racha', 'xp'], confusing: 'El temporizador' } },
  { submittedAt: Date.UTC(2026, 10, 11, 15), answers: { ...REQUIRED, recommend: 9, disappointment: 'muy', come_back: ['racha'], confusing: 'Los simulacros' } },
  { submittedAt: Date.UTC(2026, 10, 12, 15), answers: { ...REQUIRED, recommend: 3, disappointment: 'igual' } },
]

let container: HTMLElement
let root: Root

beforeEach(() => {
  state.queries = {
    'measurement:getPilotFunnel': { isPending: false, data: funnel },
    'measurement:getEngagementMetrics': { isPending: false, data: engagement },
    'pilotSurvey:summary': { isPending: false, data: summarizeSurvey(responses) },
    'pilotSurvey:listResponses': { isPending: false, data: responses },
  }
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function renderPanel() {
  const { PilotPanel } = await import('../components/admin/PilotPanel.tsx')
  await act(async () => {
    root.render(<PilotPanel />)
  })
}

const rowText = (label: string) =>
  [...container.querySelectorAll('tr')].find((row) => row.textContent?.includes(label))?.textContent ?? ''

describe('PilotPanel', () => {
  it('shows each funnel step with its count and its share of sign-ups', async () => {
    await renderPanel()
    expect(container.querySelector('h1')?.textContent).toBe('Piloto')
    expect(rowText('Se registraron')).toContain('20')
    expect(rowText('Se registraron')).toContain('100 %')
    expect(rowText('Hicieron el diagnóstico')).toContain('10')
    expect(rowText('Hicieron el diagnóstico')).toContain('50 %')
    expect(rowText('Activos 7 días')).toContain('10 %')
  })

  it('shows return, reminders and the engagement metrics', async () => {
    await renderPanel()
    expect(rowText('Al día siguiente')).toContain('4 de 10')
    expect(rowText('A los 7 días')).toContain('Aún nadie')
    expect(container.textContent).toContain('12 enviados')
    expect(container.textContent).toContain('3 abiertos')
    expect(rowText('11A')).toContain('Piloto')
    expect(container.textContent).toContain('30')
  })

  it('sums up the survey: NPS, Sean Ellis, means, counts and every free text', async () => {
    await renderPanel()
    const survey = container.querySelector('[aria-labelledby="pilot-survey-title"]')!
    expect(survey.querySelector('h2')?.textContent).toBe('Encuesta')
    expect(survey.textContent).toContain('3 respuestas')
    // 2 promoters (10, 9) and 1 detractor (3) of 3.
    expect(survey.textContent).toContain('NPS: 33')
    expect(survey.textContent).toContain('Muy decepcionados (Sean Ellis): 67 %')
    expect(survey.textContent).toContain('Promedio: 4.0')
    expect(rowText('La racha')).toContain('2')
    expect(survey.textContent).toContain('El temporizador')
    expect(survey.textContent).toContain('Los simulacros')
  })

  it('downloads the raw responses as a CSV', async () => {
    let blob: Blob | null = null
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (value: Blob) => ((blob = value), 'blob:x'), revokeObjectURL: () => {} }))
    await renderPanel()
    const button = [...container.querySelectorAll('button')].find((element) => element.textContent === 'Descargar CSV')!
    await act(async () => button.click())
    expect(click).toHaveBeenCalledOnce()
    expect((click.mock.contexts[0] as HTMLAnchorElement | undefined)?.download).toMatch(/^aprendo-encuesta-\d{4}-\d{2}-\d{2}\.csv$/)
    const csv = await blob!.text()
    expect(csv.split('\r\n')).toHaveLength(4)
    expect(csv).toContain('La racha; El XP')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('says so when nobody has answered the survey yet', async () => {
    state.queries['pilotSurvey:summary'] = { isPending: false, data: summarizeSurvey([]) }
    state.queries['pilotSurvey:listResponses'] = { isPending: false, data: [] }
    await renderPanel()
    const survey = container.querySelector('[aria-labelledby="pilot-survey-title"]')!
    expect(survey.textContent).toContain('Todavía nadie ha respondido la encuesta')
    expect([...survey.querySelectorAll('button')].some((element) => element.textContent === 'Descargar CSV')).toBe(false)
  })

  it('waits for the data before drawing', async () => {
    state.queries = {}
    await renderPanel()
    expect(container.querySelector('table')).toBeNull()
  })
})
