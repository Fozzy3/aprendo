import {
  Activity,
  BookOpen,
  Gauge,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { SESSION_KIND_CONFIG, type SessionKind } from '@aprendo/convex/sessionKinds'

const KIND_ICON: Record<SessionKind, LucideIcon> = {
  diagnostic: Activity,
  nivelacion: Gauge,
  recommended: Sparkles,
  topic: BookOpen,
  simulacro: Timer,
  repaso: RotateCcw,
  personalizada: SlidersHorizontal,
  reto: Trophy,
}

export function getKindIcon(kind: SessionKind): LucideIcon {
  return KIND_ICON[kind]
}

export function getKindLabel(kind: SessionKind): string {
  return SESSION_KIND_CONFIG[kind].labelEs
}

export function getKindTagline(kind: SessionKind): string {
  return SESSION_KIND_CONFIG[kind].taglineEs
}

/**
 * A time limit as a student reads it: "30 min", "4 h 30 min", "Sin límite".
 * Hours past 60 minutes, because "270 min" has to be divided in your head
 * before it means anything.
 */
export function formatTimeLimit(timeLimitMs: number | null | undefined): string {
  if (timeLimitMs == null) return 'Sin límite'
  const totalMinutes = Math.round(timeLimitMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

/** Relative-ish date label in Spanish for session history rows. */
export function formatSessionDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  if (sameDay) {
    return `Hoy · ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
  }
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
