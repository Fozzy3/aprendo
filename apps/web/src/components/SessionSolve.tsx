import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, type ShouldBlockFn } from '@tanstack/react-router'
import {
  AArrowDown,
  AArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  EyeOff,
  Flag,
  Gauge,
  Hourglass,
  LayoutGrid,
  MessageSquareWarning,
  Strikethrough,
  Timer,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { ConvexError } from 'convex/values'
import { api } from '@aprendo/convex/api'
import { MarkdownBlock } from './MarkdownBlock.tsx'
import { CONFIDENCE_OPTIONS, type ConfidenceLevel } from '../lib/confidence-display.ts'
import { SharedStimulus } from './SharedStimulus.tsx'
import { sessionQuery } from '../lib/student-queries.ts'
import { getKindIcon, getKindLabel } from '../lib/session-display.ts'
import { formatClock, useSessionTimer } from '../lib/use-session-timer.ts'
import { getSubjectLabel } from '@aprendo/convex/taxonomy'
import { EmptyState } from './EmptyState.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import type { QueueItem, QuestionOverlay } from '../lib/answer-queue.ts'
import { useAnswerQueue } from '../lib/use-answer-queue.ts'
import { paceStatus } from '@aprendo/convex/pacing'
import { canCheckAnswers } from '@aprendo/convex/sessionIntegrity'
import { paceDescription, paceLabel } from '../lib/pacing-display.ts'
import {
  TEXT_SCALES,
  checkWorkSummary,
  firstUnansweredIndex,
  isClosedOnLoad,
  parseTextScale,
  readStored,
  stepTextScale,
  toggleLabel,
  writeStored,
} from '../lib/solve-state.ts'
import { QuestionNavigator } from './QuestionNavigator.tsx'
import { CheckYourWork } from './CheckYourWork.tsx'
import { ReportProblemSheet } from './ReportProblemSheet.tsx'
import { AnswerFeedback } from './AnswerFeedback.tsx'
import { answerFeedback } from '../lib/answer-feedback.ts'

type SessionSolveProps = {
  sessionId: string
  onExit: () => void
  onCompleted: (sessionId: string) => void
}

const CLOCK_HIDDEN_KEY = 'aprendo:solve-clock-hidden'
const TEXT_SCALE_KEY = 'aprendo:solve-text-scale'
/** The proctor's "quedan 5 minutos"; the clock also comes back on if hidden. */
const WARN_BEFORE_MS = 5 * 60_000
const LONG_PRESS_MS = 500

type ServerQuestion = {
  attempt: { selectedOption?: string; confidence?: string } | null
  flagged: boolean
  eliminatedOptions: string[]
}

/** What a question shows: the server's state with any unsent writes laid over it. */
function questionView(question: ServerQuestion, local: QuestionOverlay | undefined) {
  const answerIsLocal = local != null && 'selectedOption' in local
  return {
    selectedOption: answerIsLocal ? local.selectedOption ?? null : question.attempt?.selectedOption ?? null,
    confidence: ((answerIsLocal ? local.confidence : question.attempt?.confidence) ?? null) as
      | ConfidenceLevel
      | null,
    flagged: local?.flagged ?? question.flagged,
    eliminated: local?.eliminatedOptions ?? question.eliminatedOptions,
  }
}

/**
 * The single solve surface used by every session kind (diagnostic,
 * recommended, topic, simulacro). It shows one question at a time, never
 * discloses answers — except, in an immediate-feedback practice, the answer
 * the student checks and so locks — and, for timed kinds, counts down and
 * auto-submits when the clock runs out. Routes wrap this in whatever chrome they need.
 *
 * The exam tools are the paper habits of Saber 11 brought on screen: marking a
 * question to come back to (circling its number), crossing out options (pencil
 * strokes), a map of the whole booklet, a last look before handing it in, and
 * a clock that can be hidden like a watch in a pocket.
 */
export function SessionSolve({ sessionId, onExit, onCompleted }: SessionSolveProps) {
  const queryClient = useQueryClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isFlushing, setIsFlushing] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [clockHidden, setClockHidden] = useState(() => readStored(CLOCK_HIDDEN_KEY) === '1')
  const [textScale, setTextScale] = useState(() => parseTextScale(readStored(TEXT_SCALE_KEY)))
  const questionStartedAtRef = useRef(Date.now())

  const submitAnswer = useConvexMutation(api.sessions.submitAnswer)
  const clearAnswer = useConvexMutation(api.sessions.clearAnswer)
  const setQuestionFlag = useConvexMutation(api.sessions.setQuestionFlag)
  const setEliminatedOptions = useConvexMutation(api.sessions.setEliminatedOptions)
  const recordQuestionTime = useConvexMutation(api.sessions.recordQuestionTime)
  const completeSession = useConvexMutation(api.sessions.completeSession)
  const checkAnswer = useConvexMutation(api.sessions.checkAnswer)

  const query = useQuery(sessionQuery(sessionId))
  const data = query.data
  const session = data?.session ?? null
  const questions = data?.questions ?? []

  const workRef = useRef<HTMLDivElement | null>(null)
  const stimulusRef = useRef<HTMLDetailsElement | null>(null)

  // Answers, flags and crossed-out options all go through the offline-safe
  // queue: applied on screen at once, sent in order, kept across a reload.
  const send = useCallback(
    (item: QueueItem) => {
      const ids = {
        sessionId: sessionId as never,
        sessionQuestionId: item.sessionQuestionId as never,
      }
      switch (item.type) {
        case 'answer':
          return submitAnswer({
            ...ids,
            selectedOption: item.selectedOption,
            responseTimeMs: item.responseTimeMs,
            confidence: item.confidence,
          })
        case 'clear':
          return clearAnswer(ids)
        case 'flag':
          return setQuestionFlag({ ...ids, flagged: item.flagged })
        case 'eliminate':
          return setEliminatedOptions({ ...ids, options: item.options })
      }
    },
    [clearAnswer, sessionId, setEliminatedOptions, setQuestionFlag, submitAnswer],
  )
  const queue = useAnswerQueue(sessionId, send)

  // "Comprobar": the answer has to be on the server before it can be graded,
  // so any unsent write goes first. The graded question then comes back
  // unsealed through `getSession`, which is what the feedback renders from.
  const [justCheckedId, setJustCheckedId] = useState<string | null>(null)
  const checkMutation = useMutation({
    mutationFn: async (sessionQuestionId: string) => {
      await queue.flush(10_000)
      return checkAnswer({
        sessionId: sessionId as never,
        sessionQuestionId: sessionQuestionId as never,
      })
    },
    onSuccess: (_result, sessionQuestionId) => setJustCheckedId(sessionQuestionId),
  })
  const views = questions.map((question) =>
    questionView(question, queue.overlay.get(question.sessionQuestionId)))

  // When the page first saw the session: a sitting that was already past its
  // deadline then is shown as expired, never auto-completed (see solve-state).
  // `closedLate` is the same moment seen later: a phone that slept past the
  // deadline wakes to a clock the server no longer scores.
  const firstSeenAtRef = useRef<number | null>(null)
  if (session != null && firstSeenAtRef.current == null) firstSeenAtRef.current = Date.now()
  const [closedLate, setClosedLate] = useState(false)
  const isClosed = session != null
    && (closedLate || isClosedOnLoad(session, firstSeenAtRef.current ?? Date.now()))
  const isOpen = session != null && !isClosed
    && (session.status === 'in_progress' || session.status === 'created')

  // Reopening a session lands on the first question still blank, not on 1.
  const hasResumedRef = useRef(false)
  useEffect(() => {
    if (hasResumedRef.current || questions.length === 0) return
    hasResumedRef.current = true
    setCurrentIndex(firstUnansweredIndex(views.map((view) => view.selectedOption != null)))
  }, [questions.length, views])

  useEffect(() => {
    questionStartedAtRef.current = Date.now()
    setJustCheckedId(null)
    // Both panels go back to the top on a question change. Keeping the previous
    // offset opened the next question already scrolled past its own stem.
    workRef.current?.scrollTo({ top: 0 })
    stimulusRef.current?.scrollTo({ top: 0 })
  }, [currentIndex])

  // Once the session is complete, hand off to the review surface — once. The
  // parent passes a new callback on every render, and it re-renders on every
  // router write while the review loads: each extra call restarted that
  // navigation, and the tab froze after "Entregar".
  const handedOffRef = useRef(false)
  const handOff = useCallback(() => {
    if (handedOffRef.current) return
    handedOffRef.current = true
    onCompleted(sessionId)
  }, [onCompleted, sessionId])
  useEffect(() => {
    if (session?.status === 'completed') handOff()
  }, [handOff, session?.status])

  const current = questions[currentIndex]
  const currentQuestionId = current?.sessionQuestionId ?? null

  // The next sheet is already loaded when the student turns the page: its
  // scanned stem (the only slow part) is fetched while they work on this one.
  const nextStemImageUrl = questions[currentIndex + 1]?.stemImageUrl ?? null
  useEffect(() => {
    if (nextStemImageUrl == null) return
    new Image().src = nextStemImageUrl
  }, [nextStemImageUrl])

  // Time on each question, per visit: started when it is on screen, sent when
  // it leaves (another question, the review step, leaving, a hidden tab).
  // Fire-and-forget — after the deadline the server refuses it like an answer.
  const reportTimeRef = useRef<() => void>(() => {})
  const visibleQuestionId = isOpen && !isChecking ? currentQuestionId : null
  useEffect(() => {
    if (visibleQuestionId == null) return
    let visibleSince: number | null = document.visibilityState === 'visible' ? Date.now() : null
    const report = () => {
      if (visibleSince == null) return
      const elapsedMs = Date.now() - visibleSince
      visibleSince = document.visibilityState === 'visible' ? Date.now() : null
      if (elapsedMs < 1_000) return
      recordQuestionTime({
        sessionId: sessionId as never,
        sessionQuestionId: visibleQuestionId as never,
        elapsedMs,
      }).catch(() => {})
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report()
      else visibleSince = Date.now()
    }
    reportTimeRef.current = report
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      report()
      reportTimeRef.current = () => {}
    }
  }, [recordQuestionTime, sessionId, visibleQuestionId])

  const completeMutation = useMutation({
    mutationFn: async (input: { expired?: boolean }) =>
      completeSession({ sessionId: sessionId as never, expired: input.expired }),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      handOff()
    },
    // A time-out the server refuses on purpose (too late, or the session was
    // closed elsewhere) will never be scored: say so instead of a dead screen.
    onError: (error, input) => {
      if (input.expired === true && error instanceof ConvexError) setClosedLate(true)
    },
  })

  // Every unsent answer reaches the server before the sitting is scored. A
  // dead connection does not block forever: the completion is queued too.
  const finishSession = useCallback(
    async (expired: boolean) => {
      setIsFlushing(true)
      await queue.flush(expired ? 8_000 : 20_000)
      setIsFlushing(false)
      reportTimeRef.current()
      completeMutation.mutate(expired ? { expired: true } : {})
    },
    [completeMutation, queue],
  )

  const completePendingRef = useRef(false)
  const handleExpire = useCallback(() => {
    if (completePendingRef.current) return
    completePendingRef.current = true
    if (session != null && isClosedOnLoad(session, Date.now())) {
      setClosedLate(true)
      return
    }
    void finishSession(true)
  }, [finishSession, session])

  const handleWarn = useCallback(() => {
    setShowWarning(true)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 100, 200])
    }
  }, [])

  useEffect(() => {
    if (!showWarning) return
    const id = window.setTimeout(() => setShowWarning(false), 8_000)
    return () => window.clearTimeout(id)
  }, [showWarning])

  const timer = useSessionTimer({
    startedAt: session?.startedAt ?? Date.now(),
    expiresAt: session?.expiresAt ?? null,
    timeLimitMs: session?.timeLimitMs ?? null,
    onExpire: isOpen ? handleExpire : undefined,
    warnBeforeMs: WARN_BEFORE_MS,
    onWarn: isOpen ? handleWarn : undefined,
  })

  // Leaving never pauses a timed session — `expiresAt` is a server timestamp —
  // so say so before the student walks away, whichever way they leave: the X,
  // a header link, or the phone's back gesture. Untimed sessions leave freely.
  const guardsLeaving = timer.timed && isOpen
  const remainingMsRef = useRef(timer.remainingMs)
  remainingMsRef.current = timer.remainingMs
  const hasConfirmedLeaveRef = useRef(false)
  const confirmLeave = useCallback(
    () =>
      typeof window === 'undefined'
      || window.confirm(
        `El reloj sigue corriendo aunque salgas: te quedan ${formatClock(remainingMsRef.current ?? 0)}. Puedes volver y seguir mientras quede tiempo. ¿Salir de todas formas?`,
      ),
    [],
  )
  const shouldBlockLeave = useCallback<ShouldBlockFn>(
    ({ next }) => {
      // Finishing (or running out of time) hands off to the review: not leaving.
      if (hasConfirmedLeaveRef.current || next.pathname.endsWith('/review')) return false
      return !confirmLeave()
    },
    [confirmLeave],
  )
  useBlocker({
    shouldBlockFn: shouldBlockLeave,
    disabled: !guardsLeaving,
    enableBeforeUnload: false,
  })
  const exit = () => {
    if (guardsLeaving && !confirmLeave()) return
    hasConfirmedLeaveRef.current = true
    onExit()
  }

  const view = current == null ? null : views[currentIndex]
  const answeredCount = views.filter((item) => item.selectedOption != null).length
  const isLast = currentIndex === questions.length - 1
  const isFirst = currentIndex === 0
  const isFinishing = isFlushing || completeMutation.isPending
  const locked = !isOpen || isFinishing
  // Immediate feedback only where the kind allows it: never an exam or a reto.
  const immediate = session != null && canCheckAnswers(session)
  const isChecked = immediate && current?.attempt?.checkedAt != null
  // A checked answer has seen its key: it can no longer change.
  const answerLocked = locked || isChecked || checkMutation.isPending

  const goTo = useCallback(
    (index: number) => {
      setIsChecking(false)
      setIsMapOpen(false)
      setCurrentIndex(Math.min(questions.length - 1, Math.max(0, index)))
    },
    [questions.length],
  )
  const goPrev = useCallback(() => setCurrentIndex((v) => Math.max(0, v - 1)), [])
  const goNext = useCallback(
    () => setCurrentIndex((v) => Math.min(questions.length - 1, v + 1)),
    [questions.length],
  )

  const optionOrder = useCallback(
    (labels: string[]) =>
      (current?.question.options ?? [])
        .map((option) => option.label)
        .filter((label) => labels.includes(label)),
    [current],
  )

  const selectOption = useCallback(
    (label: string) => {
      if (current == null || view == null || answerLocked) return
      const sessionQuestionId = current.sessionQuestionId
      // Picking a crossed-out option takes the stroke off: the student changed
      // their mind about it.
      if (view.eliminated.includes(label)) {
        queue.push({
          type: 'eliminate',
          sessionQuestionId,
          options: view.eliminated.filter((value) => value !== label),
        })
      }
      if (view.selectedOption === label) {
        queue.push({ type: 'clear', sessionQuestionId })
      } else {
        queue.push({
          type: 'answer',
          sessionQuestionId,
          selectedOption: label,
          responseTimeMs: Date.now() - questionStartedAtRef.current,
        })
      }
    },
    [answerLocked, current, queue, view],
  )

  // Declaring confidence re-submits the same answer: one mutation, one source of
  // truth, and no way for the two to drift apart.
  const declareConfidence = useCallback(
    (confidence: ConfidenceLevel) => {
      if (current == null || view?.selectedOption == null || answerLocked) return
      queue.push({
        type: 'answer',
        sessionQuestionId: current.sessionQuestionId,
        selectedOption: view.selectedOption,
        responseTimeMs: Date.now() - questionStartedAtRef.current,
        confidence,
      })
    },
    [answerLocked, current, queue, view?.selectedOption],
  )

  const toggleFlag = useCallback(() => {
    if (current == null || view == null || locked) return
    queue.push({ type: 'flag', sessionQuestionId: current.sessionQuestionId, flagged: !view.flagged })
  }, [current, locked, queue, view])

  const toggleEliminated = useCallback(
    (label: string) => {
      if (current == null || view == null || answerLocked) return
      const options = optionOrder(toggleLabel(view.eliminated, label))
      queue.push({ type: 'eliminate', sessionQuestionId: current.sessionQuestionId, options })
      // A struck-out answer is no answer.
      if (options.includes(label) && view.selectedOption === label) {
        queue.push({ type: 'clear', sessionQuestionId: current.sessionQuestionId })
      }
    },
    [answerLocked, current, optionOrder, queue, view],
  )

  // Long-press an option to cross it out, as a pencil stroke would. The click
  // that ends the press must not also select it.
  const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null)
  const longPressedRef = useRef(false)
  const cancelPress = () => {
    if (pressRef.current != null) window.clearTimeout(pressRef.current.timer)
    pressRef.current = null
  }
  const startPress = (label: string, event: PointerEvent) => {
    if (answerLocked || (event.pointerType === 'mouse' && event.button !== 0)) return
    cancelPress()
    longPressedRef.current = false
    pressRef.current = {
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => {
        longPressedRef.current = true
        pressRef.current = null
        toggleEliminated(label)
        if (typeof navigator.vibrate === 'function') navigator.vibrate(15)
      }, LONG_PRESS_MS),
    }
  }
  const movePress = (event: PointerEvent) => {
    const press = pressRef.current
    if (press != null && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelPress()
  }

  const toggleClock = () => {
    setClockHidden((hidden) => {
      writeStored(CLOCK_HIDDEN_KEY, hidden ? null : '1')
      return !hidden
    })
  }
  const changeTextScale = (direction: 1 | -1) => {
    setTextScale((scale) => {
      const next = stepTextScale(scale, direction)
      writeStored(TEXT_SCALE_KEY, next === 1 ? null : String(next))
      return next
    })
  }

  const openCheck = useCallback(() => {
    setIsMapOpen(false)
    setIsChecking(true)
  }, [])

  // Keyboard: A–D to answer, arrows to navigate, F to mark for review.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      if (isMapOpen || isReportOpen || isChecking) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      ) {
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
        } else if (upper === 'F') {
          event.preventDefault()
          toggleFlag()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, goNext, goPrev, isChecking, isMapOpen, isReportOpen, selectOption, toggleFlag])

  if (query.isPending || session == null) {
    return (
      <div className="solve-loading">
        <p>Preparando tu sesión…</p>
      </div>
    )
  }

  if (isClosed) {
    return (
      <div className="solve-loading">
        <EmptyState
          title="Esta sesión venció"
          action={
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                hasConfirmedLeaveRef.current = true
                onExit()
              }}
            >
              Elegir una nueva sesión
            </button>
          }
        >
          Se le acabó el tiempo mientras no estabas, así que no la calificamos: unas pocas
          respuestas no dicen cuánto sabes. Empieza una nueva cuando tengas el tiempo completo.
        </EmptyState>
      </div>
    )
  }

  if (current == null || view == null) {
    return (
      <div className="solve-loading">
        <EmptyState
          title="No pudimos armar esta sesión"
          action={
            <button type="button" className="btn-primary" onClick={onExit}>
              Volver
            </button>
          }
        >
          No hay preguntas disponibles para esta combinación todavía.
        </EmptyState>
      </div>
    )
  }

  const KindIcon = getKindIcon(session.kind)
  const progress = questions.length === 0 ? 0 : (answeredCount / questions.length) * 100
  const lowTime = timer.timed && timer.remainingMs != null && timer.remainingMs <= 60_000
  // Hidden like a watch in a pocket — until the last five minutes, when the
  // proctor would announce them anyway.
  const inFinalMinutes = timer.timed && timer.remainingMs != null && timer.remainingMs <= WARN_BEFORE_MS
  const clockVisible = !clockHidden || inFinalMinutes
  const pace = timer.timed && clockVisible
    ? paceStatus({
        msPerQuestion: data?.officialMsPerQuestion ?? 135_000,
        elapsedMs: timer.elapsedMs,
        answeredCount,
      })
    : null
  const errorMessage = queue.error
    ?? (checkMutation.error != null && checkMutation.variables === current.sessionQuestionId
      ? readConvexError(checkMutation.error, 'No se pudo comprobar tu respuesta. Revisa tu conexión e inténtalo de nuevo.')
      : null)
    ?? (completeMutation.error
      ? readConvexError(completeMutation.error, 'No se pudo entregar la sesión.')
      : null)
  const feedback = isChecked && current.attempt?.selectedOption != null
    ? answerFeedback(current.question, current.attempt.selectedOption)
    : null
  const submitLabel = isFlushing
    ? 'Guardando respuestas…'
    : completeMutation.isPending
      ? 'Entregando…'
      : 'Entregar'

  return (
    <div
      className="solve fade-in"
      style={{ '--solve-text-scale': textScale } as CSSProperties}
    >
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
          <button
            type="button"
            className={`solve-clock${lowTime ? ' is-low' : ''}${timer.timed ? '' : ' is-muted'}`}
            onClick={toggleClock}
            disabled={inFinalMinutes}
            aria-label={
              clockVisible
                ? `${timer.timed ? 'Tiempo restante' : 'Tiempo'} ${formatClock(timer.timed ? timer.remainingMs ?? 0 : timer.elapsedMs)}. Ocultar el reloj`
                : 'Mostrar el reloj'
            }
            title={clockVisible ? 'Ocultar el reloj' : 'Mostrar el reloj'}
          >
            {clockVisible ? (
              <>
                {timer.timed ? <Hourglass size={15} aria-hidden /> : <Timer size={15} aria-hidden />}
                {formatClock(timer.timed ? timer.remainingMs ?? 0 : timer.elapsedMs)}
              </>
            ) : (
              <>
                <EyeOff size={15} aria-hidden />
                <span className="max-sm:sr-only">Reloj</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="solve-icon-btn"
            onClick={exit}
            aria-label="Salir de la sesión"
            title="Salir"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {queue.isOffline && queue.pendingCount > 0 ? (
        <p className="solve-offline" role="status">
          <CloudOff size={14} aria-hidden />
          Sin conexión · tus respuestas se guardan
        </p>
      ) : null}

      {showWarning ? (
        <div className="solve-toast" role="alert">
          <Hourglass size={16} aria-hidden />
          <span>
            <strong>Quedan 5 minutos.</strong> No dejes preguntas en blanco: adivinar puede sumar.
          </span>
          <button
            type="button"
            className="solve-icon-btn"
            aria-label="Cerrar el aviso"
            onClick={() => setShowWarning(false)}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {isChecking ? (
        <CheckYourWork
          questionCount={questions.length}
          summary={checkWorkSummary(
            views.map((item) => ({ answered: item.selectedOption != null, flagged: item.flagged })),
          )}
          isSubmitting={isFinishing}
          submitLabel={submitLabel}
          onJump={goTo}
          onBack={() => setIsChecking(false)}
          onSubmit={() => {
            if (isFinishing || !isOpen) return
            void finishSession(false)
          }}
        />
      ) : (
        <>
          <main className={`solve-main${current.group != null ? ' is-split' : ''}`}>
            {current.group != null ? (
              <SharedStimulus group={current.group} panelRef={stimulusRef} />
            ) : null}

            <div className="solve-work sheet" ref={workRef}>
              <div className="solve-qbar">
                <span
                  className={`solve-number${view.flagged ? ' is-marked' : ''}`}
                  aria-label={`Pregunta ${currentIndex + 1}${view.flagged ? ', marcada para revisar' : ''}`}
                >
                  {currentIndex + 1}
                </span>
                {pace != null ? (
                  <span
                    className={`solve-pace is-${pace.status}`}
                    title={paceDescription(pace, data?.officialMsPerQuestion ?? 135_000)}
                  >
                    <Gauge size={14} aria-hidden />
                    {paceLabel(pace)}
                    <span className="sr-only">
                      {paceDescription(pace, data?.officialMsPerQuestion ?? 135_000)}
                    </span>
                  </span>
                ) : (
                  <span />
                )}
                <div className="solve-textsize" role="group" aria-label="Tamaño del texto">
                  <button
                    type="button"
                    className="solve-icon-btn"
                    onClick={() => changeTextScale(-1)}
                    disabled={textScale === TEXT_SCALES[0]}
                    aria-label="Texto más pequeño"
                    title="Texto más pequeño"
                  >
                    <AArrowDown size={18} />
                  </button>
                  <button
                    type="button"
                    className="solve-icon-btn"
                    onClick={() => changeTextScale(1)}
                    disabled={textScale === TEXT_SCALES[TEXT_SCALES.length - 1]}
                    aria-label="Texto más grande"
                    title="Texto más grande"
                  >
                    <AArrowUp size={18} />
                  </button>
                </div>
              </div>

              <article className="solve-question">
                {current.stemImageUrl != null ? (
                  /* The stem as the booklet prints it, diagram included. The markdown
                     stays in the DOM but visually hidden: it is what a screen reader
                     announces, what find-in-page matches, and what the tutor is given
                     as context — the image only replaces the *look*. */
                  <>
                    <img
                      src={current.stemImageUrl}
                      alt=""
                      className="question-scan"
                      loading="lazy"
                    />
                    <span className="sr-only">{current.question.bodyMarkdown}</span>
                  </>
                ) : (
                  <MarkdownBlock markdown={current.question.bodyMarkdown} />
                )}
                <p className="question-source">{current.source.label}</p>
              </article>

              <div className="solve-options" role="group" aria-label="Opciones de respuesta">
                {current.question.options.map((option) => {
                  const isSelected = view.selectedOption === option.label
                  const isEliminated = view.eliminated.includes(option.label)
                  const isKey = feedback != null && option.label === feedback.correctOption
                  const isWrongPick = feedback != null && isSelected && !isKey
                  const stateClass = feedback == null
                    ? `${isSelected ? ' is-selected' : ''}${isEliminated ? ' is-eliminated' : ''}`
                    : `${isKey ? ' is-correct' : ''}${isWrongPick ? ' is-incorrect' : ''}`
                  return (
                    <div key={option.label} className="solve-option-row">
                      <button
                        type="button"
                        disabled={answerLocked}
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (longPressedRef.current) {
                            longPressedRef.current = false
                            return
                          }
                          selectOption(option.label)
                        }}
                        onPointerDown={(event) => startPress(option.label, event)}
                        onPointerMove={movePress}
                        onPointerUp={cancelPress}
                        onPointerLeave={cancelPress}
                        onPointerCancel={cancelPress}
                        onContextMenu={(event) => event.preventDefault()}
                        className={`option-card solve-option${stateClass}`}
                      >
                        <span className="option-label">{option.label}</span>
                        <span className="solve-option-body min-w-0 flex-1 text-left">
                          <MarkdownBlock markdown={option.bodyMarkdown} />
                          {isKey ? <span className="review-option-meta is-correct">Respuesta correcta</span> : null}
                          {isWrongPick ? <span className="review-option-meta is-incorrect">Tu respuesta</span> : null}
                        </span>
                        {isEliminated && feedback == null ? <span className="sr-only">(tachada)</span> : null}
                      </button>
                      {feedback != null ? null : (
                        <button
                          type="button"
                          className={`solve-strike${isEliminated ? ' is-active' : ''}`}
                          disabled={answerLocked}
                          aria-pressed={isEliminated}
                          aria-label={
                            isEliminated
                              ? `Quitar el tachado de la opción ${option.label}`
                              : `Tachar la opción ${option.label}`
                          }
                          title={isEliminated ? 'Quitar el tachado' : 'Tachar'}
                          onClick={() => toggleEliminated(option.label)}
                        >
                          {isEliminated ? <Undo2 size={16} /> : <Strikethrough size={16} />}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {view.selectedOption != null && feedback == null ? (
                <div className="confidence-strip fade-in">
                  <span className="confidence-strip-label">¿Qué tan seguro estás?</span>
                  <div className="confidence-strip-options" role="group" aria-label="Nivel de confianza">
                    {CONFIDENCE_OPTIONS.map((option) => {
                      const isActive = view.confidence === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={answerLocked}
                          onClick={() => declareConfidence(option.value)}
                          className={`confidence-chip${isActive ? ' is-active' : ''}`}
                          aria-pressed={isActive}
                          title={option.help}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {immediate && !isChecked && view.selectedOption != null ? (
                <div className="solve-verify">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={locked || checkMutation.isPending}
                    onClick={() => checkMutation.mutate(current.sessionQuestionId)}
                  >
                    <Check size={16} aria-hidden />
                    {checkMutation.isPending ? 'Comprobando…' : 'Comprobar'}
                  </button>
                </div>
              ) : null}

              {errorMessage != null ? (
                <div className="stage-alert" role="alert">
                  {errorMessage}
                </div>
              ) : null}

              {feedback != null ? (
                <AnswerFeedback
                  feedback={feedback}
                  explanationSource={current.question.explanationSource ?? null}
                  isLast={isLast}
                  scrollIntoView={justCheckedId === current.sessionQuestionId}
                  onNext={isLast ? openCheck : goNext}
                />
              ) : null}

              <div className="solve-question-foot">
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
                  <span className="solve-hint-sep">·</span>
                  <kbd>F</kbd>
                  <span>marcar</span>
                </p>
                <button
                  type="button"
                  className="solve-report-link"
                  onClick={() => setIsReportOpen(true)}
                >
                  <MessageSquareWarning size={14} aria-hidden />
                  Reportar un problema
                </button>
              </div>
            </div>
          </main>

          <footer className="solve-footer">
            <button
              type="button"
              className="solve-nav-btn"
              disabled={isFirst}
              onClick={goPrev}
              aria-label="Pregunta anterior"
            >
              <ChevronLeft size={16} aria-hidden />
              <span className="max-sm:hidden">Anterior</span>
            </button>

            <div className="solve-footer-tools">
              <button
                type="button"
                className="solve-map-toggle"
                onClick={() => setIsMapOpen(true)}
                aria-haspopup="dialog"
                aria-label={`Mapa de preguntas: ${answeredCount} de ${questions.length} respondidas`}
              >
                <LayoutGrid size={15} aria-hidden />
                <span>
                  <strong>{answeredCount}</strong>/{questions.length}
                </span>
              </button>
              <button
                type="button"
                className={`solve-flag-btn${view.flagged ? ' is-active' : ''}`}
                onClick={toggleFlag}
                disabled={locked}
                aria-pressed={view.flagged}
                aria-label="Marcar para revisar"
                title="Marcar para revisar (F)"
              >
                <Flag size={16} fill={view.flagged ? 'currentColor' : 'none'} aria-hidden />
                <span className="max-sm:hidden">{view.flagged ? 'Marcada' : 'Marcar'}</span>
              </button>
            </div>

            {isLast ? (
              <button type="button" className="btn-primary" disabled={locked} onClick={openCheck}>
                <ClipboardCheck size={16} aria-hidden />
                Revisar
              </button>
            ) : (
              <button
                type="button"
                className="solve-nav-btn is-primary"
                onClick={goNext}
                aria-label="Pregunta siguiente"
              >
                Siguiente
                <ChevronRight size={16} aria-hidden />
              </button>
            )}
          </footer>
        </>
      )}

      <QuestionNavigator
        open={isMapOpen}
        onOpenChange={setIsMapOpen}
        questions={views.map((item, index) => ({
          answered: item.selectedOption != null,
          flagged: item.flagged,
          groupId: questions[index]?.group?.id ?? null,
        }))}
        currentIndex={currentIndex}
        onJump={goTo}
        onReview={openCheck}
      />

      <ReportProblemSheet
        key={current.question._id}
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        questionId={current.question._id}
        sessionId={sessionId}
      />
    </div>
  )
}
