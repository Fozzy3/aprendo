import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Wordmark } from '../components/BrandMark.tsx'
import { authClient } from '../lib/auth-client.ts'
import { safeNext } from '../lib/safe-next.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { publicHead } from '../lib/site.ts'

type LoginSearch = { next?: string }

export const Route = createFileRoute('/login')({
  head: () => publicHead({"title":"Entrar | Aprendo","description":"Entra a Aprendo para seguir tu preparación para el Saber 11.","path":"/login"}),
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    next: typeof search.next === 'string' ? search.next : undefined,
  }),
  component: LoginPage,
})

type AuthMode = 'sign-in' | 'sign-up' | 'reset'

/** What the screen shows after a submit that needs the student's inbox. */
type Notice = 'verify-sent' | 'reset-sent' | null

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
  const { session, isReady } = useCurrentStudent()
  const next = safeNext(Route.useSearch().next)

  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // A full navigation, so the session cookie is read fresh by the router.
  const goNext = () => window.location.assign(next)

  if (isReady && session) {
    return (
      <AuthFrame>
        <h1 className="page-title">Ya tienes una sesión</h1>
        <p className="page-lede">{session.email}</p>
        <button type="button" className="btn-primary mt-6" onClick={goNext}>
          Continuar
        </button>
      </AuthFrame>
    )
  }

  const switchMode = (value: AuthMode) => {
    setMode(value)
    setErrorMessage(null)
    setUnverified(false)
    setNotice(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setUnverified(false)
    const trimmedEmail = email.trim()
    if (trimmedEmail.length === 0) {
      setErrorMessage('Escribe tu correo electrónico.')
      return
    }
    if (mode !== 'reset' && password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (mode === 'sign-up' && name.trim().length === 0) {
      setErrorMessage('Escribe tu nombre: así te reconoce tu docente.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'reset') {
        const { error } = await authClient.requestPasswordReset({ email: trimmedEmail, redirectTo: '/reset-password' })
        if (error) {
          setErrorMessage(readErrorMessage(error) ?? 'No pudimos enviar el correo. Intenta de nuevo.')
          return
        }
        setNotice('reset-sent')
        return
      }
      if (mode === 'sign-in') {
        const { error } = await authClient.signIn.email({ email: trimmedEmail, password, callbackURL: next })
        if (error) {
          if (error.code === 'EMAIL_NOT_VERIFIED') {
            setUnverified(true)
            setErrorMessage('Primero confirma tu correo: te acabamos de enviar el enlace otra vez.')
            return
          }
          setErrorMessage(
            error.code === 'INVALID_EMAIL_OR_PASSWORD'
              ? 'El correo o la contraseña no coinciden.'
              : readErrorMessage(error) ?? 'No pudimos iniciar sesión.',
          )
          return
        }
        goNext()
        return
      }
      const { data, error } = await authClient.signUp.email({
        email: trimmedEmail,
        password,
        name: name.trim(),
        callbackURL: next,
      })
      if (error) {
        setErrorMessage(
          error.code === 'USER_ALREADY_EXISTS' || error.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
            ? 'Ya existe una cuenta con ese correo. Inicia sesión.'
            : readErrorMessage(error) ?? 'No pudimos crear la cuenta.',
        )
        return
      }
      // With email verification on, sign-up returns no session until the link
      // in the inbox is opened.
      if (data?.token == null) {
        setNotice('verify-sent')
        return
      }
      goNext()
    } catch (error) {
      setErrorMessage(readErrorMessage(error) ?? 'Ocurrió un error inesperado.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (notice != null) {
    return (
      <AuthFrame>
        <h1 className="page-title">Revisa tu correo</h1>
        <p className="page-lede">
          {notice === 'verify-sent'
            ? `Te enviamos un enlace a ${email.trim()} para confirmar tu cuenta. Ábrelo y entrarás directo.`
            : `Si hay una cuenta con ${email.trim()}, te llegará un enlace para elegir una contraseña nueva. Vence en una hora.`}
        </p>
        <p className="mt-3 text-sm text-[var(--text-tertiary)]">¿No llega? Revisa la carpeta de spam.</p>
        <button type="button" className="btn-secondary mt-6" onClick={() => switchMode('sign-in')}>
          Volver a iniciar sesión
        </button>
      </AuthFrame>
    )
  }

  const title = mode === 'sign-in' ? 'Entra a Aprendo' : mode === 'sign-up' ? 'Crea tu cuenta' : 'Recupera tu contraseña'
  const submitLabel = isSubmitting
    ? mode === 'sign-in' ? 'Entrando…' : mode === 'sign-up' ? 'Creando cuenta…' : 'Enviando…'
    : mode === 'sign-in' ? 'Entrar' : mode === 'sign-up' ? 'Crear cuenta' : 'Enviar enlace'

  return (
    <AuthFrame>
      <h1 className="page-title">{title}</h1>
      <p className="page-lede">
        {mode === 'sign-in'
          ? 'Con el correo y la contraseña de tu cuenta.'
          : mode === 'sign-up'
            ? 'Tu progreso se guarda en tu cuenta. Si tu colegio usa Aprendo, después te unes a tu curso con un código.'
            : 'Escribe tu correo y te enviamos un enlace para elegir una contraseña nueva.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
        {mode === 'sign-up' ? (
          <label className="field">
            <span>Nombre y apellido</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input"
              autoComplete="name"
              maxLength={80}
            />
          </label>
        ) : null}
        <label className="field">
          <span>Correo electrónico</span>
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
        {mode !== 'reset' ? (
          <label className="field">
            <span>Contraseña</span>
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
        ) : null}

        {errorMessage ? (
          <p role="alert" className="m-0 text-sm font-medium text-[var(--danger-text)]">
            {errorMessage}
          </p>
        ) : null}
        {unverified ? (
          <p className="m-0 text-sm text-[var(--text-secondary)]">Revisa también la carpeta de spam.</p>
        ) : null}

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {submitLabel}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-start gap-2 text-sm">
        {mode === 'sign-in' ? (
          <>
            <button type="button" className="link-button" onClick={() => switchMode('sign-up')}>
              ¿No tienes cuenta? Crea una
            </button>
            <button type="button" className="link-button" onClick={() => switchMode('reset')}>
              Olvidé mi contraseña
            </button>
          </>
        ) : (
          <button type="button" className="link-button" onClick={() => switchMode('sign-in')}>
            Ya tengo cuenta: iniciar sesión
          </button>
        )}
      </div>
    </AuthFrame>
  )
}

/** The sign-in screens: one ruled sheet on the desk, the wordmark at its head. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-sheet sheet fade-in">
        <Link to="/" className="no-underline">
          <Wordmark subtitle="Saber 11" />
        </Link>
        <div className="mt-8">{children}</div>
        <p className="auth-legal">
          Al usar Aprendo aceptas los <Link to="/terminos">términos</Link> y la{' '}
          <Link to="/privacidad">política de tratamiento de datos</Link>.
        </p>
      </div>
    </div>
  )
}
