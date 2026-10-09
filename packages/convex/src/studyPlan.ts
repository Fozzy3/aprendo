import { DEFAULT_SESSIONS_PER_WEEK } from './examPlan'
import { SUBJECT_WEIGHTS } from './globalScore'
import { MASTERY_LEVEL_LABELS, RETO_SUBTOPIC_COUNT, masteryLevelOf, type MasteryLevel } from './mastery'
import { SESSION_KIND_CONFIG, type SessionKind } from './sessionKinds'
import { getSubjectLabel, getSubtopicLabel } from './taxonomy'

/**
 * "Tu plan de hoy": two to four things to do today, derived — no stored plan.
 *
 * The sequence follows what the SAT world converged on (Khan, College Board,
 * Magoosh): measure first (nivelación, then a baseline simulacro), work the weak
 * areas where points pay, break each weak block with a quick win, retest about
 * once a month, and keep the last days before the exam light.
 *
 * "Where points pay" is the official weighting: a point in a ×3 area is worth
 * three in Inglés, and a low area level has more room to grow. Pure, so
 * `today.ts` feeds it and the tests pin every rule.
 */

/** Days between simulacros: Khan's "a practice test about once a month". */
export const RETEST_INTERVAL_DAYS = 28
/** The exam day and the two before it get nothing heavy. */
export const LIGHT_DAYS_BEFORE_EXAM = 2

const MAX_TASKS = 4
const MIN_TASKS = 2
/** Untimed practice, answer review included. */
const MINUTES_PER_PRACTICE_QUESTION = 2
const LESSON_MINUTES = 10

export interface StudyPlanInput {
  /** Colombia day number (`colombiaDayNumber`). */
  today: number
  examDay: number | null
  areas: { subjectId: string; score: number | null; hasEnoughEvidence: boolean; isPlaced: boolean }[]
  /** Subtopic aggregates; `masteryLevelOf` covers those without a level yet. */
  subtopics: {
    subtopicId: string
    subjectId: string
    masteryScore: number
    attemptCount: number
    correctCount: number
    masteryLevel?: MasteryLevel
  }[]
  /**
   * Subtopics a topic session can serve. Those without an aggregate are
   * `sin_empezar`: the plan works every subtopic, not only the ones the
   * nivelación happened to ask.
   */
  launchableSubtopics: { subtopicId: string; subjectId: string }[]
  reviewDueCount: number
  /** Completed simulacro sittings (Sesión 1 or 2), by Colombia day. */
  simulacroSittings: { day: number; sessionNumber: number }[]
  weeklyGoalMinutes: number
}

export type StudyTaskKind = 'lesson' | 'practice' | 'repaso' | 'reto' | 'simulacro' | 'nivelacion'

/** What the web launches: a lesson route, or `createSession` with these args. */
export type StudyTaskAction =
  | { type: 'lesson'; subtopicId: string }
  | {
      type: 'session'
      kind: SessionKind
      subjectId?: string
      subtopicId?: string
      simulacroSessionNumber?: number
    }

export interface StudyTask {
  id: string
  kind: StudyTaskKind
  title: string
  reason: string
  minutes: number
  /** A nearly mastered subtopic placed between weak blocks. */
  quickWin?: boolean
  action: StudyTaskAction
}

function practiceMinutes(questionCount: number) {
  return questionCount * MINUTES_PER_PRACTICE_QUESTION
}

const TOPIC_MINUTES = practiceMinutes(SESSION_KIND_CONFIG.topic.totalQuestions ?? 10)

export function buildStudyPlan(input: StudyPlanInput): { tasks: StudyTask[] } {
  const areaScore = new Map(input.areas.map((area) => [area.subjectId, area.score]))
  // Global points within reach: area weight × room left in the area × room
  // left in the subtopic. An unmeasured area counts as halfway.
  const areaRoom = (subjectId: string) => {
    const score = areaScore.get(subjectId)
    return 1 - (score ?? 50) / 100
  }
  const weight = (subjectId: string) => SUBJECT_WEIGHTS[subjectId] ?? 0

  const measured = new Set(input.subtopics.map((subtopic) => subtopic.subtopicId))
  const unstarted = input.launchableSubtopics
    .filter((subtopic) => !measured.has(subtopic.subtopicId))
    .map((subtopic) => ({ ...subtopic, masteryScore: 0, attemptCount: 0, correctCount: 0 }))

  const ranked = [...input.subtopics, ...unstarted]
    .map((subtopic) => ({
      ...subtopic,
      level: masteryLevelOf(subtopic),
      gain: weight(subtopic.subjectId) * areaRoom(subtopic.subjectId) * (1 - subtopic.masteryScore),
    }))
    .sort((a, b) => b.gain - a.gain)

  const main = ranked.find((subtopic) => subtopic.level !== 'competente' && subtopic.level !== 'dominado')
  // The familiar subtopic nearest Competente, whatever its gain.
  const quickWin = ranked
    .filter((subtopic) => subtopic.level === 'familiar' && subtopic !== main)
    .sort((a, b) => b.masteryScore - a.masteryScore)[0]

  const quickWinTask: StudyTask | null =
    quickWin == null
      ? null
      : {
          id: `practice:${quickWin.subtopicId}`,
          kind: 'practice',
          quickWin: true,
          title: `Victoria rápida: ${getSubtopicLabel(quickWin.subtopicId)}`,
          reason: `Estás a un paso de ${MASTERY_LEVEL_LABELS.competente} en ${getSubtopicLabel(quickWin.subtopicId)}.`,
          minutes: TOPIC_MINUTES,
          action: { type: 'session', kind: 'topic', subtopicId: quickWin.subtopicId },
        }

  const reviewQuestions = Math.min(input.reviewDueCount, SESSION_KIND_CONFIG.repaso.totalQuestions ?? 10)
  const repasoTask: StudyTask | null =
    input.reviewDueCount <= 0
      ? null
      : {
          id: 'repaso',
          kind: 'repaso',
          title: 'Repaso de errores',
          reason:
            input.reviewDueCount === 1
              ? 'Tienes 1 pregunta que fallaste esperando repaso.'
              : `Tienes ${input.reviewDueCount} preguntas que fallaste esperando repaso.`,
          minutes: practiceMinutes(reviewQuestions),
          action: { type: 'session', kind: 'repaso' },
        }

  const daysToExam = input.examDay == null ? null : input.examDay - input.today
  if (daysToExam != null && daysToExam >= 0 && daysToExam <= LIGHT_DAYS_BEFORE_EXAM) {
    return { tasks: [repasoTask, quickWinTask].filter((task) => task != null) }
  }

  const pendingArea = input.areas
    .filter((area) => !area.isPlaced && !area.hasEnoughEvidence)
    .sort((a, b) => weight(b.subjectId) - weight(a.subjectId))[0]

  const lastSitting = (sessionNumber: number) => {
    const days = input.simulacroSittings
      .filter((sitting) => sitting.sessionNumber === sessionNumber)
      .map((sitting) => sitting.day)
    return days.length === 0 ? null : Math.max(...days)
  }
  const simulacroTask = (sessionNumber: number, reason: string): StudyTask => ({
    id: 'simulacro',
    kind: 'simulacro',
    title: `Simulacro · Sesión ${sessionNumber}`,
    reason,
    minutes: (SESSION_KIND_CONFIG.simulacro.simulacroSessions?.[sessionNumber - 1]?.timeLimitMs ?? 0) / 60_000,
    action: { type: 'session', kind: 'simulacro', simulacroSessionNumber: sessionNumber },
  })

  let simulacro: StudyTask | null = null
  if (pendingArea == null) {
    const sesion1 = lastSitting(1)
    const sesion2 = lastSitting(2)
    if (sesion1 != null && (sesion2 == null || sesion2 < sesion1)) {
      // Half a simulacro, without Inglés. Sesión 2 on another day, like the exam.
      if (input.today > sesion1) {
        simulacro = simulacroTask(2, 'Ya hiciste la Sesión 1. La Sesión 2 trae Inglés y completa tu puntaje global.')
      }
    } else {
      // Only both sittings make a simulacro; Sesión 2 dates it.
      const daysSince = sesion1 == null || sesion2 == null ? null : input.today - sesion2
      if (daysSince == null || daysSince >= RETEST_INTERVAL_DAYS) {
        simulacro = simulacroTask(
          1,
          daysSince == null
            ? 'Tu punto de partida: un simulacro completo te da el puntaje global de referencia.'
            : `Han pasado ${daysSince} días desde tu último simulacro: mide cuánto has avanzado.`,
        )
      }
    }
  }

  const candidates: StudyTask[] = []

  if (pendingArea != null) {
    const label = getSubjectLabel(pendingArea.subjectId)
    candidates.push({
      id: `nivelacion:${pendingArea.subjectId}`,
      kind: 'nivelacion',
      title: `Nivelación de ${label}`,
      reason: `Aún no tienes nivel en ${label}. Sin él no hay puntaje global.`,
      minutes: (SESSION_KIND_CONFIG.nivelacion.timeLimitMs ?? 0) / 60_000,
      action: { type: 'session', kind: 'nivelacion', subjectId: pendingArea.subjectId },
    })
  }

  if (main != null) {
    const label = getSubtopicLabel(main.subtopicId)
    const why = `${label} (${getSubjectLabel(main.subjectId)}) es donde más puntos del global puedes ganar.`
    if (main.level === 'sin_empezar' || main.level === 'intentado') {
      candidates.push({
        id: `lesson:${main.subtopicId}`,
        kind: 'lesson',
        title: `Lección: ${label}`,
        reason: `Primero la idea. ${why}`,
        minutes: LESSON_MINUTES,
        action: { type: 'lesson', subtopicId: main.subtopicId },
      })
    }
    candidates.push({
      id: `practice:${main.subtopicId}`,
      kind: 'practice',
      title: `Practica ${label}`,
      reason: why,
      minutes: TOPIC_MINUTES,
      action: { type: 'session', kind: 'topic', subtopicId: main.subtopicId },
    })
  } else {
    // Nothing weak at the subtopic level yet: work the area with most room.
    const area = input.areas
      .filter((candidate) => candidate.subjectId !== pendingArea?.subjectId)
      .sort((a, b) => weight(b.subjectId) * areaRoom(b.subjectId) - weight(a.subjectId) * areaRoom(a.subjectId))[0]
    if (area != null) {
      const label = getSubjectLabel(area.subjectId)
      candidates.push({
        id: `practice:${area.subjectId}`,
        kind: 'practice',
        title: `Practica ${label}`,
        reason: `${label} es el área donde más puntos del global puedes ganar.`,
        minutes: TOPIC_MINUTES,
        action: { type: 'session', kind: 'topic', subjectId: area.subjectId },
      })
    }
  }

  if (quickWinTask != null) candidates.push(quickWinTask)
  if (repasoTask != null) candidates.push(repasoTask)

  // Khan's Mastery Challenge needs subtopics already practiced to re-test;
  // before that, a mixed practice over the weak areas.
  const practiced = ranked.filter((subtopic) => subtopic.attemptCount > 0)
  candidates.push(
    practiced.length >= RETO_SUBTOPIC_COUNT
      ? {
          id: 'reto',
          kind: 'reto',
          title: 'Reto de dominio',
          reason: 'Preguntas de varios subtemas que ya practicaste: sube de nivel lo que ya casi dominas.',
          minutes: practiceMinutes(SESSION_KIND_CONFIG.reto.totalQuestions ?? 6),
          action: { type: 'session', kind: 'reto' },
        }
      : {
          id: 'recommended',
          kind: 'practice',
          title: 'Práctica recomendada',
          reason: 'Preguntas de varios temas, enfocadas en tus áreas más débiles.',
          minutes: practiceMinutes(SESSION_KIND_CONFIG.recommended.totalQuestions ?? 10),
          action: { type: 'session', kind: 'recommended' },
        },
  )

  // The weekly goal decides how much fits in a day.
  const dailyMinutes = input.weeklyGoalMinutes / DEFAULT_SESSIONS_PER_WEEK
  const tasks: StudyTask[] = []
  let minutes = 0
  for (const task of candidates) {
    if (tasks.length >= MAX_TASKS) break
    if (tasks.length >= MIN_TASKS && minutes >= dailyMinutes) break
    tasks.push(task)
    minutes += task.minutes
  }
  // A 4 h 30 sitting rarely fits a weekday: it leads, but outside the daily
  // budget, so the weak block is still there on a day it does not fit.
  return { tasks: simulacro == null ? tasks : [simulacro, ...tasks].slice(0, MAX_TASKS) }
}
