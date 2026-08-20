import { createFileRoute } from '@tanstack/react-router'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { LearningPathPage } from '../components/LearningPathPage.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { useStudentGuard } from '../lib/use-student-guard.ts'

export const Route = createFileRoute('/path')({
  component: PathRoutePage,
})

function PathRoutePage() {
  const guard = useStudentGuard()
  if (guard.status !== 'ready') return <FullScreenLoader />

  return (
    <StudentAppShell session={guard.session} activeSection="path">
      <LearningPathPage studentId={guard.session.studentId} />
    </StudentAppShell>
  )
}
