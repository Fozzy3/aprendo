import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  Sparkles,
  SquarePlay,
  Trash2,
} from 'lucide-react'
import { extractText } from '@convex-dev/agent'
import { useThreadMessages } from '@convex-dev/agent/react'
import { api } from '@aprendo/convex/api'
import type { Id } from '@aprendo/convex/dataModel'
import { useAction } from 'convex/react'
import { ArtifactPane } from '../components/ArtifactPane.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx'
import MarkdownBlock from '../components/MarkdownBlock.tsx'
import { SharedStimulus } from '../components/SharedStimulus.tsx'
import { classifyAttempt } from '@aprendo/convex/confidence'
import { LEARNING_STATE_DISPLAY, type ConfidenceLevel } from '../lib/confidence-display.ts'
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '../components/ai-elements/conversation.tsx'
import { Message, MessageContent } from '../components/ai-elements/message.tsx'
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from '../components/ai-elements/prompt-input.tsx'
import { Shimmer } from '../components/ai-elements/shimmer.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../components/ui/resizable.tsx'
import { sessionQuery, practiceTutorThreadQuery } from '../lib/student-queries.ts'
import { getKindLabel } from '../lib/session-display.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { getSubjectLabel, getSubtopicLabel } from '../lib/taxonomy.ts'

type ChatRole = 'assistant' | 'user'

type ArtifactRef = {
  artifactId: Id<'practiceTutorArtifacts'>
  title: string
  description?: string
}

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  streaming?: boolean
  artifactRef?: ArtifactRef
  artifactPending?: boolean
}

const TUTOR_COLLAPSED_STORAGE_KEY = 'aprendo:review:tutor-collapsed'
const LAYOUT_STORAGE_KEY = 'aprendo:review:workspace-layout-v3'
const STAGE_PANEL_ID = 'aprendo-review-stage'
const TUTOR_PANEL_ID = 'aprendo-review-tutor'
const QUICK_PROMPTS = [
  'Explícame la respuesta',
  'Dame un problema similar',
  '¿Qué debo repasar?',
] as const

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

export const Route = createFileRoute('/practice/$sessionId/review')({
  component: ReviewPage,
})

function ReviewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { sessionId } = Route.useParams()
  const { session, isReady } = useCurrentStudent()
  const studentId = session?.studentId ?? null

  const createTutorThread = useConvexMutation(api.tutor.createOrGetPracticeTutorThread)
  const clearTutorChat = useConvexMutation(api.tutor.clearPracticeTutorChat)
  const abortTutorStream = useConvexMutation(api.tutor.abortPracticeTutorStream)
  const sendTutorMessage = useAction(api.tutor.sendPracticeTutorMessage)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [hasEnsuredTutorThread, setHasEnsuredTutorThread] = useState(false)
  const [tutorThreadError, setTutorThreadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [isAborting, setIsAborting] = useState(false)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [isTutorSheetOpen, setIsTutorSheetOpen] = useState(false)
  const [isTutorCollapsed, setIsTutorCollapsed] = useState(false)
  const [openArtifactId, setOpenArtifactId] = useState<Id<'practiceTutorArtifacts'> | null>(null)
  const storedLayoutRef = useRef<{ [id: string]: number } | undefined>(undefined)
  if (storedLayoutRef.current === undefined && typeof window !== 'undefined') {
    storedLayoutRef.current = readStoredLayout()
  }

  const reviewQuery = useQuery({
    ...sessionQuery(sessionId),
    enabled: sessionId != null,
  })
  const data = reviewQuery.data
  const sessionDoc = data?.session ?? null
  const questions = data?.questions ?? []

  const tutorThreadQuery = useQuery({
    ...practiceTutorThreadQuery(sessionId, studentId),
    enabled: sessionId != null && hasEnsuredTutorThread,
  })
  const tutorThreadId = tutorThreadQuery.data?.threadId ?? null
  const tutorMessagesResult = useThreadMessages(
    api.tutor.listPracticeTutorMessages,
    tutorThreadId == null || studentId == null
      ? 'skip'
      : {
        practiceSessionId: sessionId as never,
        studentId: studentId as never,
        threadId: tutorThreadId,
      },
    { initialNumItems: 50, stream: true },
  )

  useEffect(() => {
    if (isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [isReady, navigate, session])

  // The review surface requires a completed session. If it isn't complete yet,
  // send the student back to the solve screen.
  useEffect(() => {
    if (sessionDoc != null && sessionDoc.status !== 'completed') {
      void navigate({ to: '/practice/$sessionId', params: { sessionId } })
    }
  }, [navigate, sessionDoc, sessionId])

  useEffect(() => {
    if (sessionDoc == null || studentId == null || hasEnsuredTutorThread) return
    createTutorThread({ practiceSessionId: sessionDoc._id, studentId: studentId as never })
      .then(() => {
        setHasEnsuredTutorThread(true)
        setTutorThreadError(null)
      })
      .catch((error: unknown) => {
        setHasEnsuredTutorThread(true)
        setTutorThreadError(error instanceof Error ? error.message : 'No se pudo iniciar el tutor.')
      })
  }, [createTutorThread, hasEnsuredTutorThread, sessionDoc, studentId])

  // Hydrate persisted tutor-collapsed state.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(TUTOR_COLLAPSED_STORAGE_KEY) === '1') setIsTutorCollapsed(true)
  }, [])

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

  const clearTutorMutation = useMutation({
    mutationFn: async () => {
      if (sessionDoc == null || studentId == null) throw new Error('Sesión no cargada.')
      return clearTutorChat({ practiceSessionId: sessionDoc._id, studentId: studentId as never })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: practiceTutorThreadQuery(sessionId, studentId).queryKey,
      })
    },
  })

  const tutorMutation = useMutation({
    mutationFn: async (input: { prompt: string; questionId?: string }) => {
      if (sessionDoc == null || studentId == null) throw new Error('Sesión no cargada.')
      return sendTutorMessage({
        practiceSessionId: sessionDoc._id,
        studentId: studentId as never,
        prompt: input.prompt,
        questionId: input.questionId as never | undefined,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: practiceTutorThreadQuery(sessionId, studentId).queryKey,
      })
    },
  })

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

  const tutorMessages: ChatMessage[] = useMemo(() => {
    const artifactByToolCallId = new Map<string, ArtifactRef>()
    for (const message of tutorMessagesResult.results) {
      const inner = message.message
      if (inner == null || inner.role !== 'tool') continue
      const content = inner.content
      if (!Array.isArray(content)) continue
      for (const part of content) {
        if (
          part != null
          && typeof part === 'object'
          && 'type' in part
          && part.type === 'tool-result'
          && 'toolName' in part
          && part.toolName === 'create_artifact'
        ) {
          const output = (part as { output?: { type?: string; value?: unknown } }).output
          if (output != null && output.type === 'json' && output.value != null && typeof output.value === 'object') {
            const value = output.value as { artifactId?: string; title?: string; description?: string }
            if (typeof value.artifactId === 'string' && typeof value.title === 'string') {
              artifactByToolCallId.set((part as { toolCallId: string }).toolCallId, {
                artifactId: value.artifactId as Id<'practiceTutorArtifacts'>,
                title: value.title,
                description: value.description,
              })
            }
          }
        }
      }
    }

    return tutorMessagesResult.results.flatMap((message) => {
      const inner = message.message
      if (inner == null) return []
      if (inner.role !== 'user' && inner.role !== 'assistant') return []

      let artifactRef: ArtifactRef | undefined
      let artifactPending = false
      if (inner.role === 'assistant' && Array.isArray(inner.content)) {
        for (const part of inner.content) {
          if (
            part != null
            && typeof part === 'object'
            && 'type' in part
            && part.type === 'tool-call'
            && 'toolName' in part
            && part.toolName === 'create_artifact'
          ) {
            const toolCallId = (part as { toolCallId: string }).toolCallId
            const ref = artifactByToolCallId.get(toolCallId)
            if (ref != null) artifactRef = ref
            else artifactPending = true
            break
          }
        }
      }

      const content = extractText(inner)?.trim() ?? ''
      if (content.length === 0 && artifactRef == null && !artifactPending) return []

      return [{
        id: message.key,
        role: inner.role as ChatRole,
        content,
        streaming: message.streaming === true,
        artifactRef,
        artifactPending,
      }]
    })
  }, [tutorMessagesResult.results])

  // The order of the message currently being streamed, used to abort precisely.
  const streamingOrder = useMemo(() => {
    let order: number | null = null
    for (const message of tutorMessagesResult.results) {
      if (message.streaming === true && typeof message.order === 'number') {
        order = message.order
      }
    }
    return order
  }, [tutorMessagesResult.results])

  if (!isReady || session == null || reviewQuery.isPending || sessionDoc == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-tertiary)]">Preparando tu revisión…</p>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  if (currentQuestion == null) {
    return (
      <StudentAppShell session={session} activeSection="practice" mainClassName="student-shell-main-immersive">
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

  // The rationale for the option this student actually picked. Explaining their
  // specific wrong turn is the part that teaches; the general solution below is
  // the part they already half-read before checking the answer.
  const pickedRationale =
    selectedOption == null || selectedOption === currentQuestion.question.answerCorrectOption
      ? null
      : currentQuestion.question.answerDistractorRationales?.find(
          (rationale) => rationale.label === selectedOption,
        ) ?? null

  const learningState = classifyAttempt({
    confidence: currentQuestion.attempt?.confidence as ConfidenceLevel | undefined,
    isCorrect: currentQuestion.attempt?.isCorrect ?? false,
  })
  const isFirst = currentIndex === 0
  const isLast = currentIndex === questions.length - 1

  const lastMessage = tutorMessages.at(-1)
  const isGenerating = tutorMutation.isPending
  // Show the "thinking" placeholder only until the assistant's streamed reply
  // starts arriving; once deltas land, the streaming bubble takes over.
  const isTutorThinking = isGenerating
    && (lastMessage?.role !== 'assistant' || lastMessage?.streaming !== true)
  const canSendTutorMessage = tutorThreadError == null && tutorThreadId != null && !isGenerating
  const sendTutorPrompt = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !canSendTutorMessage) return
    tutorMutation.mutate({ prompt: trimmed, questionId: currentQuestion.question._id })
    setDraft('')
    if (isCompactViewport) setIsTutorSheetOpen(true)
  }
  const handleStopTutor = () => {
    if (!isGenerating || isAborting || tutorThreadId == null) return
    setIsAborting(true)
    abortTutorStream({
      practiceSessionId: sessionDoc._id,
      studentId: studentId as never,
      threadId: tutorThreadId,
      order: streamingOrder ?? undefined,
    })
      .catch(() => {
        // The action resolves on its own when the stream stops; swallow races.
      })
      .finally(() => setIsAborting(false))
  }
  const canClearTutorChat = tutorThreadError == null
    && tutorThreadId != null
    && tutorMessages.length > 0
    && !tutorMutation.isPending
    && !clearTutorMutation.isPending
  const handleClearTutorChat = () => {
    if (!canClearTutorChat) return
    if (typeof window !== 'undefined'
      && !window.confirm('¿Borrar la conversación con el tutor? Esta acción no se puede deshacer.')) {
      return
    }
    clearTutorMutation.mutate()
  }

  const goPrev = () => setCurrentIndex((v) => Math.max(0, v - 1))
  const goNext = () => setCurrentIndex((v) => Math.min(questions.length - 1, v + 1))

  const stage = (
    <section className="stage" aria-label="Pregunta revisada">
      <header className="stage-rail">
        <div className="flex min-w-0 flex-1 items-center gap-[0.55rem] overflow-hidden">
          <button
            type="button"
            className="stage-back"
            onClick={() => navigate({ to: '/practice' })}
            aria-label="Volver a práctica"
            title="Volver a práctica"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="stage-kicker">
            <span className="stage-kicker-label">{getKindLabel(sessionDoc.kind)}</span>
            <span className="stage-kicker-sep">·</span> {currentIndex + 1}/{questions.length}
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
              aria-label={`Ir a la pregunta ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : undefined}
            >
              <span className="palette-dot-index">{index + 1}</span>
            </button>
          )
        })}
      </nav>

      <div className="stage-scroll-wrap">
        <button type="button" onClick={goPrev} disabled={isFirst} className="stage-edge-nav stage-edge-nav-prev" aria-label="Pregunta anterior" title="Anterior (←)">
          <ChevronLeft size={20} />
        </button>

        <div className="stage-scroll">
          {currentQuestion.group != null ? (
            <SharedStimulus group={currentQuestion.group} />
          ) : null}

          <article className="stage-question">
            <div className="stage-question-body">
              <MarkdownBlock markdown={currentQuestion.question.bodyMarkdown} />
            </div>

            <div className="review-options">
              {currentQuestion.question.options.map((option) => {
                const isSelected = selectedOption === option.label
                const isCorrect = option.label === currentQuestion.question.answerCorrectOption
                const isWrongPick = hasAnswered && isSelected && !isCorrect
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
                      <MarkdownBlock markdown={option.bodyMarkdown} />
                      {isCorrect ? <span className="review-option-meta is-correct">Respuesta correcta</span> : null}
                      {isWrongPick ? <span className="review-option-meta is-incorrect">Tu respuesta</span> : null}
                    </span>
                  </div>
                )
              })}
            </div>

            {pickedRationale != null ? (
              <div className="review-explanation is-distractor">
                <p className="kicker mb-2">Por qué la {pickedRationale.label} te pareció correcta</p>
                <MarkdownBlock markdown={pickedRationale.rationaleMarkdown} />
              </div>
            ) : null}

            {currentQuestion.question.answerSolutionMarkdown ? (
              <div className="review-explanation">
                <p className="kicker mb-2">Explicación</p>
                <MarkdownBlock markdown={currentQuestion.question.answerSolutionMarkdown} />
              </div>
            ) : null}

            {learningState != null ? (
              <div className={`review-state review-state-${LEARNING_STATE_DISPLAY[learningState].tone}`}>
                <strong>{LEARNING_STATE_DISPLAY[learningState].label}</strong>
                <span>{LEARNING_STATE_DISPLAY[learningState].description}</span>
              </div>
            ) : null}

            {currentQuestion.question.primarySubtopicId ? (
              <div className="mt-4 flex justify-center">
                <Link
                  to="/lesson/$subtopicId"
                  params={{ subtopicId: currentQuestion.question.primarySubtopicId }}
                  className="btn-ghost inline-flex items-center gap-1.5 text-sm no-underline"
                >
                  <BookOpen size={14} /> Repasar este concepto
                </Link>
              </div>
            ) : null}

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

  const tutor = (
    <aside className="tutor" aria-label="Tutor de revisión">
      <header className="tutor-header">
        <div className="inline-flex items-center gap-[0.6rem]">
          <span className="tutor-avatar" aria-hidden><Bot size={15} /></span>
          <div className="flex flex-col leading-none">
            <span className="tutor-title">Tutor</span>
            <span className="tutor-subtitle"><Sparkles size={10} /> revisión</span>
          </div>
        </div>
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={handleClearTutorChat} disabled={!canClearTutorChat} title="Borrar conversación" aria-label="Borrar conversación" className="tutor-icon-btn">
            <Trash2 size={14} />
          </button>
          {!isCompactViewport ? (
            <button type="button" onClick={collapseTutor} title="Ocultar tutor (⌘\\)" aria-label="Ocultar tutor" className="tutor-icon-btn">
              <PanelRightClose size={14} />
            </button>
          ) : (
            <button type="button" onClick={() => setIsTutorSheetOpen(false)} aria-label="Cerrar" className="tutor-icon-btn">
              <PanelRightClose size={14} />
            </button>
          )}
        </div>
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-[0.85rem] px-[0.95rem] pt-4 pb-2">
          {tutorMessages.length === 0 ? (
            <ConversationEmptyState className="items-stretch gap-[0.7rem] px-[1.1rem] pt-[1.6rem] pb-4 text-left" icon={null}>
              <div className="tutor-empty-mark" aria-hidden><Bot size={20} /></div>
              <h3 className="tutor-empty-title">Pregunta lo que necesites.</h3>
              <p className="tutor-empty-copy">
                Ya puedes ver las respuestas. Pídeme que explique una pregunta, te dé otra parecida o te diga qué repasar.
              </p>
              <div className="mt-[0.65rem] flex flex-col gap-[0.4rem]" role="group" aria-label="Sugerencias">
                {QUICK_PROMPTS.map((prompt) => (
                  <button key={prompt} type="button" disabled={!canSendTutorMessage} onClick={() => sendTutorPrompt(prompt)} className="tutor-quick-prompt">
                    {prompt}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            tutorMessages.map((message) => (
              <Message
                key={message.id}
                from={message.role}
                className={message.role === 'assistant' ? 'flex flex-row items-start gap-[0.55rem]' : 'flex flex-row-reverse items-start gap-[0.55rem]'}
              >
                {message.role === 'assistant' ? (
                  <span className="tutor-msg-avatar" aria-hidden><Bot size={12} /></span>
                ) : null}
                <MessageContent className={message.role === 'user' ? 'tutor-bubble tutor-bubble-user' : 'tutor-bubble tutor-bubble-assistant'}>
                  {message.content.length > 0 ? <MarkdownBlock markdown={message.content} /> : null}
                  {message.role === 'assistant' && message.artifactRef != null ? (
                    <button
                      type="button"
                      onClick={() => {
                        const ref = message.artifactRef
                        if (ref == null) return
                        setOpenArtifactId(ref.artifactId)
                        if (isCompactViewport) setIsTutorSheetOpen(false)
                      }}
                      className="tutor-artifact-cta"
                    >
                      <SquarePlay size={14} aria-hidden />
                      <span>Ver demostración interactiva</span>
                    </button>
                  ) : null}
                  {message.role === 'assistant' && message.artifactPending && message.artifactRef == null ? (
                    <Shimmer className="tutor-artifact-pending text-xs">Preparando demostración…</Shimmer>
                  ) : null}
                </MessageContent>
              </Message>
            ))
          )}
          {isTutorThinking ? (
            <Message from="assistant" className="flex flex-row items-start gap-[0.55rem]">
              <span className="tutor-msg-avatar" aria-hidden><Bot size={12} /></span>
              <MessageContent className="tutor-bubble tutor-bubble-assistant">
                <Shimmer className="text-sm">Pensando…</Shimmer>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput className="tutor-composer" onSubmit={(message) => sendTutorPrompt(message.text)}>
        <PromptInputBody>
          <PromptInputTextarea
            data-tutor-input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escribe un mensaje para el tutor…  (⌘K)"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <span className="tutor-composer-hint"><kbd>Enter</kbd> para enviar</span>
          <PromptInputSubmit
            status={isGenerating ? 'streaming' : 'ready'}
            onStop={handleStopTutor}
            disabled={isGenerating ? isAborting : (!canSendTutorMessage || draft.trim().length === 0)}
            aria-label={isGenerating ? 'Detener generación' : 'Enviar mensaje'}
          />
        </PromptInputFooter>
      </PromptInput>
      {tutorThreadError ? <div className="tutor-alert">{tutorThreadError}</div> : null}
      {tutorMutation.error ? (
        <div className="tutor-alert">{tutorMutation.error instanceof Error ? tutorMutation.error.message : 'No se pudo enviar el mensaje al tutor.'}</div>
      ) : null}
      {clearTutorMutation.error ? (
        <div className="tutor-alert">{clearTutorMutation.error instanceof Error ? clearTutorMutation.error.message : 'No se pudo borrar la conversación.'}</div>
      ) : null}
    </aside>
  )

  const tutorRail = (
    <button type="button" className="tutor-rail" onClick={expandTutor} aria-label="Mostrar tutor" title="Mostrar tutor (⌘\\)">
      <span className="tutor-rail-icon"><Bot size={16} /></span>
      <span className="tutor-rail-label">Tutor</span>
      <span className="tutor-rail-shortcut">⌘\</span>
    </button>
  )

  return (
    <StudentAppShell session={session} activeSection="practice" mainClassName="student-shell-main-immersive">
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
              <div className="tutor-sheet-panel">{tutor}</div>
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
                    {tutor}
                  </ResizablePanel>
                </>
              ) : null}
            </ResizablePanelGroup>
            {isTutorCollapsed ? tutorRail : null}
          </>
        )}

        {openArtifactId != null && studentId != null ? (
          <Dialog open onOpenChange={(open) => { if (!open) setOpenArtifactId(null) }}>
            <DialogContent
              className="flex h-[85vh] max-h-[85vh] w-[min(960px,calc(100vw-2rem))] max-w-[min(960px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(960px,calc(100vw-2rem))]"
              showCloseButton={false}
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Demostración interactiva</DialogTitle>
                <DialogDescription>Demostración interactiva creada por el tutor.</DialogDescription>
              </DialogHeader>
              <ArtifactPane
                artifactId={openArtifactId}
                studentId={studentId as Id<'students'>}
                onClose={() => setOpenArtifactId(null)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </StudentAppShell>
  )
}
