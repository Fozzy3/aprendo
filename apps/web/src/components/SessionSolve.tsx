import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBlocker, type ShouldBlockFn } from '@tanstack/react-router'
import * as Dialog from '@radix-ui/react-dialog'
import {
  AArrowDown,
  AArrowUp,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  Ellipsis,
  EyeOff,
  Flag,
  Gauge,
  Hourglass,
  LayoutGrid,
  Lightbulb,
  MessageSquareWarning,
  Strikethrough,
  Undo2,
  X,
} from 'lucide-react'
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { ConvexError } from 'convex/values'
import { api } from '@aprendo/convex/api'
import { MarkdownBlock } from './MarkdownBlock.tsx'
import { CONFIDENCE_OPTIONS, type ConfidenceLevel } from '../lib/confidence-display.ts'
import { SharedStimulus } from './SharedStimulus.tsx'
import { sessionQuery } from '../lib/student-queries.ts'
import { formatClock, useSessionTimer } from '../lib/use-session-timer.ts'
import { EmptyState } from './EmptyState.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import type { QueueItem, QuestionOverlay } from '../lib/answer-queue.ts'
import { useAnswerQueue } from '../lib/use-answer-queue.ts'
import { paceStatus } from '@aprendo/convex/pacing'
import { canCheckAnswers } from '@aprendo/convex/sessionIntegrity'
import { SESSION_KIND_CONFIG } from '@aprendo/convex/sessionKinds'
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
import { PageLoader } from './FullScreenLoader.tsx'
import { stopSpeaking } from '../lib/speech.ts'
import { confirmDialog } from './ConfirmDialog.tsx'
import { GuidedPath } from './GuidedPath.tsx'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { beadStates, guideQueryArgs, isSettled, optionMark, solveMoment, type GuideView, type OptionMark } from '../lib/solve-view.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'

// The chat stack is heavy (see ReviewTutor): fetched the first time the student opens it.
const ReviewTutor = lazy(() => import('./ReviewTutor.tsx'))
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
/** A reading passage is set smaller than a short question. */
const LONG_STEM = 240

const OPTION_CLASS: Record<OptionMark, string> = {
  none: '',
  selected: ' is-selected',
  eliminated: ' is-eliminated',
  wrong: ' is-incorrect',
  correct: ' is-correct',
}

type GuideAction = { type: 'choose'; choiceIndex: number } | { type: 'retry'; label: string } | { type: 'reveal' }

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
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  // Touch screens hide the strike buttons (a long press does it) until asked for.
  const [isStriking, setIsStriking] = useState(false)
  // Practice kinds open the tutor while solving (F31); it only gives hints before the key is out.
  const [isTutorOpen, setIsTutorOpen] = useState(false)
  const [hasOpenedTutor, setHasOpenedTutor] = useState(false)
  const [tutorDraft, setTutorDraft] = useState('')
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
  const answerGuideStep = useConvexMutation(api.guides.answerGuideStep)
  const retryGuidedAnswer = useConvexMutation(api.guides.retryGuidedAnswer)
  const revealGuidedAnswer = useConvexMutation(api.guides.revealGuidedAnswer)
  const takeGuideHint = useConvexMutation(api.guides.takeGuideHint)

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
  // so any unsent write goes first. A right answer then comes back unsealed
  // through `getSession`; a wrong one stays sealed and its guided path opens.
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

  // Reopening a session lands on the first question still to close, not on 1.
  const hasResumedRef = useRef(false)
  useEffect(() => {
    if (hasResumedRef.current || questions.length === 0) return
    hasResumedRef.current = true
    const canCheck = session != null && canCheckAnswers(session)
    setCurrentIndex(firstUnansweredIndex(views.map((item, index) => isSettled({
      immediate: canCheck,
      isAnswered: item.selectedOption != null,
      isChecked: questions[index]?.attempt?.checkedAt != null,
      hasKey: questions[index]?.question.answerCorrectOption != null,
    }))))
  }, [questions, session, views])

  useEffect(() => {
    questionStartedAtRef.current = Date.now()
    setJustCheckedId(null)
    setLastCorrect(null)
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

  // Immediate feedback only where the kind allows it: never an exam or a reto.
  const immediate = session != null && canCheckAnswers(session)
  const isChecked = immediate && current?.attempt?.checkedAt != null
  const guideArgs = current == null
    ? ('skip' as const)
    : guideQueryArgs({ immediate, isChecked, sessionId, sessionQuestionId: current.sessionQuestionId })
  const guideQuery = useQuery(convexQuery(api.guides.getGuideStep, guideArgs as never))
  const guide = guideArgs === 'skip' ? null : (guideQuery.data as GuideView | null | undefined)
  const moment = solveMoment({ immediate, isChecked, hasKey: current?.question.answerCorrectOption != null, guide })

  // Each tap on the path comes back through the reactive step; `correct` only
  // colours the line above the next prompt.
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const guideAction = useMutation({
    mutationFn: async (action: GuideAction) => {
      const ids = { sessionId: sessionId as never, sessionQuestionId: currentQuestionId as never }
      if (action.type === 'choose') return answerGuideStep({ ...ids, choiceIndex: action.choiceIndex })
      if (action.type === 'retry') return retryGuidedAnswer({ ...ids, selectedOption: action.label })
      return revealGuidedAnswer(ids)
    },
    onSuccess: (result) => {
      if (currentQuestionId != null) setJustCheckedId(currentQuestionId)
      setLastCorrect('correct' in result ? result.correct : null)
    },
  })

  // "Pista": a guiding question, by question; null is a question without one yet.
  const [hints, setHints] = useState<Record<string, string | null>>({})
  const hintMutation = useMutation({
    mutationFn: (sessionQuestionId: string) =>
      takeGuideHint({ sessionId: sessionId as never, sessionQuestionId: sessionQuestionId as never }),
    onSuccess: (result, sessionQuestionId) =>
      setHints((previous) => ({ ...previous, [sessionQuestionId]: result.hint })),
  })

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
      confirmDialog({
        title: 'El reloj sigue corriendo',
        body: `Te quedan ${formatClock(remainingMsRef.current ?? 0)}. Puedes volver y seguir mientras quede tiempo.`,
        confirmLabel: 'Salir de todas formas',
      }),
    [],
  )
  const shouldBlockLeave = useCallback<ShouldBlockFn>(
    async ({ next }) => {
      // Finishing (or running out of time) hands off to the review: not leaving.
      if (hasConfirmedLeaveRef.current || next.pathname.endsWith('/review')) return false
      return !(await confirmLeave())
    },
    [confirmLeave],
  )
  useBlocker({
    shouldBlockFn: shouldBlockLeave,
    disabled: !guardsLeaving,
    enableBeforeUnload: false,
  })
  const exit = async () => {
    if (guardsLeaving && !(await confirmLeave())) return
    hasConfirmedLeaveRef.current = true
    onExit()
  }

  const view = current == null ? null : views[currentIndex]
  const answeredCount = views.filter((item) => item.selectedOption != null).length
  const isLast = currentIndex === questions.length - 1
  const isFirst = currentIndex === 0
  const isFinishing = isFlushing || completeMutation.isPending
  const locked = !isOpen || isFinishing
  // Only a session that corrects at once teaches; the exit ticket measures (F40).
  const tutorInSolve = session != null && SESSION_KIND_CONFIG[session.kind].tutorInSolve && session.feedbackMode === 'inmediata'
  // The sheet stays mounted (display:none), so closing it must silence its voice.
  const closeTutor = () => {
    setIsTutorOpen(false)
    stopSpeaking()
  }
  const openTutor = () => {
    setHasOpenedTutor(true)
    setIsTutorOpen(true)
  }
  // A checked answer can no longer change; the retry is a separate tap.
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
      if (moment === 'retry') {
        if (label !== view?.selectedOption && !locked && !guideAction.isPending) guideAction.mutate({ type: 'retry', label })
        return
      }
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
    [answerLocked, current, guideAction, locked, moment, queue, view],
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
      // The tutor sheet owns the keyboard while open: a letter typed there is not an answer.
      if (isMapOpen || isReportOpen || isTutorOpen || isChecking) return
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
  }, [current, goNext, goPrev, isChecking, isMapOpen, isReportOpen, isTutorOpen, selectOption, toggleFlag])

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
  const feedback = moment === 'closed' && current.attempt?.selectedOption != null
    ? answerFeedback(current.question, current.attempt.selectedOption)
    : null
  const submitLabel = isFlushing
    ? 'Guardando respuestas…'
    : completeMutation.isPending
      ? 'Entregando…'
      : 'Entregar'
  const beads = beadStates(views.map((item) => item.selectedOption != null), currentIndex)
  const topic = current.question.primarySubtopicId == null ? null : getSubtopicLabel(current.question.primarySubtopicId)
  const allAnswered = answeredCount === questions.length
  const finishNow = () => {
    if (!isFinishing && isOpen) void finishSession(false)
  }
  const hint = hints[current.sessionQuestionId]
  const openPath = guide != null && guide.phase !== 'ended' ? guide : null

  return (
    <div
      className="solve fade-in"
      style={{
        '--solve-text-scale': textScale,
        '--field': getSubjectTheme(current.question.subjectId ?? '').color,
      } as CSSProperties}
    >
      <header className="solve-bar">
        <button type="button" className="solve-bar-btn" onClick={() => void exit()} aria-label="Salir de la sesión">
          <X size={24} strokeWidth={2.6} aria-hidden />
        </button>

        {beads != null ? (
          <div className="beads" role="img" aria-label={`Pregunta ${currentIndex + 1} de ${questions.length}`}>
            {beads.map((state, index) => <i key={index} className={`is-${state}`} />)}
          </div>
        ) : (
          <div className="solve-bar-track" role="img" aria-label={`${answeredCount} de ${questions.length} respondidas`}>
            <span style={{ transform: `scaleX(${answeredCount / questions.length})` }} />
          </div>
        )}

        {timer.timed ? (
          <button
            type="button"
            className={`solve-clock${lowTime ? ' is-low' : ''}`}
            onClick={toggleClock}
            disabled={inFinalMinutes}
            aria-label={clockVisible ? `Tiempo restante ${formatClock(timer.remainingMs ?? 0)}. Ocultar el reloj` : 'Mostrar el reloj'}
          >
            {clockVisible ? formatClock(timer.remainingMs ?? 0) : <EyeOff size={16} aria-hidden />}
          </button>
        ) : null}

        <div className={`solve-count${view.flagged ? ' is-marked' : ''}`} aria-hidden>
          {currentIndex + 1}/{questions.length}
        </div>

        <button
          type="button"
          className="solve-bar-btn"
          onClick={() => setIsMoreOpen(true)}
          aria-haspopup="dialog"
          aria-label="Más opciones"
        >
          <Ellipsis size={24} strokeWidth={2.6} aria-hidden />
        </button>
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
          onSubmit={finishNow}
        />
      ) : (
        <>
          <main className={`solve-main${current.group != null ? ' is-split' : ''}`}>
            {current.group != null ? (
              <SharedStimulus group={current.group} panelRef={stimulusRef} />
            ) : null}

            <div className={`solve-work sheet${isStriking ? ' is-striking' : ''}`} ref={workRef}>
              {pace != null ? (
                <p
                  className={`solve-pace is-${pace.status}`}
                  title={paceDescription(pace, data?.officialMsPerQuestion ?? 135_000)}
                >
                  <Gauge size={14} aria-hidden />
                  {paceLabel(pace)}
                  <span className="sr-only">
                    {paceDescription(pace, data?.officialMsPerQuestion ?? 135_000)}
                  </span>
                </p>
              ) : null}

              <article className={`solve-question${current.question.bodyMarkdown.length > LONG_STEM ? ' is-long' : ''}`}>
                {current.stemImageUrl != null ? (
                  /* A figure the question truly needs (`stemDisplay`). The markdown
                     stays in the DOM but visually hidden: it is what a screen reader
                     announces, what find-in-page matches, and what the tutor is given
                     as context. */
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
                <p className="question-source">{topic != null ? `${topic} · ` : ''}{current.source.label}</p>
              </article>

              <div className="solve-options" role="group" aria-label="Opciones de respuesta">
                {current.question.options.map((option) => {
                  const mark = optionMark({
                    moment,
                    label: option.label,
                    selectedOption: view.selectedOption,
                    correctOption: current.question.answerCorrectOption ?? null,
                    isEliminated: view.eliminated.includes(option.label),
                  })
                  const isSelected = view.selectedOption === option.label
                  const isEliminated = mark === 'eliminated'
                  const canStrike = moment === 'answering'
                  // At the retry the first pick is the one option already ruled out.
                  const isDisabled = moment === 'retry' ? locked || isSelected || guideAction.isPending : answerLocked
                  return (
                    <div key={option.label} className="solve-option-row">
                      <button
                        type="button"
                        disabled={isDisabled}
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
                        className={`option-card solve-option${OPTION_CLASS[mark]}`}
                      >
                        <span className="option-label">{option.label}</span>
                        <span className="solve-option-body min-w-0 flex-1 text-left">
                          <MarkdownBlock markdown={option.bodyMarkdown} />
                          {moment === 'closed' && mark === 'correct' ? (
                            <span className="review-option-meta is-correct">Respuesta correcta</span>
                          ) : null}
                          {moment === 'closed' && mark === 'wrong' ? (
                            <span className="review-option-meta is-incorrect">Tu respuesta</span>
                          ) : null}
                        </span>
                        {mark === 'wrong' ? <X size={20} strokeWidth={2.8} className="solve-option-mark" aria-hidden /> : null}
                        {mark === 'correct' ? <Check size={20} strokeWidth={2.8} className="solve-option-mark" aria-hidden /> : null}
                        {isEliminated ? <span className="sr-only">(tachada)</span> : null}
                      </button>
                      {canStrike ? (
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
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {view.selectedOption != null && moment === 'answering' ? (
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

              {moment === 'answering' && hint !== undefined ? (
                <p className="solve-pista" role="status">
                  <Lightbulb size={18} aria-hidden />
                  {hint != null ? <MarkdownBlock markdown={hint} /> : 'Esta pregunta todavía no tiene pista.'}
                </p>
              ) : null}
            </div>
          </main>

          <div className="solve-dock">
            {errorMessage != null ? (
              <div className="stage-alert" role="alert">{errorMessage}</div>
            ) : null}

            {openPath != null && (moment === 'guiding' || moment === 'why' || moment === 'retry') ? (
              <GuidedPath
                guide={openPath}
                lastCorrect={lastCorrect}
                isBusy={guideAction.isPending}
                error={guideAction.error != null ? readConvexError(guideAction.error, 'No se pudo guardar tu respuesta. Intenta de nuevo.') : null}
                onChoose={(choiceIndex) => guideAction.mutate({ type: 'choose', choiceIndex })}
                onReveal={() => guideAction.mutate({ type: 'reveal' })}
                onAskTutor={tutorInSolve ? openTutor : undefined}
              />
            ) : moment === 'closed' && feedback != null ? (
              <AnswerFeedback
                feedback={feedback}
                explanationSource={current.question.explanationSource ?? null}
                isLast={isLast}
                justChecked={justCheckedId === current.sessionQuestionId}
                outcome={guide?.phase === 'ended' ? guide.outcome : null}
                reveal={guide?.phase === 'ended' ? guide.reveal : null}
                onNext={isLast ? (allAnswered ? finishNow : openCheck) : goNext}
              />
            ) : moment === 'waiting' ? (
              <p className="solve-waiting" role="status">Un momento…</p>
            ) : immediate ? (
              <footer className="solve-footer">
                <button type="button" className="solve-nav-btn" disabled={isFirst} onClick={goPrev} aria-label="Pregunta anterior">
                  <ChevronLeft size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  className="solve-nav-btn"
                  disabled={locked || hintMutation.isPending || hint !== undefined}
                  onClick={() => hintMutation.mutate(current.sessionQuestionId)}
                >
                  <Lightbulb size={18} aria-hidden />
                  {hintMutation.isPending ? 'Pensando…' : 'Pista'}
                </button>
                {view.selectedOption != null ? (
                  <button
                    type="button"
                    className="btn-primary solve-primary"
                    disabled={locked || checkMutation.isPending}
                    onClick={() => checkMutation.mutate(current.sessionQuestionId)}
                  >
                    {checkMutation.isPending ? 'Comprobando…' : 'Comprobar'}
                  </button>
                ) : (
                  <button type="button" className="solve-nav-btn solve-skip" onClick={isLast ? openCheck : goNext} disabled={locked}>
                    {isLast ? 'Revisar' : 'Saltar'}
                  </button>
                )}
              </footer>
            ) : (
              <footer className="solve-footer">
                <button type="button" className="solve-nav-btn" disabled={isFirst} onClick={goPrev} aria-label="Pregunta anterior">
                  <ChevronLeft size={20} aria-hidden />
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
                  <button type="button" className="btn-primary solve-primary" disabled={locked} onClick={openCheck}>
                    <ClipboardCheck size={16} aria-hidden />
                    Revisar
                  </button>
                ) : (
                  <button type="button" className="btn-primary solve-primary" onClick={goNext} aria-label="Pregunta siguiente">
                    Siguiente
                    <ChevronRight size={18} aria-hidden />
                  </button>
                )}
              </footer>
            )}
          </div>
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

      <Dialog.Root open={isMoreOpen} onOpenChange={setIsMoreOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="solve-sheet-scrim" />
          <Dialog.Content className="solve-sheet" aria-describedby={undefined}>
            <span className="solve-sheet-handle" aria-hidden />
            <Dialog.Title className="solve-sheet-title">Más opciones</Dialog.Title>
            <div className="solve-more-row" role="group" aria-label="Tamaño del texto">
              <span>Texto</span>
              <button
                type="button"
                className="solve-more-size"
                onClick={() => changeTextScale(-1)}
                disabled={textScale === TEXT_SCALES[0]}
                aria-label="Texto más pequeño"
              >
                <AArrowDown size={22} aria-hidden />
              </button>
              <button
                type="button"
                className="solve-more-size"
                onClick={() => changeTextScale(1)}
                disabled={textScale === TEXT_SCALES[TEXT_SCALES.length - 1]}
                aria-label="Texto más grande"
              >
                <AArrowUp size={22} aria-hidden />
              </button>
            </div>
            <button
              type="button"
              className="solve-more-item"
              aria-pressed={isStriking}
              onClick={() => {
                setIsStriking((value) => !value)
                setIsMoreOpen(false)
              }}
            >
              <Strikethrough size={20} aria-hidden />
              {isStriking ? 'Ocultar tachar' : 'Tachar opciones'}
            </button>
            <button
              type="button"
              className="solve-more-item"
              onClick={() => {
                setIsMoreOpen(false)
                setIsMapOpen(true)
              }}
            >
              <LayoutGrid size={20} aria-hidden />
              Mapa de preguntas
            </button>
            {tutorInSolve ? (
              <button
                type="button"
                className="solve-more-item"
                onClick={() => {
                  setIsMoreOpen(false)
                  openTutor()
                }}
              >
                <Bot size={20} aria-hidden />
                Pregúntale al tutor
              </button>
            ) : null}
            <button
              type="button"
              className="solve-more-item"
              onClick={() => {
                setIsMoreOpen(false)
                setIsReportOpen(true)
              }}
            >
              <MessageSquareWarning size={20} aria-hidden />
              Reportar un problema
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {tutorInSolve && session != null ? (
        <div
          className={`tutor-sheet is-fixed ${isTutorOpen ? 'is-open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Tutor"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeTutor()
          }}
        >
          <button type="button" className="tutor-sheet-backdrop" onClick={closeTutor} aria-label="Cerrar tutor" />
          <div className="tutor-sheet-panel">
            {hasOpenedTutor ? (
              <Suspense fallback={<PageLoader message="Abriendo el tutor…" />}>
                <ReviewTutor
                  // One chat per question, like the review.
                  key={current.question._id}
                  mode="solve"
                  sessionId={sessionId}
                  practiceSessionId={session._id}
                  studentId={session.studentId}
                  questionId={current.question._id}
                  isCompact
                  onClose={closeTutor}
                  draft={tutorDraft}
                  onDraftChange={setTutorDraft}
                />
              </Suspense>
            ) : null}
          </div>
        </div>
      ) : null}

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
