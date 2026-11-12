import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '@aprendo/convex/api'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { PilotSurvey } from '../components/PilotSurvey.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { useStudentGuard } from '../lib/use-student-guard.ts'

export const Route = createFileRoute('/encuesta')({
  component: SurveyPage,
})

/** The pilot survey, reached from Hoy and from Cuenta; answered once. */
function SurveyPage() {
  const guard = useStudentGuard()
  const mine = useQuery({
    ...convexQuery(api.pilotSurvey.getMine, { studentId: guard.session?.studentId as never }),
    enabled: guard.status === 'ready',
  })
  if (guard.status === 'redirecting') return <FullScreenLoader message={guard.reason} />
  if (guard.status !== 'ready' || mine.isPending) return <FullScreenLoader />

  return (
    <StudentAppShell session={guard.session} activeSection="today">
      <div className="diagnostic-intro">
        <PilotSurvey studentId={guard.session.studentId} answered={mine.data != null} />
      </div>
    </StudentAppShell>
  )
}
