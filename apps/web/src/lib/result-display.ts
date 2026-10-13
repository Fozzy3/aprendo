import { estimatedScoreFromAccuracy, getLevelForScore } from '@aprendo/convex/levels'
import type { SessionKind } from '@aprendo/convex/sessionKinds'
import { getSubjectLabel } from '@aprendo/convex/taxonomy'

/**
 * The kinds that open on a result screen before the per-question review: the
 * two moments a student finds out where they stand.
 */
export function hasResultScreen(kind: SessionKind): boolean {
  return kind === 'nivelacion' || kind === 'simulacro'
}

/** A question time as the exam clock reads it: "2:15". */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** A change in points, always signed so it reads as a change: "+7", "−3", "±0". */
export function formatSignedPoints(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `−${Math.abs(delta)}`
  return '±0'
}

type SubtopicTally = { subtopicId: string; correctCount: number; questionCount: number }

/**
 * The one subtopic "Practicar lo que fallaste" should open: the weakest with at
 * least one miss across every area, more misses first at equal accuracy (the
 * same order the report lists them in). Null when nothing was missed.
 */
export function pickPracticeSubtopic(
  areas: { subjectId: string; subtopics: SubtopicTally[] }[],
): { subjectId: string; subtopicId: string } | null {
  let best: { subjectId: string; tally: SubtopicTally } | null = null
  for (const area of areas) {
    for (const tally of area.subtopics) {
      if (tally.correctCount >= tally.questionCount) continue
      if (best == null || isWeaker(tally, best.tally)) best = { subjectId: area.subjectId, tally }
    }
  }
  return best == null ? null : { subjectId: best.subjectId, subtopicId: best.tally.subtopicId }
}

function isWeaker(a: SubtopicTally, b: SubtopicTally): boolean {
  const accuracyA = a.correctCount / a.questionCount
  const accuracyB = b.correctCount / b.questionCount
  if (accuracyA !== accuracyB) return accuracyA < accuracyB
  return a.questionCount - a.correctCount > b.questionCount - b.correctCount
}

type NivelacionRow = {
  _id: string
  kind: string
  status: string
  subjectId?: string
  startedAt: number
  summary?: { accuracy: number } | null
}

/**
 * The level the student held in this area before this nivelación: the last
 * completed one of the same area, placed with the same formula the result uses.
 * Null on the area's first nivelación.
 */
export function previousPlacementIndex(
  sessions: NivelacionRow[],
  current: { _id: string; subjectId: string; startedAt: number },
): number | null {
  const previous = sessions
    .filter((session) =>
      session._id !== current._id
      && session.kind === 'nivelacion'
      && session.status === 'completed'
      && session.subjectId === current.subjectId
      && session.startedAt < current.startedAt
      && session.summary != null)
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (previous?.summary == null) return null
  const score = estimatedScoreFromAccuracy(previous.summary.accuracy)
  return getLevelForScore(current.subjectId, score)?.index ?? null
}

/**
 * Whether Nico shows up. Only at a real threshold: the first placement (it is
 * what unlocks the app, preliminary or not) or a level up the evidence backs.
 * Never for a score the student did not earn.
 */
export function celebrationFor(args: {
  isFirstPlacement: boolean
  hasEnoughEvidence: boolean
  levelIndex: number | null
  previousIndex: number | null
}): 'first' | 'level_up' | null {
  if (args.isFirstPlacement) return 'first'
  if (
    args.hasEnoughEvidence
    && args.levelIndex != null
    && args.previousIndex != null
    && args.levelIndex > args.previousIndex
  ) {
    return 'level_up'
  }
  return null
}

/**
 * Why a simulacro has no 0-500 estimate. The missing sitting comes first: it is
 * the gap the student can close; an area the bank could not serve is ours.
 */
export function simulacroGapMessage(report: {
  missingSessionNumbers: number[]
  missingSubjectIds: string[]
}): string | null {
  const sessionNumber = report.missingSessionNumbers[0]
  if (sessionNumber != null) {
    return `Te falta la Sesión ${sessionNumber} para calcular tu puntaje global de 0 a 500.`
  }
  if (report.missingSubjectIds.length === 0) return null
  const labels = report.missingSubjectIds.map(getSubjectLabel)
  const list = labels.length === 1
    ? labels[0]
    : `${labels.slice(0, -1).join(', ')} ni ${labels[labels.length - 1]}`
  return `Este simulacro no incluyó ${list}, así que no hay puntaje global de 0 a 500.`
}
