import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BUILDER,
  availableLabel,
  builderFilters,
  builderSessionArgs,
  builderStatus,
  selectSubject,
  subtopicsForSubject,
  toggleSubtopic,
} from '../lib/practice-builder'

const ready = { available: 40, error: null }

describe('builder filters', () => {
  it('sends only what the student narrowed', () => {
    expect(builderFilters(DEFAULT_BUILDER)).toEqual({ source: 'todas' })
  })

  // No difficulty: choosing "fácil" buys an illusion of mastery, and Elo already adapts (F33).
  it('sends area, subtopics and source once chosen', () => {
    const state = toggleSubtopic(
      selectSubject({ ...DEFAULT_BUILDER, source: 'falladas' }, 'matematicas'),
      'matematicas.algebra_equations.equations_inequalities',
    )
    expect(builderFilters(state)).toEqual({
      subjectId: 'matematicas',
      subtopicIds: ['matematicas.algebra_equations.equations_inequalities'],
      source: 'falladas',
    })
  })

  it('builds a personalizada session with the count, clock and feedback mode', () => {
    const state = { ...DEFAULT_BUILDER, count: 20, timed: true, feedbackMode: 'al_final' as const }
    expect(builderSessionArgs(state)).toEqual({
      kind: 'personalizada',
      feedbackMode: 'al_final',
      practice: { source: 'todas', count: 20, timed: true },
    })
  })
})

describe('picking subtopics', () => {
  it('changing the area drops the subtopics of the old one', () => {
    const withMath = toggleSubtopic(selectSubject(DEFAULT_BUILDER, 'matematicas'), 'm.1')
    expect(selectSubject(withMath, 'ingles').subtopicIds).toEqual([])
    expect(selectSubject(withMath, 'matematicas').subtopicIds).toEqual(['m.1'])
  })

  it('toggles a subtopic on and off', () => {
    const on = toggleSubtopic(DEFAULT_BUILDER, 'm.1')
    expect(on.subtopicIds).toEqual(['m.1'])
    expect(toggleSubtopic(on, 'm.1').subtopicIds).toEqual([])
  })

  it('lists the subtopics of an area from the taxonomy, none for all areas', () => {
    const math = subtopicsForSubject('matematicas')
    expect(math.length).toBeGreaterThan(3)
    expect(math[0]).toEqual({ id: expect.stringMatching(/^matematicas\./), label: expect.any(String) })
    expect(subtopicsForSubject(null)).toEqual([])
  })
})

describe('builder status', () => {
  it('waits for the count before allowing a start', () => {
    expect(builderStatus(DEFAULT_BUILDER, undefined)).toEqual({ canStart: false, message: null })
  })

  it('starts when there are enough questions', () => {
    expect(builderStatus(DEFAULT_BUILDER, ready)).toEqual({ canStart: true, message: null })
  })

  it('shows a filter error from the server', () => {
    expect(builderStatus(DEFAULT_BUILDER, { available: 0, error: 'Selecciona subtemas válidos.' }))
      .toEqual({ canStart: false, message: 'Selecciona subtemas válidos.' })
  })

  it('explains an empty source in its own terms', () => {
    const empty = { available: 0, error: null }
    expect(builderStatus({ ...DEFAULT_BUILDER, source: 'falladas' }, empty).message)
      .toMatch(/no has fallado/i)
    expect(builderStatus({ ...DEFAULT_BUILDER, source: 'marcadas' }, empty).message)
      .toMatch(/no has marcado/i)
    expect(builderStatus({ ...DEFAULT_BUILDER, source: 'no_vistas' }, empty).message)
      .toMatch(/ya viste todas/i)
    expect(builderStatus(DEFAULT_BUILDER, empty).message).toMatch(/no hay preguntas/i)
    expect(builderStatus(DEFAULT_BUILDER, empty).canStart).toBe(false)
  })

  it('asks for fewer questions when the filters leave fewer than chosen', () => {
    const status = builderStatus({ ...DEFAULT_BUILDER, count: 20 }, { available: 12, error: null })
    expect(status.canStart).toBe(false)
    expect(status.message).toMatch(/solo hay 12 preguntas/i)
  })

  it('says the minimum when even the smallest practice does not fit', () => {
    const status = builderStatus({ ...DEFAULT_BUILDER, count: 5 }, { available: 3, error: null })
    expect(status.canStart).toBe(false)
    expect(status.message).toMatch(/al menos 5/)
  })
})

describe('availableLabel', () => {
  it('agrees in number', () => {
    expect(availableLabel(1)).toBe('1 pregunta disponible')
    expect(availableLabel(0)).toBe('0 preguntas disponibles')
    expect(availableLabel(24)).toBe('24 preguntas disponibles')
  })
})
