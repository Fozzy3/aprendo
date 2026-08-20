import { createFileRoute } from '@tanstack/react-router'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { TodayPage } from '../components/TodayPage.tsx'
import { useStudentGuard } from '../lib/use-student-guard.ts'

export const Route = createFileRoute('/today')({
  component: TodayRoutePage,
})

function TodayRoutePage() {
  const guard = useStudentGuard()
  if (guard.status !== 'ready') return <FullScreenLoader />

  return (
    <StudentAppShell session={guard.session} activeSection="today">
      <TodayPage studentId={guard.session.studentId} />
    </StudentAppShell>
  )
}
