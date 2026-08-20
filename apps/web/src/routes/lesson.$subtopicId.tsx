import { createFileRoute } from '@tanstack/react-router'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { LessonPage } from '../components/LessonPage.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { useStudentGuard } from '../lib/use-student-guard.ts'

export const Route = createFileRoute('/lesson/$subtopicId')({
  component: LessonRoutePage,
})

function LessonRoutePage() {
  const { subtopicId } = Route.useParams()
  const guard = useStudentGuard()
  if (guard.status !== 'ready') return <FullScreenLoader />

  return (
    <StudentAppShell session={guard.session} activeSection="syllabus">
      <LessonPage subtopicId={subtopicId} studentId={guard.session.studentId} />
    </StudentAppShell>
  )
}
