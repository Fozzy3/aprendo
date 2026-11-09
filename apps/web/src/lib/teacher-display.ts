const DAY_MS = 86_400_000

/** Mirrors `RiskReason` in `packages/convex/src/teacher.ts` (inactivity is `INACTIVE_DAYS` = 14). */
type RiskReason = 'sin_nivelacion' | 'inactivo' | 'nivel_bajo'

const RISK_LABEL: Record<RiskReason, string> = {
  sin_nivelacion: 'Sin nivelación',
  inactivo: 'Más de dos semanas sin practicar',
  nivel_bajo: 'Nivel 1 en al menos un área',
}

export function riskLabel(reason: RiskReason): string {
  return RISK_LABEL[reason]
}

// A student in level 1 or gone quiet rarely has a content problem: it is time,
// motivation or confidence. The opener asks, it does not judge.
const OPENER: Record<RiskReason, string> = {
  sin_nivelacion: '¿Qué te ha frenado para hacer la primera nivelación? Son 30 minutos y con eso armamos tu ruta.',
  inactivo: '¿Qué te sacó del ritmo? ¿Qué día de la semana puedes practicar 20 minutos?',
  nivel_bajo: '¿Qué te cuesta más en esa área: entender lo que pregunta o resolverlo?',
}

/** How to open the one-to-one talk, from the first (most urgent) reason. */
export function conversationOpener(reasons: RiskReason[]): string {
  const first = reasons[0]
  return first == null ? '' : OPENER[first]
}

/** When the student last started a session, in whole days. */
export function lastActivityLabel(lastActiveAt: number | null, now: number): string {
  if (lastActiveAt == null) return 'Nunca'
  const days = Math.floor((now - lastActiveAt) / DAY_MS)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

export function studentDisplayName(student: { name: string | null; email: string }): string {
  return student.name ?? student.email
}

/** A cycle cell: how many of the students with evidence sat below Familiar. */
export function belowShareLabel(count: { belowCount: number; evidencedCount: number }): string {
  if (count.evidencedCount === 0) return 'sin evidencia'
  return `${count.belowCount} de ${count.evidencedCount} (${Math.round((count.belowCount / count.evidencedCount) * 100)}%)`
}

function listWithAnd(items: string[]) {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

/**
 * The weekly note for the class's WhatsApp group (F69): the same words for
 * every family, about the class and never about a child. Nothing is stored.
 */
export function familyWeeklyMessage(input: { className: string; topics: string[] }): string {
  const focus = input.topics.length > 0
    ? `Esta semana en clase reforzamos ${listWithAnd(input.topics)}.`
    : 'Esta semana seguimos preparando las cinco áreas del Saber 11.'
  return `Buen día, familias de ${input.className}. ${focus} Les pedimos su apoyo para que practiquen en Aprendo 20 minutos, tres días de esta semana, y les pregunten qué aprendieron. ¡Gracias por acompañarlos!`
}

/** Below this many guided paths a share would be noise. */
const MIN_GUIDED_PATHS = 5

/** How many guided paths ended with the answer shown (F56); null without enough of them. */
export function guidedShareLabel(signal: { guidedCount: number; revealedCount: number }): string | null {
  if (signal.guidedCount < MIN_GUIDED_PATHS) return null
  const percent = Math.round((signal.revealedCount / signal.guidedCount) * 100)
  return `${signal.revealedCount} de ${signal.guidedCount} caminos guiados (${percent}%) necesitaron que se les mostrara la respuesta`
}
