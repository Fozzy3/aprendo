/** Copy for the live "¿voy a tiempo?" chip; the rule itself is `paceStatus` in `@aprendo/convex/pacing`. */
import type { PaceStatus } from '@aprendo/convex/pacing'

export function paceLabel(pace: { status: PaceStatus; deltaQuestions: number }): string {
  if (pace.status === 'a_tiempo') return 'A tiempo'
  const count = Math.abs(pace.deltaQuestions)
  return pace.status === 'adelantado' ? `Adelantado · ${count}` : `Atrasado · ${count}`
}

/** "2 min 15 s", the way the official guide states the pace. */
export function formatPaceMs(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds} s`
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`
}

/** The chip's longer explanation, for its title and screen readers. */
export function paceDescription(
  pace: { status: PaceStatus; deltaQuestions: number },
  msPerQuestion: number,
): string {
  const official = `el ritmo del examen (${formatPaceMs(msPerQuestion)} por pregunta)`
  const count = Math.abs(pace.deltaQuestions)
  const questions = `${count} pregunta${count === 1 ? '' : 's'}`
  if (pace.status === 'a_tiempo') return `Vas a tiempo con ${official}.`
  return pace.status === 'adelantado'
    ? `Vas ${questions} por delante de ${official}.`
    : `Vas ${questions} por detrás de ${official}.`
}
