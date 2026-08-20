import { createFileRoute } from '@tanstack/react-router'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { SyllabusPage } from '../components/SyllabusPage.tsx'
import { useStudentGuard } from '../lib/use-student-guard.ts'

export const Route = createFileRoute('/syllabus')({
  component: SyllabusRoutePage,
})

function SyllabusRoutePage() {
  const guard = useStudentGuard()
  if (guard.status !== 'ready') return <FullScreenLoader />

  return (
    <StudentAppShell session={guard.session} activeSection="syllabus">
      <SyllabusPage studentId={guard.session.studentId} />
    </StudentAppShell>
  )
}
