import { createFileRoute, redirect } from '@tanstack/react-router'

// Aprende (/path) absorbed the temario.
export const Route = createFileRoute('/syllabus')({
  beforeLoad: () => {
    throw redirect({ to: '/path' })
  },
})
