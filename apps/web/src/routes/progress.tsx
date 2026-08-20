import { createFileRoute } from '@tanstack/react-router'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { StudentProgressPage } from '../components/StudentProgressPage.tsx'
import { useStudentGuard } from '../lib/use-student-guard.ts'

export const Route = createFileRoute('/progress')({
  component: ProgressRoutePage,
})

function ProgressRoutePage() {
  const guard = useStudentGuard()
  if (guard.status !== 'ready') return <FullScreenLoader />

  return (
    <StudentAppShell session={guard.session} activeSection="progress">
      <StudentProgressPage studentId={guard.session.studentId} />
    </StudentAppShell>
  )
}
