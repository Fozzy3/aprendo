import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { authClient } from '../lib/auth-client.ts'
import { AuthFrame } from './login.tsx'

type ResetSearch = { token?: string; error?: string }

export const Route = createFileRoute('/reset-password')({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: ResetPasswordPage,
})

/** Where the "restablece tu contraseña" email lands, with its one-hour token. */
function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (token == null || linkError != null) {
    return (
      <AuthFrame>
        <h1 className="page-title">Este enlace ya no sirve</h1>
        <p className="page-lede">Los enlaces vencen en una hora y sirven una sola vez. Pide uno nuevo.</p>
        <a href="/login" className="btn-primary mt-6 no-underline">
          Volver a iniciar sesión
        </a>
      </AuthFrame>
    )
  }

  if (isDone) {
    return (
      <AuthFrame>
        <h1 className="page-title">Listo, ya tienes contraseña nueva</h1>
        <a href="/login" className="btn-primary mt-6 no-underline">
          Iniciar sesión
        </a>
      </AuthFrame>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setIsSubmitting(true)
    const { error } = await authClient.resetPassword({ newPassword: password, token })
    setIsSubmitting(false)
    if (error) {
      setErrorMessage('No pudimos cambiarla: puede que el enlace haya vencido. Pide uno nuevo.')
      return
    }
    setIsDone(true)
  }

  return (
    <AuthFrame>
      <h1 className="page-title">Elige una contraseña nueva</h1>
      <form className="mt-6 grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Contraseña nueva</span>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            autoFocus
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {errorMessage ? (
          <p role="alert" className="m-0 text-sm text-[var(--danger-text)]">
            {errorMessage}
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthFrame>
  )
}
