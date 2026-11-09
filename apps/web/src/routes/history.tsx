import { createFileRoute, redirect } from '@tanstack/react-router'

// Yo (/progress) absorbed the history.
export const Route = createFileRoute('/history')({
  beforeLoad: () => {
    throw redirect({ to: '/progress' })
  },
})
