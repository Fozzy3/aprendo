import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Bot,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { MIN_STATS_SAMPLE } from '@aprendo/convex/answerStats'
import { MarkdownBlock } from '../components/MarkdownBlock.tsx'
import { NivelacionResult } from '../components/NivelacionResult.tsx'
import { QuestionReportForm } from '../components/QuestionReportForm.tsx'
import { SharedStimulus } from '../components/SharedStimulus.tsx'
import { SimulacroReport } from '../components/SimulacroReport.tsx'
import { classifyAttempt } from '@aprendo/convex/confidence'
import { LEARNING_STATE_DISPLAY, type ConfidenceLevel } from '../lib/confidence-display.ts'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../components/ui/resizable.tsx'
import { sessionQuery } from '../lib/student-queries.ts'
import { getKindLabel } from '../lib/session-display.ts'
import { formatClock, hasResultScreen } from '../lib/result-display.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { indexOfPosition } from '../lib/review-position.ts'
import { missedCount, optionExplanations, timeVersusMedian } from '../lib/review-explanations.ts'
import { readConvexError } from '../lib/convex-error.ts'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'

// The whole chat stack lives behind this import; see ReviewTutor.
const ReviewTutor = lazy(() => import('../components/ReviewTutor.tsx'))

const TIME_VERSUS_MEDIAN_COPY = {
  faster: 'más rápido que la mayoría',
  slower: 'más lento que la mayoría',
  similar: 'como la mayoría',
} as const

const TUTOR_COLLAPSED_STORAGE_KEY = 'aprendo:review:tutor-collapsed'
const LAYOUT_STORAGE_KEY = 'aprendo:review:workspace-layout-v3'
const STAGE_PANEL_ID = 'aprendo-review-stage'
const TUTOR_PANEL_ID = 'aprendo-review-tutor'

function readStoredLayout(): { [id: string]: number } | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as { [id: string]: number }
  } catch {
    // ignore
  }
  return undefined
}

/**
 * `pregunta` (the 1-based session position) opens the per-question review at that question. Without
 * it, a nivelación or simulacro opens on its result screen first: that is where
 * completing one lands, with no change to the solve screen's navigation.
 */
export const Route = createFileRoute('/practice/$sessionId/review')({
  validateSearch: (search: Record<string, unknown>): { pregunta?: number } => {
    const pregunta = Number(search.pregunta)
    return Number.isInteger(pregunta) && pregunta >= 1 ? { pregunta } : {}
  },
  component: ReviewPage,
})

function ReviewPage() {
  const navigate = useNavigate()
  const { sessionId } = Route.useParams()
  const { pregunta } = Route.useSearch()
  const { session, isReady } = useCurrentStudent()

  const reviewQuery = useQuery({
    ...sessionQuery(sessionId),
    enabled: sessionId != null,
  })
  const data = reviewQuery.data
  const sessionDoc = data?.session ?? null
  const questions = data?.questions ?? []

  // "Repetir las que fallé" (G05): a repaso built from this session's misses.
  const createSession = useConvexMutation(api.sessions.createSession)
  const retryMutation = useMutation({
    mutationFn: async (studentId: string) =>
      createSession({
        studentId: studentId as never,
        kind: 'repaso',
        retryFromSessionId: sessionId as never,
      }),
    onSuccess: async (newSessionId) => {
      await navigate({ to: '/practice/$sessionId', params: { sessionId: newSessionId } })
    },
  })

  // Already right on the first frame when the session is cached; the effect
  // below covers the first load and later links.
  const [currentIndex, setCurrentIndex] = useState(() => indexOfPosition(questions, pregunta))

  // "% eligió cada opción" (G08): only once the session is completed, so it
  // can never hint at the key while the student is still answering. Only the
  // question on screen: every id is a live read of all its attempts.
  const statsQuestionId = questions[currentIndex]?.question._id
  const statsQuery = useQuery(
    convexQuery(
      api.sessions.getQuestionAnswerStats,
      sessionDoc?.status === 'completed' && statsQuestionId != null ? { questionIds: [statsQuestionId] } : 'skip',
    ),
  )
  const [draft, setDraft] = useState('')
  // Read up front, not only in the effect below: starting at `false` rendered
  // the desktop split for one frame on a phone, which mounted the tutor and
  // fetched its chunk before the sheet layout took over.
  const [isCompactViewport, setIsCompactViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches,
  )
  const [isTutorSheetOpen, setIsTutorSheetOpen] = useState(false)
  // The sheet's tutor mounts on first open and then stays (hidden) so the
  // conversation, and any demo it opened, survive closing the sheet.
  const [hasOpenedTutorSheet, setHasOpenedTutorSheet] = useState(false)
  if (isTutorSheetOpen && !hasOpenedTutorSheet) setHasOpenedTutorSheet(true)
  // Read up front too: the desktop tutor mounts the first time it is shown,
  // so a stored "collapsed" has to hold from the first frame.
  const [isTutorCollapsed, setIsTutorCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(TUTOR_COLLAPSED_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  // The desktop tutor renders into this node, which the tutor panel adopts
  // while it is open. Collapsing remounts the panel group (see below) but not
  // the tutor, so a reply still streaming keeps its Stop button and locked
  // composer, and the thread and any open demo survive — like the phone sheet.
  const [desktopTutorHost] = useState(() => {
    if (typeof document === 'undefined') return null
    const host = document.createElement('div')
    host.className = 'h-full min-h-0'
    return host
  })
  const [hasShownDesktopTutor, setHasShownDesktopTutor] = useState(false)
  if (!isCompactViewport && !isTutorCollapsed && !hasShownDesktopTutor) setHasShownDesktopTutor(true)
  const adoptDesktopTutorHost = useCallback((slot: HTMLDivElement | null) => {
    if (slot != null && desktopTutorHost != null) slot.appendChild(desktopTutorHost)
  }, [desktopTutorHost])
  const storedLayoutRef = useRef<{ [id: string]: number } | undefined>(undefined)
  if (storedLayoutRef.current === undefined && typeof window !== 'undefined') {
    storedLayoutRef.current = readStoredLayout()
  }

  useEffect(() => {
    if (isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [isReady, navigate, session])

  // A link into a specific question ("Donde se te fue el tiempo") lands on it,
  // also when this screen is already mounted on the result.
  useEffect(() => {
    if (pregunta == null || questions.length === 0) return
    setCurrentIndex(indexOfPosition(questions, pregunta))
  }, [pregunta, questions.length])

  // The review surface requires a completed session. If it isn't complete yet,
  // send the student back to the solve screen.
  useEffect(() => {
    if (sessionDoc != null && sessionDoc.status !== 'completed') {
      void navigate({ to: '/practice/$sessionId', params: { sessionId } })
    }
  }, [navigate, sessionDoc, sessionId])

  // Single breakpoint: below it the tutor becomes a bottom sheet; above it a
  // horizontal resizable split. No mid-band vertical mode (that was the source
  // of the layout breaking on resize).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const compactMedia = window.matchMedia('(max-width: 1024px)')
    const sync = () => setIsCompactViewport(compactMedia.matches)
    sync()
    compactMedia.addEventListener('change', sync)
    return () => compactMedia.removeEventListener('change', sync)
  }, [])

  const persistTutorCollapsed = useCallback((collapsed: boolean) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TUTOR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  }, [])

  const expandTutor = useCallback(() => {
    setIsTutorCollapsed(false)
    persistTutorCollapsed(false)
  }, [persistTutorCollapsed])

  const collapseTutor = useCallback(() => {
    setIsTutorCollapsed(true)
    persistTutorCollapsed(true)
  }, [persistTutorCollapsed])

  const toggleTutor = useCallback(() => {
    if (isCompactViewport) {
      setIsTutorSheetOpen((open) => !open)
      return
    }
    setIsTutorCollapsed((prev) => {
      const next = !prev
      persistTutorCollapsed(next)
      return next
    })
  }, [isCompactViewport, persistTutorCollapsed])

  const focusTutorInput = useCallback(() => {
    if (isCompactViewport) setIsTutorSheetOpen(true)
    else if (isTutorCollapsed) expandTutor()
    requestAnimationFrame(() => {
      if (typeof document === 'undefined') return
      document.querySelector<HTMLTextAreaElement>('[data-tutor-input]')?.focus()
    })
  }, [expandTutor, isCompactViewport, isTutorCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      const isTyping = !!target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      const isModified = event.metaKey || event.ctrlKey
      if (isModified && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        focusTutorInput()
        return
      }
      if (isModified && !event.shiftKey && !event.altKey && event.key === '\\') {
        event.preventDefault()
        toggleTutor()
        return
      }
      if (isTyping) return
      if (event.key === 'ArrowLeft') setCurrentIndex((v) => Math.max(0, v - 1))
      else if (event.key === 'ArrowRight') setCurrentIndex((v) => Math.min(questions.length - 1, v + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusTutorInput, questions.length, toggleTutor])

  if (!isReady || session == null || reviewQuery.isPending || sessionDoc == null) {
    return (
      <FullScreenLoader message="Preparando tu revisión…" />
    )
  }

  const opensOnResult = hasResultScreen(sessionDoc.kind)
  if (opensOnResult && pregunta == null && sessionDoc.status === 'completed') {
    return (
      <StudentAppShell session={session} activeSection="practice">
        {sessionDoc.kind === 'nivelacion' ? (
          <NivelacionResult session={sessionDoc} studentId={session.studentId} />
        ) : (
          <SimulacroReport sessionId={sessionDoc._id} studentId={session.studentId} />
        )}
      </StudentAppShell>
    )
  }

  const currentQuestion = questions[currentIndex]
  if (currentQuestion == null) {
    return (
      <StudentAppShell session={session} activeSection="practice" immersive>
        <div className="fade-in mx-auto max-w-xl p-8 text-center">
          <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">No hay preguntas para revisar</h2>
          <button type="button" className="btn-primary mt-2" onClick={() => navigate({ to: '/practice' })}>
            Volver a práctica
          </button>
        </div>
      </StudentAppShell>
    )
  }

  const correctCount = questions.filter((q) => q.attempt?.isCorrect).length
  const subjectScores = sessionDoc.summary?.subjectScores ?? []
  const selectedOption = currentQuestion.attempt?.selectedOption ?? null
  const hasAnswered = selectedOption != null

  // Every option explained (G06): the student's wrong pick first — their
  // specific wrong turn is the part that teaches — then the other distractors,
  // then the solution.
  const explanations = optionExplanations({
    options: currentQuestion.question.options,
    selectedOption,
    correctOption: currentQuestion.question.answerCorrectOption,
    rationales: currentQuestion.question.answerDistractorRationales,
  })
  const solutionMarkdown = currentQuestion.question.answerSolutionMarkdown
  const isAiExplanation =
    currentQuestion.question.explanationSource === 'ai_generated'
    && (explanations.length > 0 || Boolean(solutionMarkdown))
  const stats = statsQuery.data?.find((item) => item.questionId === currentQuestion.question._id) ?? null
  const versusMedian = timeVersusMedian(currentQuestion.timeSpentMs, stats?.medianTimeMs)
  const missed = missedCount(questions)

  const eliminatedOptions = new Set(currentQuestion.eliminatedOptions)
  const officialMs = data?.officialMsPerQuestion ?? 0
  const learningState = classifyAttempt({
    confidence: currentQuestion.attempt?.confidence as ConfidenceLevel | undefined,
    isCorrect: currentQuestion.attempt?.isCorrect ?? false,
  })
  const isFirst = currentIndex === 0
  const isLast = currentIndex === questions.length - 1

  const goPrev = () => setCurrentIndex((v) => Math.max(0, v - 1))
  const goNext = () => setCurrentIndex((v) => Math.min(questions.length - 1, v + 1))

  const stage = (
    <section className="stage" aria-label="Pregunta revisada">
      <header className="stage-rail">
        <div className="flex min-w-0 flex-1 items-center gap-[0.55rem] overflow-hidden">
          <button
            type="button"
            className="stage-back"
            onClick={() =>
              opensOnResult
                ? navigate({ to: '/practice/$sessionId/review', params: { sessionId } })
                : navigate({ to: '/practice' })}
            aria-label={opensOnResult ? 'Volver al resultado' : 'Volver a práctica'}
            title={opensOnResult ? 'Volver al resultado' : 'Volver a práctica'}
          >
            <ArrowLeft size={16} />
          </button>
          <span className="stage-kicker">
            <span className="stage-kicker-label">{getKindLabel(sessionDoc.kind)}</span>
            <span className="stage-kicker-sep">·</span> {currentQuestion.position}/{sessionDoc.questionCount}
          </span>
          <div className="stage-tags">
            <span className="chip chip-accent">{getSubjectLabel(currentQuestion.question.subjectId ?? 'sin_asignar')}</span>
            <span
              className="chip stage-subtopic-chip"
              title={getSubtopicLabel(currentQuestion.question.primarySubtopicId ?? 'sin_subtema')}
            >
              {getSubtopicLabel(currentQuestion.question.primarySubtopicId ?? 'sin_subtema')}
            </span>
          </div>
        </div>
        <span className="stage-score" aria-live="polite">
          <strong>{correctCount}<span>/{questions.length}</span></strong>
          <span className="stage-score-label">correctas</span>
        </span>
      </header>

      {subjectScores.length > 0 ? (
        <div className="stage-score-strip" aria-label="Puntaje por área">
          {subjectScores.map((score) => (
            <span key={score.subjectId} className="chip">
              {getSubjectLabel(score.subjectId)}: <strong>{score.score}</strong>/100
            </span>
          ))}
        </div>
      ) : null}

      <nav className="stage-palette" aria-label="Mapa de preguntas">
        {questions.map((question, index) => {
          const attempt = question.attempt
          const status = attempt == null ? 'pending' : attempt.isCorrect ? 'correct' : 'incorrect'
          return (
            <button
              key={question.sessionQuestionId}
              type="button"
              className={['palette-dot', `is-${status}`, index === currentIndex ? 'is-current' : ''].filter(Boolean).join(' ')}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Ir a la pregunta ${question.position}${question.flagged ? ' (marcada)' : ''}`}
              aria-current={index === currentIndex ? 'true' : undefined}
            >
              <span className="palette-dot-index">{question.position}</span>
              {question.flagged ? (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 z-[2] size-2 rounded-full border border-[var(--bg-card)] bg-[var(--text-primary)]"
                />
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="stage-scroll-wrap">
        <button type="button" onClick={goPrev} disabled={isFirst} className="stage-edge-nav stage-edge-nav-prev" aria-label="Pregunta anterior" title="Anterior (←)">
          <ChevronLeft size={20} />
        </button>

        <div
          className={`stage-scroll${currentQuestion.group != null ? ' is-split' : ''}`}
        >
          {currentQuestion.group != null ? (
            <SharedStimulus group={currentQuestion.group} />
          ) : null}

          <article className="stage-question sheet">
            <div className="stage-question-body">
              {currentQuestion.stemImageUrl != null ? (
                <>
                  <img
                    src={currentQuestion.stemImageUrl}
                    alt=""
                    className="question-scan"
                    loading="lazy"
                  />
                  <span className="sr-only">{currentQuestion.question.bodyMarkdown}</span>
                </>
              ) : (
                <MarkdownBlock markdown={currentQuestion.question.bodyMarkdown} />
              )}
              <p className="question-source">{currentQuestion.source.label}</p>
            </div>

            {currentQuestion.flagged || currentQuestion.timeSpentMs != null || !hasAnswered ? (
              <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Cómo la respondiste">
                {!hasAnswered ? <span className="chip">La dejaste en blanco</span> : null}
                {currentQuestion.flagged ? (
                  <span className="chip">
                    <Flag size={11} aria-hidden /> La marcaste para revisar
                  </span>
                ) : null}
                {currentQuestion.timeSpentMs != null ? (
                  <span
                    className={`chip tabular-nums${currentQuestion.timeSpentMs > officialMs ? ' border-transparent bg-[var(--danger-soft)] text-[var(--danger-text)]' : ''}`}
                  >
                    <Clock3 size={11} aria-hidden /> {formatClock(currentQuestion.timeSpentMs)}
                    <span className="font-medium">· ritmo oficial {formatClock(officialMs)}</span>
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="review-options">
              {currentQuestion.question.options.map((option) => {
                const isSelected = selectedOption === option.label
                const isCorrect = option.label === currentQuestion.question.answerCorrectOption
                const isWrongPick = hasAnswered && isSelected && !isCorrect
                const wasEliminated = eliminatedOptions.has(option.label)
                const percent = stats?.options.find((item) => item.label === option.label)?.percent ?? null
                return (
                  <div
                    key={option.label}
                    className={[
                      'option-card review-option',
                      isCorrect ? 'is-correct' : '',
                      isWrongPick ? 'is-incorrect' : '',
                      isSelected && !isCorrect ? 'is-selected' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="option-label">{option.label}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className={wasEliminated ? 'block line-through decoration-2 opacity-60' : undefined}>
                        <MarkdownBlock markdown={option.bodyMarkdown} />
                      </span>
                      {isCorrect ? (
                        <span className="review-option-meta is-correct">
                          <Check size={14} strokeWidth={3} aria-hidden /> Respuesta correcta
                        </span>
                      ) : null}
                      {isWrongPick ? (
                        <span className="review-option-meta is-incorrect">
                          <X size={14} strokeWidth={3} aria-hidden /> Tu respuesta
                        </span>
                      ) : null}
                      {wasEliminated ? (
                        <span className={`review-option-meta ${isCorrect ? 'is-incorrect' : 'text-[var(--text-tertiary)]'}`}>
                          {isCorrect ? '\u00a0· y la tachaste' : 'La tachaste'}
                        </span>
                      ) : null}
                      {percent != null ? (
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full bg-[var(--bg-inset)]" aria-hidden>
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${percent}%`,
                                background: isCorrect ? 'var(--success)' : 'var(--text-tertiary)',
                              }}
                            />
                          </span>
                          <span className="text-[0.6875rem] font-semibold tabular-nums text-[var(--text-tertiary)]">
                            {percent}% la eligió
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </div>
                )
              })}
            </div>

            {stats != null ? (
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                {stats.hasEnoughData
                  ? `La respondieron ${stats.sampleSize} estudiantes.`
                  : `Aún pocos datos para mostrar qué eligieron los demás (${stats.sampleSize} de ${MIN_STATS_SAMPLE} respuestas).`}
                {stats.medianTimeMs != null ? (
                  <>
                    {' '}Tiempo mediano <span className="tabular-nums">{formatClock(stats.medianTimeMs)}</span>
                    {currentQuestion.timeSpentMs != null && versusMedian != null ? (
                      <>
                        ; el tuyo <span className="tabular-nums">{formatClock(currentQuestion.timeSpentMs)}</span>,{' '}
                        {TIME_VERSUS_MEDIAN_COPY[versusMedian]}.
                      </>
                    ) : '.'}
                  </>
                ) : null}
              </p>
            ) : null}

            {isAiExplanation ? (
              <p className="chip mt-3">
                <Sparkles size={11} aria-hidden /> Explicación generada con IA: si ves un error, repórtalo.
              </p>
            ) : null}

            {explanations.map((item) =>
              item.isPicked ? (
                <div key={item.label} className="review-explanation is-distractor">
                  <p className="review-explanation-title">Por qué la {item.label} te pareció correcta</p>
                  <MarkdownBlock markdown={item.rationaleMarkdown} />
                </div>
              ) : (
                <details key={item.label} className="review-explanation">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
                    Por qué la {item.label} no es
                  </summary>
                  <div className="mt-2">
                    <MarkdownBlock markdown={item.rationaleMarkdown} />
                  </div>
                </details>
              ),
            )}

            {solutionMarkdown ? (
              <div className="review-explanation">
                <p className="review-explanation-title">Explicación</p>
                <MarkdownBlock markdown={solutionMarkdown} />
              </div>
            ) : null}

            {learningState != null ? (
              <div className={`review-state review-state-${LEARNING_STATE_DISPLAY[learningState].tone}`}>
                <strong>{LEARNING_STATE_DISPLAY[learningState].label}</strong>
                <span>{LEARNING_STATE_DISPLAY[learningState].description}</span>
              </div>
            ) : null}

            {currentQuestion.question.primarySubtopicId != null || missed > 0 ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {currentQuestion.question.primarySubtopicId ? (
                  <Link
                    to="/lesson/$subtopicId"
                    params={{ subtopicId: currentQuestion.question.primarySubtopicId }}
                    className="btn-ghost inline-flex items-center gap-1.5 text-sm no-underline"
                  >
                    <BookOpen size={14} /> Repasar este concepto
                  </Link>
                ) : null}
                {missed > 0 ? (
                  <button
                    type="button"
                    className="btn-ghost inline-flex items-center gap-1.5 text-sm"
                    disabled={retryMutation.isPending}
                    onClick={() => retryMutation.mutate(session.studentId)}
                  >
                    <RotateCcw size={14} aria-hidden />
                    {retryMutation.isPending ? 'Preparando…' : 'Repetir las que fallé'}
                  </button>
                ) : null}
              </div>
            ) : null}
            {retryMutation.error ? (
              <p role="alert" className="mt-2 text-center text-sm text-[var(--danger-text)]">
                {readConvexError(retryMutation.error, 'No se pudo armar el repaso de esta sesión.')}
              </p>
            ) : null}

            <QuestionReportForm
              key={currentQuestion.question._id}
              questionId={currentQuestion.question._id}
              sessionId={sessionDoc._id}
            />

            <p className="stage-shortcuts" aria-hidden>
              <kbd>←</kbd><kbd>→</kbd><span>navegar</span>
              <span className="stage-shortcuts-sep">·</span>
              <kbd>⌘</kbd><kbd>K</kbd><span>tutor</span>
            </p>
          </article>
        </div>

        <button type="button" onClick={goNext} disabled={isLast} className="stage-edge-nav stage-edge-nav-next" aria-label="Pregunta siguiente" title="Siguiente (→)">
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  )

  // Suspense covers the first fetch of the tutor's chunk.
  const renderTutor = (onClose: () => void) => (
    <Suspense fallback={<PageLoader message="Abriendo el tutor…" />}>
      <ReviewTutor
        // One chat per question: a new question is a fresh tutor on its own thread.
        key={currentQuestion.question._id}
        sessionId={sessionId}
        practiceSessionId={sessionDoc._id}
        studentId={session.studentId}
        questionId={currentQuestion.question._id}
        isCompact={isCompactViewport}
        onClose={onClose}
        draft={draft}
        onDraftChange={setDraft}
      />
    </Suspense>
  )

  const tutorRail = (
    <button type="button" className="tutor-rail" onClick={expandTutor} aria-label="Mostrar tutor" title="Mostrar tutor (⌘\\)">
      <span className="tutor-rail-icon"><Bot size={16} /></span>
      <span className="tutor-rail-label">Tutor</span>
      <span className="tutor-rail-shortcut">⌘\</span>
    </button>
  )

  return (
    <StudentAppShell session={session} activeSection="practice" immersive>
      <div className="practice-canvas fade-in">
        {isCompactViewport ? (
          <>
            {stage}
            <button
              type="button"
              className={`tutor-fab ${isTutorSheetOpen ? 'is-open' : ''}`}
              onClick={() => setIsTutorSheetOpen((value) => !value)}
              aria-label={isTutorSheetOpen ? 'Cerrar tutor' : 'Abrir tutor'}
            >
              <Bot size={18} />
              <span>Tutor</span>
            </button>
            <div className={`tutor-sheet ${isTutorSheetOpen ? 'is-open' : ''}`}>
              <button type="button" className="tutor-sheet-backdrop" onClick={() => setIsTutorSheetOpen(false)} aria-label="Cerrar tutor" />
              <div className="tutor-sheet-panel">
                {hasOpenedTutorSheet ? renderTutor(() => setIsTutorSheetOpen(false)) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <ResizablePanelGroup
              // Remount the group when the tutor collapses/expands so each state
              // mounts with the correct panels and restores the saved split
              // cleanly instead of normalizing from a stale 1-panel layout.
              key={isTutorCollapsed ? 'collapsed' : 'expanded'}
              orientation="horizontal"
              defaultLayout={storedLayoutRef.current}
              onLayoutChanged={(layout) => {
                // Don't persist the collapsed single-panel layout — it would
                // clobber the two-pane split we want to restore on expand.
                if (isTutorCollapsed) return
                storedLayoutRef.current = layout
                if (typeof window === 'undefined') return
                try {
                  window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
                } catch {
                  // ignore
                }
              }}
              className="practice-workspace h-full min-h-0 flex-1"
            >
              <ResizablePanel
                id={STAGE_PANEL_ID}
                defaultSize={60}
                minSize={38}
                className="relative h-full min-h-0"
              >
                {stage}
              </ResizablePanel>
              {!isTutorCollapsed ? (
                <>
                  <ResizableHandle />
                  <ResizablePanel id={TUTOR_PANEL_ID} defaultSize={40} minSize={26} className="relative h-full min-h-0">
                    <div ref={adoptDesktopTutorHost} className="h-full min-h-0" />
                  </ResizablePanel>
                </>
              ) : null}
            </ResizablePanelGroup>
            {isTutorCollapsed ? tutorRail : null}
            {hasShownDesktopTutor && desktopTutorHost != null
              ? createPortal(renderTutor(collapseTutor), desktopTutorHost)
              : null}
          </>
        )}
      </div>
    </StudentAppShell>
  )
}
