import taxonomyContract from '../../../../docs/taxonomy.v1.json'
import {
  MIN_PRACTICE_QUESTIONS,
  type PracticeSource,
} from '@aprendo/convex/practiceBuilder'
import type { FeedbackMode } from '@aprendo/convex/sessionKinds'

/** "Arma tu práctica": what the student has chosen so far. */
export type BuilderState = {
  subjectId: string | null
  subtopicIds: string[]
  source: PracticeSource
  count: number
  timed: boolean
  feedbackMode: FeedbackMode
}

export const DEFAULT_BUILDER: BuilderState = {
  subjectId: null,
  subtopicIds: [],
  source: 'todas',
  count: 10,
  timed: false,
  // A practice you build yourself is for learning: see each answer as you go.
  feedbackMode: 'inmediata',
}

export const COUNT_OPTIONS = [5, 10, 20, 30] as const

export const SOURCE_LABELS: Record<PracticeSource, string> = {
  todas: 'Todas',
  no_vistas: 'No vistas',
  falladas: 'Falladas',
  marcadas: 'Marcadas',
}

export function selectSubject(state: BuilderState, subjectId: string | null): BuilderState {
  if (subjectId === state.subjectId) return state
  return { ...state, subjectId, subtopicIds: [] }
}

export function toggleSubtopic(state: BuilderState, subtopicId: string): BuilderState {
  const subtopicIds = state.subtopicIds.includes(subtopicId)
    ? state.subtopicIds.filter((id) => id !== subtopicId)
    : [...state.subtopicIds, subtopicId]
  return { ...state, subtopicIds }
}

/** The filters `getPracticeBuilderCounts` and `createSession` take: only what was narrowed. */
export function builderFilters(state: BuilderState) {
  return {
    ...(state.subjectId != null ? { subjectId: state.subjectId } : {}),
    ...(state.subtopicIds.length > 0 ? { subtopicIds: state.subtopicIds } : {}),
    source: state.source,
  }
}

export function builderSessionArgs(state: BuilderState) {
  return {
    kind: 'personalizada' as const,
    feedbackMode: state.feedbackMode,
    practice: { ...builderFilters(state), count: state.count, timed: state.timed },
  }
}

const EMPTY_SOURCE_MESSAGE: Record<PracticeSource, string> = {
  todas: 'No hay preguntas con estos filtros. Prueba con otra área o dificultad.',
  no_vistas: 'Ya viste todas las preguntas con estos filtros. Elige «Todas» para repetirlas.',
  falladas: 'No has fallado preguntas con estos filtros. Prueba con otros.',
  marcadas: 'No has marcado preguntas con estos filtros. Márcalas con la bandera mientras resuelves.',
}

/**
 * Whether "Empezar" can go ahead, and the sentence that says why not. Loading
 * counts says nothing: the button just waits.
 */
export function builderStatus(
  state: BuilderState,
  counts: { available: number; error: string | null } | undefined,
): { canStart: boolean; message: string | null } {
  if (counts == null) return { canStart: false, message: null }
  if (counts.error != null) return { canStart: false, message: counts.error }
  const { available } = counts
  if (available === 0) return { canStart: false, message: EMPTY_SOURCE_MESSAGE[state.source] }
  if (available < MIN_PRACTICE_QUESTIONS) {
    return {
      canStart: false,
      message: `Solo hay ${available} con estos filtros y una práctica necesita al menos ${MIN_PRACTICE_QUESTIONS}. Amplía los filtros.`,
    }
  }
  if (available < state.count) {
    return {
      canStart: false,
      message: `Solo hay ${available} preguntas con estos filtros: elige menos o cambia los filtros.`,
    }
  }
  return { canStart: true, message: null }
}

export function availableLabel(available: number): string {
  return available === 1 ? '1 pregunta disponible' : `${available} preguntas disponibles`
}

/** An area's subtopics in syllabus order; none when every area is in play. */
export function subtopicsForSubject(subjectId: string | null): { id: string; label: string }[] {
  const subject = taxonomyContract.subjects.find((item) => item.id === subjectId)
  if (subject == null) return []
  return subject.categories.flatMap((category) =>
    category.subtopics.map((subtopic) => ({ id: subtopic.id, label: subtopic.label_es })))
}
