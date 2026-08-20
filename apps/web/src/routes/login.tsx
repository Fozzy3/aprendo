import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import BrandMark from '../components/BrandMark.tsx'
import { authClient } from '../lib/auth-client.ts'
import { useCurrentStudent } from '../lib/student-session.ts'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

type AuthMode = 'sign-in' | 'sign-up'

function readErrorMessage(error: unknown) {
  if (error == null) return null
  if (typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim().length > 0) return message
  }
  if (error instanceof Error) return error.message
  return String(error)
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
      setErrorMessage('Ingresa tu correo electronico.')
      return
    }
    if (password.length < 8) {
      setErrorMessage('La contrasena debe tener al menos 8 caracteres.')
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
          setErrorMessage(readErrorMessage(error) ?? 'No pudimos iniciar sesion.')
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
      setErrorMessage(readErrorMessage(error) ?? 'Ocurrio un error inesperado.')
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
              ? 'Inicia sesion con tu correo y contrasena.'
              : 'Te crearemos una cuenta para guardar tu progreso.'}
          </p>

          <form onSubmit={handleSubmit}>
            <label className="mb-4 block">
              <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
                Correo electronico
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
                Contrasena
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo 8 caracteres"
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
                ? mode === 'sign-in' ? 'Entrando...' : 'Creando cuenta...'
                : mode === 'sign-in' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>

          {errorMessage ? (
            <p className="mt-4 text-center text-sm font-medium text-[var(--accent-text)]">
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
              ? '¿Aun no tienes cuenta? Crea una'
              : '¿Ya tienes cuenta? Inicia sesion'}
          </button>
        </div>
      </div>
    </div>
  )
}
