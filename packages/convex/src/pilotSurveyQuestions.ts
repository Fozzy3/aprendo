/**
 * The pilot survey (plans/piloto-retencion.md, Phase 5): fifteen questions,
 * one definition for the screens, the server's check and the admin summary.
 * Pure, so the web imports it.
 */

export type SurveyQuestionKind = 'scale5' | 'scale5_or_na' | 'nps' | 'single' | 'multi' | 'text'
export type SurveyOption = { id: string; label: string }
export type SurveyQuestion = {
  id: string
  text: string
  kind: SurveyQuestionKind
  /** Single and multiple choice only. */
  options?: SurveyOption[]
  required?: boolean
}
export type SurveyAnswer = number | string | string[]
export type SurveyAnswers = Record<string, SurveyAnswer>

/** The "no lo usé" of a `scale5_or_na`. */
export const NOT_USED = 'na'
export const NOT_USED_LABEL = 'No lo usé'
export const MAX_TEXT_LENGTH = 1000
export const SURVEY_DUE_AFTER_SESSIONS = 3

const options = (entries: [string, string][]): SurveyOption[] => entries.map(([id, label]) => ({ id, label }))

export const PILOT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  { id: 'start_ease', kind: 'scale5', required: true, text: '¿Qué tan fácil fue empezar a usar Aprendo?' },
  { id: 'diagnostic_fit', kind: 'scale5', required: true, text: '¿El diagnóstico inicial reflejó bien tu nivel?' },
  { id: 'today_clarity', kind: 'scale5', required: true, text: 'Al abrir "Hoy", ¿tenías claro qué hacer?' },
  {
    id: 'help_useful', kind: 'scale5_or_na', required: true,
    text: 'Cuando fallaste una pregunta, ¿qué tan útiles fueron la explicación y el tutor?',
  },
  { id: 'saber_likeness', kind: 'scale5', required: true, text: '¿Las preguntas se parecen a las del Saber 11?' },
  { id: 'helps_improve', kind: 'scale5', required: true, text: '¿Sientes que Aprendo te ayuda a mejorar para el examen?' },
  {
    id: 'come_back', kind: 'multi', text: '¿Qué te hizo volver a practicar?',
    options: options([
      ['racha', 'La racha'], ['meta_dia', 'La meta del día'], ['xp', 'El XP'], ['liga', 'La liga'],
      ['correo', 'El correo de recordatorio'], ['progreso', 'Ver mi progreso'], ['examen', 'Se acerca el examen'],
      ['nada', 'Nada en especial'],
    ]),
  },
  {
    id: 'blockers', kind: 'multi', text: '¿Qué te impidió practicar más?',
    options: options([
      ['tiempo', 'Falta de tiempo'], ['olvido', 'Se me olvidó'], ['internet', 'Internet o datos'],
      ['celular_lento', 'El celular va lento'], ['aburrido', 'Me aburrí'], ['muy_dificil', 'Muy difícil'],
      ['muy_facil', 'Muy fácil'], ['otra', 'Otra'],
    ]),
  },
  {
    id: 'device', kind: 'single', text: '¿Dónde lo usaste más?',
    options: options([
      ['celular_propio', 'Celular propio'], ['celular_prestado', 'Celular prestado'],
      ['computador_casa', 'Computador en casa'], ['computador_colegio', 'Computador del colegio'],
    ]),
  },
  {
    id: 'other_prep', kind: 'multi', text: '¿Qué más usas para prepararte?',
    options: options([
      ['preicfes', 'Preicfes presencial'], ['youtube', 'YouTube'], ['cartillas', 'Cartillas'],
      ['otra_app', 'Otra app'], ['nada', 'Nada'],
    ]),
  },
  {
    id: 'disappointment', kind: 'single', text: '¿Cómo te sentirías si ya no pudieras usar Aprendo?',
    options: options([['muy', 'Muy decepcionado'], ['algo', 'Algo decepcionado'], ['igual', 'Me da igual']]),
  },
  { id: 'recommend', kind: 'nps', text: '¿Qué tan probable es que se lo recomiendes a un compañero?' },
  {
    id: 'pay', kind: 'single', text: '¿Tú o tu familia pagarían por Aprendo?',
    options: options([
      ['no', 'No'], ['hasta_10', 'Hasta $10.000 al mes'], ['de_10_20', '$10.000–20.000'],
      ['de_20_40', '$20.000–40.000'], ['mas', 'Más'],
    ]),
  },
  { id: 'confusing', kind: 'text', text: '¿Qué fue lo más confuso o molesto?' },
  { id: 'change', kind: 'text', text: '¿Qué le cambiarías o agregarías?' },
]

const isWhole = (value: SurveyAnswer, min: number, max: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

function isValid(question: SurveyQuestion, value: SurveyAnswer) {
  const ids = new Set(question.options?.map((option) => option.id))
  switch (question.kind) {
    case 'scale5':
      return isWhole(value, 1, 5)
    case 'scale5_or_na':
      return value === NOT_USED || isWhole(value, 1, 5)
    case 'nps':
      return isWhole(value, 0, 10)
    case 'single':
      return typeof value === 'string' && ids.has(value)
    case 'multi':
      return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length
        && value.every((id) => ids.has(id))
    case 'text':
      return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT_LENGTH
  }
}

/** Why a set of answers cannot be saved, or null when it can. */
export function surveyAnswersError(answers: SurveyAnswers): string | null {
  const byId = new Map(PILOT_SURVEY_QUESTIONS.map((question) => [question.id, question]))
  for (const [id, value] of Object.entries(answers)) {
    const question = byId.get(id)
    if (question == null || !isValid(question, value)) return 'Una de tus respuestas no es válida.'
  }
  if (PILOT_SURVEY_QUESTIONS.some((question) => question.required && answers[question.id] == null)) {
    return 'Faltan respuestas obligatorias.'
  }
  return null
}

/** Hoy offers the survey after three completed sessions, until it is answered. */
export function isSurveyDue(sessions: { status: string }[], answered: boolean) {
  return !answered
    && sessions.filter((session) => session.status === 'completed').length >= SURVEY_DUE_AFTER_SESSIONS
}

const SCALE_VALUES: Record<SurveyQuestionKind, string[]> = {
  scale5: ['1', '2', '3', '4', '5'],
  scale5_or_na: ['1', '2', '3', '4', '5', NOT_USED],
  nps: Array.from({ length: 11 }, (_, value) => String(value)),
  single: [],
  multi: [],
  text: [],
}

type Response = { answers: SurveyAnswers; submittedAt: number }

/**
 * The admin's read of the survey: counts per option or point, the mean of each
 * scale ("no lo usé" left out), NPS (% promoters 9–10 minus % detractors 0–6),
 * the Sean Ellis share of "muy decepcionado", and every free text, newest first.
 */
export function summarizeSurvey(responses: Response[]) {
  const percentOf = (part: number, whole: number) => (whole === 0 ? null : (part / whole) * 100)
  const questions = PILOT_SURVEY_QUESTIONS.map((question) => {
    const given = responses.flatMap((response) => {
      const value = response.answers[question.id]
      return value == null ? [] : [{ value, submittedAt: response.submittedAt }]
    })
    const choices = question.options ?? SCALE_VALUES[question.kind].map((value) => ({
      id: value,
      label: value === NOT_USED ? NOT_USED_LABEL : value,
    }))
    const counts = choices.map((choice) => ({
      value: choice.id,
      label: choice.label,
      count: given.filter(({ value }) => (Array.isArray(value) ? value.includes(choice.id) : String(value) === choice.id)).length,
    }))
    const numbers = given.flatMap(({ value }) => (typeof value === 'number' ? [value] : []))
    const isScale = SCALE_VALUES[question.kind].length > 0
    return {
      id: question.id,
      text: question.text,
      kind: question.kind,
      answered: given.length,
      counts,
      mean: !isScale || numbers.length === 0 ? null : numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
      texts: question.kind !== 'text'
        ? []
        : given
            .map(({ value, submittedAt }) => ({ text: String(value), submittedAt }))
            .sort((a, b) => b.submittedAt - a.submittedAt),
    }
  })

  const scores = questions.find((question) => question.kind === 'nps')!
  const promoters = scores.counts.filter((entry) => Number(entry.value) >= 9).reduce((sum, entry) => sum + entry.count, 0)
  const detractors = scores.counts.filter((entry) => Number(entry.value) <= 6).reduce((sum, entry) => sum + entry.count, 0)
  const disappointment = questions.find((question) => question.id === 'disappointment')!
  const veryDisappointed = disappointment.counts.find((entry) => entry.value === 'muy')?.count ?? 0

  return {
    total: responses.length,
    nps: percentOf(promoters - detractors, scores.answered),
    seanEllis: percentOf(veryDisappointed, disappointment.answered),
    questions,
  }
}
