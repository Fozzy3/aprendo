import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Hourglass, LayoutGrid, Timer, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@aprendo/convex/api'
import MarkdownBlock from './MarkdownBlock.tsx'
import { CONFIDENCE_OPTIONS, type ConfidenceLevel } from '../lib/confidence-display.ts'
import { SharedStimulus } from './SharedStimulus.tsx'
import { sessionQuery } from '../lib/student-queries.ts'
import { getKindIcon, getKindLabel } from '../lib/session-display.ts'
import { formatClock, useSessionTimer } from '../lib/useSessionTimer.ts'
import { getSubjectLabel } from '../lib/taxonomy.ts'
import { MascotMessage } from './Mascot.tsx'
import { readConvexError } from '../lib/convex-error.ts'

type SessionSolveProps = {
  sessionId: string
  onExit: () => void
  onCompleted: (sessionId: string) => void
}

/**
 * The single solve surface used by every session kind (diagnostic,
 * recommended, topic, simulacro). It shows one question at a time, never
 * discloses answers, and — for timed kinds — counts down and auto-submits
 * when the clock runs out. Routes wrap this in whatever chrome they need.
 */
export function SessionSolve({ sessionId, onExit, onCompleted }: SessionSolveProps) {
  const queryClient = useQueryClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMapOpen, setIsMapOpen] = useState(false)

  /**
   * What the student just tapped, before the server has confirmed it.
   *
   * The card used to stay unselected until `submitAnswer` returned and the
   * session query refetched — a visible pause between the tap and any feedback,
   * on the one interaction that happens dozens of times per session. This holds
   * the answer locally so the card lights up on the same frame, and the entry is
   * dropped once the server row agrees.
   */
  const [pending, setPending] = useState<
    Record<string, { selectedOption: string | null; confidence?: ConfidenceLevel }>
  >({})
  const questionStartedAtRef = useRef(Date.now())

  const submitAnswer = useConvexMutation(api.sessions.submitAnswer)
  const clearAnswer = useConvexMutation(api.sessions.clearAnswer)
  const completeSession = useConvexMutation(api.sessions.completeSession)

  const query = useQuery(sessionQuery(sessionId))
  const data = query.data
  const session = data?.session ?? null
  const questions = data?.questions ?? []

  const workRef = useRef<HTMLDivElement | null>(null)
  const stimulusRef = useRef<HTMLDetailsElement | null>(null)

  useEffect(() => {
    questionStartedAtRef.current = Date.now()
    // Both panels go back to the top on a question change. Keeping the previous
    // offset opened the next question already scrolled past its own stem.
    workRef.current?.scrollTo({ top: 0 })
    stimulusRef.current?.scrollTo({ top: 0 })
  }, [currentIndex])

  // Once the session is complete, hand off to the review surface.
  useEffect(() => {
    if (session?.status === 'completed') {
      onCompleted(sessionId)
    }
  }, [onCompleted, session?.status, sessionId])

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: sessionQuery(sessionId).queryKey })
  }, [queryClient, sessionId])

  // Drop optimistic entries the server has confirmed. Comparing against the
  // fetched row rather than clearing on success keeps the card from flickering
  // back to unselected in the gap between the mutation resolving and the query
  // returning the new value.
  useEffect(() => {
    if (questions.length === 0) return
    setPending((current) => {
      let changed = false
      const next = { ...current }
      for (const question of questions) {
        const local = next[question.sessionQuestionId]
        if (local == null) continue
        const server = question.attempt?.selectedOption ?? null
        const serverConfidence = (question.attempt?.confidence ?? undefined) as
          | ConfidenceLevel
          | undefined
        if (local.selectedOption === server && local.confidence === serverConfidence) {
          delete next[question.sessionQuestionId]
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [questions])

  const answerMutation = useMutation({
    mutationFn: async (input: { selectedOption: string; confidence?: ConfidenceLevel }) => {
      const current = questions[currentIndex]
      if (session == null || current == null) throw new Error('Pregunta no cargada.')
      return submitAnswer({
        sessionId: session._id,
        sessionQuestionId: current.sessionQuestionId as never,
        selectedOption: input.selectedOption,
        responseTimeMs: Date.now() - questionStartedAtRef.current,
        confidence: input.confidence,
      })
    },
    onSuccess: invalidate,
  })

  const clearMutation = useMutation({
    mutationFn: async () => {
      const current = questions[currentIndex]
      if (session == null || current == null) throw new Error('Pregunta no cargada.')
      return clearAnswer({
        sessionId: session._id,
        sessionQuestionId: current.sessionQuestionId as never,
      })
    },
    onSuccess: invalidate,
  })

  const completeMutation = useMutation({
    mutationFn: async (input: { expired?: boolean }) => {
      if (session == null) throw new Error('Sesión no cargada.')
      return completeSession({ sessionId: session._id, expired: input.expired })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      onCompleted(sessionId)
    },
  })

  const completePendingRef = useRef(false)
  const handleExpire = useCallback(() => {
    if (completePendingRef.current) return
    completePendingRef.current = true
    completeMutation.mutate({ expired: true })
  }, [completeMutation])

  const timer = useSessionTimer({
    startedAt: session?.startedAt ?? Date.now(),
    expiresAt: session?.expiresAt ?? null,
    timeLimitMs: session?.timeLimitMs ?? null,
    onExpire: handleExpire,
  })

  const current = questions[currentIndex]
  const answeredOf = useCallback(
    (question: (typeof questions)[number]) =>
      pending[question.sessionQuestionId]?.selectedOption
      ?? question.attempt?.selectedOption
      ?? null,
    [pending],
  )
  const answeredCount = questions.filter((q) => answeredOf(q) != null).length
  const isLast = currentIndex === questions.length - 1
  const isFirst = currentIndex === 0

  const goPrev = useCallback(() => setCurrentIndex((v) => Math.max(0, v - 1)), [])
  const goNext = useCallback(
    () => setCurrentIndex((v) => Math.min(questions.length - 1, v + 1)),
    [questions.length],
  )

  const selectOption = useCallback(
    (label: string) => {
      const key = current?.sessionQuestionId
      if (key == null) return
      const selected = pending[key]?.selectedOption ?? current?.attempt?.selectedOption ?? null

      if (selected === label) {
        setPending((value) => ({ ...value, [key]: { selectedOption: null } }))
        clearMutation.mutate()
      } else {
        setPending((value) => ({ ...value, [key]: { selectedOption: label } }))
        answerMutation.mutate({ selectedOption: label })
      }
    },
    [answerMutation, clearMutation, current?.attempt?.selectedOption, current?.sessionQuestionId, pending],
  )

  // Declaring confidence re-submits the same answer: one mutation, one source of
  // truth, and no way for the two to drift apart.
  const declareConfidence = useCallback(
    (confidence: ConfidenceLevel) => {
      const key = current?.sessionQuestionId
      if (key == null) return
      const selected = pending[key]?.selectedOption ?? current?.attempt?.selectedOption ?? null
      if (selected == null) return
      setPending((value) => ({ ...value, [key]: { selectedOption: selected, confidence } }))
      answerMutation.mutate({ selectedOption: selected, confidence })
    },
    [answerMutation, current?.attempt?.selectedOption, current?.sessionQuestionId, pending],
  )

  const finish = useCallback(() => {
    if (completeMutation.isPending) return
    if (answeredCount < questions.length) {
      const remaining = questions.length - answeredCount
      const ok =
        typeof window === 'undefined' ||
        window.confirm(
          `Te ${remaining === 1 ? 'queda' : 'quedan'} ${remaining} pregunta${remaining === 1 ? '' : 's'} sin responder. ¿Terminar de todas formas?`,
        )
      if (!ok) return
    }
    completeMutation.mutate({})
  }, [answeredCount, completeMutation, questions.length])

  // Keyboard: A–D to answer, arrows to navigate.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'Escape' && isMapOpen) {
        event.preventDefault()
        setIsMapOpen(false)
        return
      }
      if (event.key === 'ArrowLeft') {
        goPrev()
        return
      }
      if (event.key === 'ArrowRight') {
        goNext()
        return
      }
      const upper = event.key.toUpperCase()
      if (upper.length === 1 && upper >= 'A' && upper <= 'Z' && current != null) {
        const match = current.question.options.find((option) => option.label === upper)
        if (match != null) {
          event.preventDefault()
          selectOption(match.label)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, goNext, goPrev, isMapOpen, selectOption])

  if (query.isPending || session == null) {
    return (
      <div className="solve-loading">
        <p>Preparando tu sesión…</p>
      </div>
    )
  }

  if (current == null) {
    return (
      <div className="solve-loading">
        <MascotMessage
          mood="idle"
          title="No pudimos armar esta sesión"
          action={
            <button type="button" className="btn-primary" onClick={onExit}>
              Volver
            </button>
          }
        >
          No hay preguntas disponibles para esta combinación todavía.
        </MascotMessage>
      </div>
    )
  }

  const KindIcon = getKindIcon(session.kind)
  const optimistic = pending[current.sessionQuestionId]
  const selectedOption = optimistic?.selectedOption ?? current.attempt?.selectedOption ?? null
  const declaredConfidence = (optimistic?.confidence
    ?? current.attempt?.confidence
    ?? null) as ConfidenceLevel | null
  const progress = questions.length === 0 ? 0 : (answeredCount / questions.length) * 100
  const lowTime = timer.timed && timer.remainingMs != null && timer.remainingMs <= 60_000

  return (
    <div className="solve fade-in">
      <header className="solve-topbar">
        <div className="solve-meta">
          <span className="solve-kind">
            <KindIcon size={15} />
            {getKindLabel(session.kind)}
          </span>
          <span className="chip chip-accent">
            {getSubjectLabel(current.question.subjectId ?? 'sin_asignar')}
          </span>
        </div>

        <div className="solve-progress">
          <strong>{currentIndex + 1}</strong>
          <span>/ {questions.length}</span>
          <div className="solve-progress-track" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="solve-actions">
          {timer.timed ? (
            <span className={`solve-clock${lowTime ? ' is-low' : ''}`} aria-live="polite">
              <Hourglass size={15} />
              {formatClock(timer.remainingMs ?? 0)}
            </span>
          ) : (
            <span className="solve-clock is-muted">
              <Timer size={15} />
              {formatClock(timer.elapsedMs)}
            </span>
          )}
          <button
            type="button"
            className="solve-icon-btn"
            onClick={onExit}
            aria-label="Salir de la sesión"
            title="Salir"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <main className={`solve-main${current.group != null ? ' is-split' : ''}`}>
        {current.group != null ? (
          <SharedStimulus group={current.group} panelRef={stimulusRef} />
        ) : null}

        <div className="solve-work" ref={workRef}>
        <article className="solve-question">
          <MarkdownBlock markdown={current.question.bodyMarkdown} />
        </article>

        <div className="solve-options" role="group" aria-label="Opciones de respuesta">
          {current.question.options.map((option) => {
            const isSelected = selectedOption === option.label
            return (
              <button
                key={option.label}
                type="button"
                disabled={completeMutation.isPending}
                onClick={() => selectOption(option.label)}
                className={`option-card solve-option${isSelected ? ' is-selected' : ''}`}
              >
                <span className="option-label">{option.label}</span>
                <span className="min-w-0 flex-1 text-left">
                  <MarkdownBlock markdown={option.bodyMarkdown} />

                </span>
              </button>
            )
          })}
        </div>

        {selectedOption != null ? (
          <div className="confidence-strip fade-in">
            <span className="confidence-strip-label">¿Qué tan seguro estás?</span>
            <div className="confidence-strip-options" role="group" aria-label="Nivel de confianza">
              {CONFIDENCE_OPTIONS.map((option) => {
                const isActive = declaredConfidence === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => declareConfidence(option.value)}
                    className={`confidence-chip${isActive ? ' is-active' : ''}`}
                    aria-pressed={isActive}
                    title={option.help}
                  >
                    <span aria-hidden>{option.emoji}</span>
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {answerMutation.error || clearMutation.error || completeMutation.error ? (
          <div className="stage-alert">
            {readConvexError(
              answerMutation.error || clearMutation.error || completeMutation.error,
              'No se pudo guardar el progreso.',
            )}
          </div>
        ) : null}

        <p className="solve-hint" aria-hidden>
          <kbd>A</kbd>
          <kbd>B</kbd>
          <kbd>C</kbd>
          <kbd>D</kbd>
          <span>responder</span>
          <span className="solve-hint-sep">·</span>
          <kbd>←</kbd>
          <kbd>→</kbd>
          <span>navegar</span>
        </p>
        </div>
      </main>

      <footer className="solve-footer">
        <button
          type="button"
          className="solve-nav-btn"
          disabled={isFirst}
          onClick={goPrev}
        >
          <ChevronLeft size={16} />
          <span className="max-sm:hidden">Anterior</span>
        </button>

        {/* A dot per question worked at 15 and fell apart past that; a simulacro
            runs 120-134, where a single row of dots is neither scannable nor
            clickable. The map moves into a panel that only opens on demand, as
            a numbered grid — 134 numbers in a grid can be read, 134 dots in a
            strip cannot. Progress itself already lives in the header. */}
        <div className="solve-map-wrap">
          <button
            type="button"
            className="solve-map-toggle"
            onClick={() => setIsMapOpen((open) => !open)}
            aria-expanded={isMapOpen}
            aria-controls="solve-map-panel"
          >
            <LayoutGrid size={15} />
            <span>
              <strong>{answeredCount}</strong>/{questions.length}
            </span>
            <span className="max-sm:hidden">respondidas</span>
          </button>

          {isMapOpen ? (
            <>
              <button
                type="button"
                className="solve-map-scrim"
                aria-label="Cerrar el mapa de preguntas"
                onClick={() => setIsMapOpen(false)}
              />
              <div className="solve-map-panel" id="solve-map-panel">
                <p className="solve-map-legend">
                  <span className="solve-map-key is-answered" aria-hidden /> respondida
                  <span className="solve-map-key" aria-hidden /> sin responder
                </p>
                <nav
                  className="solve-map-grid"
                  aria-label={`${answeredCount} de ${questions.length} respondidas`}
                >
                  {questions.map((question, index) => (
                    <button
                      key={question.sessionQuestionId}
                      type="button"
                      className={[
                        'solve-map-cell',
                        answeredOf(question) != null ? 'is-answered' : '',
                        index === currentIndex ? 'is-current' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        setCurrentIndex(index)
                        setIsMapOpen(false)
                      }}
                      aria-label={`Ir a la pregunta ${index + 1}`}
                      aria-current={index === currentIndex ? 'true' : undefined}
                    >
                      {index + 1}
                    </button>
                  ))}
                </nav>
              </div>
            </>
          ) : null}
        </div>

        {isLast ? (
          <button
            type="button"
            className="btn-primary"
            disabled={completeMutation.isPending}
            onClick={finish}
          >
            {completeMutation.isPending ? 'Terminando…' : 'Terminar'}
          </button>
        ) : (
          <button type="button" className="solve-nav-btn is-primary" onClick={goNext}>
            <span className="max-sm:hidden">Siguiente</span>
            <ChevronRight size={16} />
          </button>
        )}
      </footer>
    </div>
  )
}
