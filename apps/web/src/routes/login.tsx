import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import BrandMark from '../components/BrandMark.tsx'
import { authClient } from '../lib/auth-client.ts'
import { useCurrentStudent } from '../lib/student-session.ts'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

type AuthMode = 'sign-in' | 'sign-up'

/**
 * Pull something readable out of whatever the auth client threw.
 *
 * Better Auth rejects with a plain object shaped like
 * `{ code, message?, status, statusText }` — not an `Error`, and often with no
 * `message` at all. Falling through to `String(error)` on that object is how a
 * student ended up staring at "[object Object]" instead of being told what went
 * wrong, so every branch here has to produce real words or give up and return
 * null (the caller then supplies a sensible Spanish default).
 */
function readErrorMessage(error: unknown) {
  if (error == null) return null
  if (typeof error === 'string') return error.trim().length > 0 ? error : null
  if (error instanceof Error) return error.message

  if (typeof error === 'object') {
    const candidate = error as {
      message?: unknown
      code?: unknown
      statusText?: unknown
      error?: unknown
    }
    for (const value of [candidate.message, candidate.statusText, candidate.code]) {
      if (typeof value === 'string' && value.trim().length > 0) return value
    }
    // Some shapes nest the real payload one level down.
    if (candidate.error != null && candidate.error !== error) {
      return readErrorMessage(candidate.error)
    }
    return null
  }

  return null
}

function LoginPage() {
  const navigate = useNavigate()
  const { session, isReady } = useCurrentStudent()

  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isReady && session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="fade-in w-full max-w-sm text-center">
          <div className="card px-8 py-10">
            <p className="mb-1 text-sm text-[var(--text-secondary)]">
              Sesion activa
            </p>
            <p className="mb-6 text-lg font-semibold text-[var(--text-primary)]">
              {session.email}
            </p>
            <Link
              to="/app"
              className="btn-primary w-full justify-center no-underline"
            >
              Continuar
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    const trimmedEmail = email.trim()
    if (trimmedEmail.length === 0) {
      setErrorMessage('Ingresa tu correo electrónico.')
      return
    }
    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'sign-in') {
        const { error } = await authClient.signIn.email({
          email: trimmedEmail,
          password,
        })
        if (error) {
          setErrorMessage(readErrorMessage(error) ?? 'No pudimos iniciar sesión.')
          return
        }
      } else {
        const { error } = await authClient.signUp.email({
          email: trimmedEmail,
          password,
          name: trimmedEmail,
        })
        if (error) {
          setErrorMessage(readErrorMessage(error) ?? 'No pudimos crear la cuenta.')
          return
        }
      }
      await navigate({ to: '/app' })
    } catch (error) {
      setErrorMessage(readErrorMessage(error) ?? 'Ocurrió un error inesperado.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="fade-in w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-tertiary)] no-underline transition hover:text-[var(--text-secondary)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Volver
          </Link>
        </div>

        <div className="card px-8 py-10">
          <div className="mb-6 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)]">
              <BrandMark size={22} strokeWidth={2} />
            </div>
          </div>

          <h1 className="mb-1 text-center text-xl font-semibold text-[var(--text-primary)]">
            {mode === 'sign-in' ? 'Entra a Aprendo' : 'Crea tu cuenta'}
          </h1>
          <p className="mb-6 text-center text-sm text-[var(--text-tertiary)]">
            {mode === 'sign-in'
              ? 'Inicia sesión con tu correo y contraseña.'
              : 'Te crearemos una cuenta para guardar tu progreso.'}
          </p>

          <form onSubmit={handleSubmit}>
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                Correo electrónico
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@correo.com"
                className="input"
                autoComplete="email"
                autoFocus
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                Contraseña
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="input"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                minLength={8}
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting || email.trim().length === 0 || password.length < 8}
              className="btn-primary w-full justify-center py-3"
            >
              {isSubmitting
                ? mode === 'sign-in' ? 'Entrando…' : 'Creando cuenta…'
                : mode === 'sign-in' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          {errorMessage ? (
            <p role="alert" className="mt-4 text-center text-sm font-medium text-[var(--danger-text)]">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setMode((value) => (value === 'sign-in' ? 'sign-up' : 'sign-in'))
              setErrorMessage(null)
            }}
            className="mt-6 w-full text-center text-sm text-[var(--text-tertiary)] underline-offset-2 hover:text-[var(--text-secondary)] hover:underline"
          >
            {mode === 'sign-in'
              ? '¿Aún no tienes cuenta? Crea una'
              : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  )
}
