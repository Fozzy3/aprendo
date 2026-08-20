import {
  Activity,
  BookOpen,
  Gauge,
  RotateCcw,
  Sparkles,
  Timer,
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

/** Human-friendly time-limit label, e.g. "60 min" or "Sin límite". */
export function formatTimeLimit(timeLimitMs: number | null | undefined): string {
  if (timeLimitMs == null) return 'Sin límite'
  const minutes = Math.round(timeLimitMs / 60_000)
  return `${minutes} min`
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
