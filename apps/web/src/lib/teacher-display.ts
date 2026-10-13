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
