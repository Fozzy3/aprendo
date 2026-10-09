/**
 * "% eligió cada opción" and the median time on a question. It normalizes a
 * miss on a hard item and exposes a bad key (a distractor out-drawing the key),
 * so it counts each student once, on their first settled answer given before
 * they ever saw the key: a repaso answered from the review is memory, and would
 * push the key's share up. Kept as a running tally per question
 * (`sessions.completeSession`), so reading it never scans the answers. Below
 * `MIN_STATS_SAMPLE` answers the shares are noise: only the sample size is
 * returned. Pure.
 */
import { questionTimeMs } from './pacing'

export const MIN_STATS_SAMPLE = 20
/** Times kept per question for the median: the first answers, plenty for a stable middle. */
export const MAX_TIME_SAMPLE = 200

export interface AnswerTally {
  answerCount: number
  optionCounts: Record<string, number>
  timeSampleMs: number[]
}

type TimedAnswer = { selectedOption: string; timeSpentMs?: number; responseTimeMs?: number }

export function addToTally(tally: AnswerTally | null, answer: TimedAnswer): AnswerTally {
  const time = questionTimeMs(answer)
  const times = tally?.timeSampleMs ?? []
  return {
    answerCount: (tally?.answerCount ?? 0) + 1,
    optionCounts: {
      ...tally?.optionCounts,
      [answer.selectedOption]: (tally?.optionCounts[answer.selectedOption] ?? 0) + 1,
    },
    timeSampleMs: time != null && times.length < MAX_TIME_SAMPLE ? [...times, time] : times,
  }
}

/**
 * Whether a student's answer enters the tally. `others` are their other rows on
 * the question, with the completion time of their session when it completed:
 * a session completed earlier already showed the key (blank or not), and so did
 * a "Ver respuesta" before this answer.
 */
export function countsTowardStats(
  answer: { answeredAt: number; completedAt: number },
  others: { checkedAt?: number; completedAt?: number }[],
) {
  return others.every((other) =>
    (other.completedAt == null || other.completedAt > answer.completedAt)
    && (other.checkedAt == null || other.checkedAt > answer.answeredAt))
}

/**
 * The tally from scratch, from every row on one question (the backfill).
 * `completedAt` is the row's session completion time, absent while it is open
 * or when it was abandoned.
 */
export function tallyAnswers(
  rows: (Partial<TimedAnswer> & {
    studentId: string
    answeredAt?: number
    checkedAt?: number
    completedAt?: number
  })[],
): AnswerTally | null {
  let tally: AnswerTally | null = null
  const settled = [...rows].sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
  for (const row of settled) {
    const { selectedOption, answeredAt, completedAt } = row
    if (selectedOption == null || answeredAt == null || completedAt == null) continue
    const others = rows.filter((other) => other !== row && other.studentId === row.studentId)
    if (countsTowardStats({ answeredAt, completedAt }, others)) {
      tally = addToTally(tally, { ...row, selectedOption })
    }
  }
  return tally
}

export function summarizeAnswerStats(tally: AnswerTally | null, optionLabels: string[]) {
  const sampleSize = tally?.answerCount ?? 0
  const hasEnoughData = sampleSize >= MIN_STATS_SAMPLE
  const times = [...(tally?.timeSampleMs ?? [])].sort((a, b) => a - b)

  return {
    sampleSize,
    hasEnoughData,
    options: optionLabels.map((label) => ({
      label,
      percent: hasEnoughData ? Math.round(((tally?.optionCounts[label] ?? 0) / sampleSize) * 100) : null,
    })),
    medianTimeMs: hasEnoughData && times.length > 0 ? median(times) : null,
  }
}

function median(sorted: number[]) {
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  return sorted.length % 2 === 1 ? upper : Math.round(((sorted[middle - 1] ?? upper) + upper) / 2)
}
