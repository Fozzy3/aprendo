import {
  SESSION_KIND_CONFIG,
  getConfiguredQuestionCount,
  getSimulacroSessionQuestionCount,
  getSimulacroSubjectTarget,
} from '@aprendo/convex/sessionKinds'
import { LIGHT_DAYS_BEFORE_EXAM, type StudyTaskAction } from '@aprendo/convex/studyPlan'
import { MAX_WEEKLY_GOAL_MINUTES, MIN_WEEKLY_GOAL_MINUTES } from '@aprendo/convex/studyTime'

/** When a teacher's task is due, in calendar days. A late one still on the list can still be done (G5). */
export function dueLabel(dueAt: number, now: number): string {
  const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)
  const days = Math.round((startOfDay(dueAt) - startOfDay(now)) / 86_400_000)
  if (days < 0) return 'todavía puedes hacerla'
  if (days === 0) return 'vence hoy'
  if (days === 1) return 'vence mañana'
  const date = new Date(dueAt)
  return `para el ${date.toLocaleDateString('es-CO', { weekday: 'long' })} ${date.getDate()}`
}

/** A plan task's session action, as `createSession` takes it (plus studentId). */
export function taskSessionArgs(action: Extract<StudyTaskAction, { type: 'session' }>) {
  const { type: _type, ...args } = action
  return args
}

/**
 * Where a plan task goes on the tap. Timed sessions (nivelación, simulacro)
 * start behind an intro that lives on the screen that chooses them.
 */
export function taskTarget(task: { kind: string; action: StudyTaskAction }):
  | { type: 'lesson'; subtopicId: string }
  | { type: 'link'; to: '/diagnostic' | '/practice' }
  | { type: 'launch'; args: ReturnType<typeof taskSessionArgs> } {
  const { action } = task
  if (action.type === 'lesson') return { type: 'lesson', subtopicId: action.subtopicId }
  if (action.kind === 'nivelacion') return { type: 'link', to: '/diagnostic' }
  if (action.kind === 'simulacro') return { type: 'link', to: '/practice' }
  return { type: 'launch', args: taskSessionArgs(action) }
}

/** How many questions the comeback starts with. */
const COMEBACK_QUESTIONS = 5

/**
 * The soft start after three days away: five of the review when something is
 * due, else five of the plan's first topic, else the recommended five. Never
 * a lesson or a timed sitting: one tap and a short session.
 */
export function comebackLaunch(tasks: { action: StudyTaskAction }[]) {
  const sessions = tasks.flatMap(({ action }) => (action.type === 'session' ? [action] : []))
  const repaso = sessions.find((action) => action.kind === 'repaso')
  if (repaso != null) return { kind: 'repaso' as const, questionLimit: COMEBACK_QUESTIONS }
  const topic = sessions.find((action) => action.kind === 'topic')
  if (topic != null) return { ...taskSessionArgs(topic), questionLimit: COMEBACK_QUESTIONS }
  return { kind: 'recommended' as const }
}

/**
 * Hoy's areas: topics at Competente or above out of the area's topics (the
 * album counts them), with the ICFES level once there is evidence for one.
 */
export function areaRows(
  album: { subjects: { subjectId: string; label: string; earnedCount: number; stickers: unknown[] }[] },
  subjects: { subjectId: string; level: { placement: { band: { labelEs: string } } | null } }[] | undefined,
) {
  return album.subjects.map((subject) => ({
    subjectId: subject.subjectId,
    label: subject.label,
    done: subject.earnedCount,
    total: subject.stickers.length,
    level: subjects?.find((item) => item.subjectId === subject.subjectId)?.level.placement?.band.labelEs ?? null,
  }))
}

/**
 * What `TimedSessionIntro` shows before a timed task's clock starts, or null
 * for untimed practice, which starts on the tap.
 */
export function timedIntro(
  action: Extract<StudyTaskAction, { type: 'session' }>,
): { questionCount: number; timeLimitMs: number } | null {
  const config = SESSION_KIND_CONFIG[action.kind]
  if (config.simulacroSessions != null) {
    const sitting = config.simulacroSessions.find((item) => item.sessionNumber === action.simulacroSessionNumber)
    if (sitting != null) {
      return { questionCount: getSimulacroSessionQuestionCount(sitting), timeLimitMs: sitting.timeLimitMs }
    }
    const area = action.subjectId == null ? null : getSimulacroSubjectTarget(action.subjectId)
    return area == null ? null : { questionCount: area.questionCount, timeLimitMs: area.timeLimitMs }
  }
  return config.timeLimitMs == null
    ? null
    : { questionCount: getConfiguredQuestionCount(config), timeLimitMs: config.timeLimitMs }
}

/** The weekly goal is typed in hours (comma or dot) and stored in minutes. */
export function hoursToGoalMinutes(value: string): number | null {
  const hours = Number(value.trim().replace(',', '.'))
  if (value.trim() === '' || !Number.isFinite(hours)) return null
  const minutes = Math.round(hours * 60)
  return minutes >= MIN_WEEKLY_GOAL_MINUTES && minutes <= MAX_WEEKLY_GOAL_MINUTES ? minutes : null
}

type GlobalGap = {
  estimate: { score: number } | null
  target: number | null
  gap: number | null
  weeksRemaining: number | null
  pointsPerWeek: number | null
  onTrack: boolean | null
}

/**
 * The gap to the target, in words. The verdict is the backend's alone: it
 * needs three weeks of the student's own trend, and below that Hoy says nothing
 * rather than inventing a rate. `daysRemaining` is the exam plan's (null with
 * no date): past the exam, or in the light days the plan keeps for rest, there
 * is no pace to judge.
 */
export function targetGapLines(data: GlobalGap, daysRemaining: number | null): {
  headline: string
  detail: string
  verdict: { onTrack: boolean; text: string } | null
} | null {
  if (data.estimate == null) return null
  if (data.target == null || data.gap == null) {
    return {
      headline: 'Ponte una meta de puntaje global',
      detail: 'Con una meta, Hoy te dice cuánto te falta y si vas a tiempo.',
      verdict: null,
    }
  }
  if (data.gap <= 0) {
    return {
      headline: `Ya alcanzaste tu meta de ${data.target}`,
      detail: 'Súbela si quieres apuntar más alto.',
      verdict: null,
    }
  }

  const headline = `Te faltan ${data.gap} puntos para tu meta de ${data.target}`
  if (daysRemaining != null && daysRemaining < 0) {
    return { headline, detail: 'Tu examen ya pasó: actualiza la fecha si vas a presentarlo de nuevo.', verdict: null }
  }
  if (daysRemaining != null && daysRemaining <= LIGHT_DAYS_BEFORE_EXAM) {
    return { headline, detail: 'Tu examen ya está encima: repasa lo que ya sabes y descansa.', verdict: null }
  }

  const detail =
    daysRemaining == null || data.weeksRemaining == null
      ? 'Pon la fecha de tu examen para saber a qué ritmo subir.'
      : data.weeksRemaining <= 0
        ? 'Tu examen es esta semana: repasa lo que ya sabes.'
        : `Quedan ${data.weeksRemaining} ${data.weeksRemaining === 1 ? 'semana' : 'semanas'}: unos ${Math.ceil(data.gap / data.weeksRemaining)} puntos por semana.`

  const pace = data.pointsPerWeek == null ? null : Math.round(data.pointsPerWeek)
  const verdict =
    data.onTrack == null || pace == null
      ? null
      : data.onTrack
        ? { onTrack: true, text: `Vas a tiempo: subes unos ${pace} puntos por semana.` }
        : {
            onTrack: false,
            text: `A tu ritmo actual (${pace} puntos por semana) no llegas. Sube la dosis de práctica.`,
          }

  return { headline, detail, verdict }
}
