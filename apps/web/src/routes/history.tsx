import { createFileRoute } from '@tanstack/react-router'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { HistoryPage } from '../components/HistoryPage.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { useStudentGuard } from '../lib/use-student-guard.ts'

export const Route = createFileRoute('/history')({
  component: HistoryRoutePage,
})

function HistoryRoutePage() {
  const guard = useStudentGuard()
  if (guard.status !== 'ready') return <FullScreenLoader />

  return (
    <StudentAppShell session={guard.session} activeSection="history">
      <HistoryPage studentId={guard.session.studentId} />
    </StudentAppShell>
  )
}
