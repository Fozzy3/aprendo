import { createFileRoute } from '@tanstack/react-router'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { LearningPathPage } from '../components/LearningPathPage.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { useStudentGuard } from '../lib/use-student-guard.ts'

export const Route = createFileRoute('/path')({
  // Hoy links each area here.
  validateSearch: (search: Record<string, unknown>): { area?: string } =>
    typeof search.area === 'string' ? { area: search.area } : {},
  component: PathRoutePage,
})

function PathRoutePage() {
  const { area } = Route.useSearch()
  const guard = useStudentGuard()
  if (guard.status === 'redirecting') return <FullScreenLoader message={guard.reason} />
  if (guard.status !== 'ready') return <FullScreenLoader />

  return (
    <StudentAppShell session={guard.session} activeSection="path">
      <LearningPathPage key={area} studentId={guard.session.studentId} initialSubjectId={area ?? null} />
    </StudentAppShell>
  )
}
