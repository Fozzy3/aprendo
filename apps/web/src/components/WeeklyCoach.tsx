import { useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '@aprendo/convex/api'
import { coachSummaryQuery } from '../lib/student-queries.ts'
import { MarkdownBlock } from './MarkdownBlock.tsx'

/** "Tu semana, en resumen": asked for once, only if the student studied this week. */
export function WeeklyCoach({ studentId, activeDaysThisWeek }: { studentId: string; activeDaysThisWeek: number }) {
  const summary = useQuery({ ...coachSummaryQuery(studentId), enabled: true })
  const request = useConvexMutation(api.coach.requestWeeklyCoachSummary)
  const requestedRef = useRef(false)
  useEffect(() => {
    if (activeDaysThisWeek > 0 && summary.data === null && !requestedRef.current) {
      requestedRef.current = true
      void request({ studentId: studentId as never })
    }
  }, [activeDaysThisWeek, request, studentId, summary.data])

  if (summary.data?.status === 'ready' && summary.data.body) {
    return (
      <details className="yo-more">
        <summary>Tu semana</summary>
        <MarkdownBlock markdown={summary.data.body} />
      </details>
    )
  }
  return null
}
