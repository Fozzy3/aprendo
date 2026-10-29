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
