import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, PanelRightClose, Sparkles, SquarePlay, Trash2 } from 'lucide-react'
import { extractText } from '@convex-dev/agent'
import { useThreadMessages } from '@convex-dev/agent/react'
import { api } from '@aprendo/convex/api'
import type { Id } from '@aprendo/convex/dataModel'
import { useAction } from 'convex/react'
import { ArtifactPane } from './ArtifactPane.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.tsx'
import MarkdownBlock from './MarkdownBlock.tsx'
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from './ai-elements/conversation.tsx'
import { Message, MessageContent } from './ai-elements/message.tsx'
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from './ai-elements/prompt-input.tsx'
import { Shimmer } from './ai-elements/shimmer.tsx'
import { practiceTutorThreadQuery } from '../lib/student-queries.ts'
import { readConvexError } from '../lib/convex-error.ts'

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

const QUICK_PROMPTS = [
  'Explícame la respuesta',
  'Dame un problema similar',
  '¿Qué debo repasar?',
] as const

/**
 * The review tutor: thread, composer, and the demos it can open.
 *
 * Its own module so the review route can load it with `React.lazy`. The agent
 * client, the ai-elements chat kit (whose message renderer pulls Streamdown's
 * mermaid and shiki plugins) and the artifact dialog weigh hundreds of KB, and
 * most reviews on a phone never open the tutor — so the review renders without
 * them and fetches this chunk the first time the panel is shown. The thread is
 * created then too, not on every review.
 */
export default function ReviewTutor({
  sessionId,
  practiceSessionId,
  studentId,
  questionId,
  isCompact,
  onClose,
  draft,
  onDraftChange,
}: {
  sessionId: string
  practiceSessionId: Id<'sessions'>
  studentId: string
  /** The question on screen, sent along with each prompt as context. */
  questionId: string
  isCompact: boolean
  onClose: () => void
  /** Owned by the route so a collapse/expand remount doesn't lose it. */
  draft: string
  onDraftChange: (value: string) => void
}) {
  const queryClient = useQueryClient()

  const createTutorThread = useConvexMutation(api.tutor.createOrGetPracticeTutorThread)
  const clearTutorChat = useConvexMutation(api.tutor.clearPracticeTutorChat)
  const abortTutorStream = useConvexMutation(api.tutor.abortPracticeTutorStream)
  const sendTutorMessage = useAction(api.tutor.sendPracticeTutorMessage)

  const [hasEnsuredTutorThread, setHasEnsuredTutorThread] = useState(false)
  const [tutorThreadError, setTutorThreadError] = useState<string | null>(null)
  const [isAborting, setIsAborting] = useState(false)
  const [openArtifactId, setOpenArtifactId] = useState<Id<'practiceTutorArtifacts'> | null>(null)
  // The composer's latest text, read when a send fails after it was cleared.
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const tutorThreadQuery = useQuery({
    ...practiceTutorThreadQuery(sessionId, studentId),
    enabled: hasEnsuredTutorThread,
  })
  const tutorThreadId = tutorThreadQuery.data?.threadId ?? null
  const tutorMessagesResult = useThreadMessages(
    api.tutor.listPracticeTutorMessages,
    tutorThreadId == null
      ? 'skip'
      : {
        practiceSessionId: sessionId as never,
        studentId: studentId as never,
        threadId: tutorThreadId,
      },
    { initialNumItems: 50, stream: true },
  )

  useEffect(() => {
    if (hasEnsuredTutorThread) return
    createTutorThread({ practiceSessionId, studentId: studentId as never })
      .then(() => {
        setHasEnsuredTutorThread(true)
        setTutorThreadError(null)
      })
      .catch((error: unknown) => {
        setHasEnsuredTutorThread(true)
        setTutorThreadError(readConvexError(error, 'No se pudo iniciar el tutor.'))
      })
  }, [createTutorThread, hasEnsuredTutorThread, practiceSessionId, studentId])

  const clearTutorMutation = useMutation({
    mutationFn: async () =>
      clearTutorChat({ practiceSessionId, studentId: studentId as never }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: practiceTutorThreadQuery(sessionId, studentId).queryKey,
      })
    },
  })

  const tutorMutation = useMutation({
    mutationFn: async (input: { prompt: string; questionId?: string }) =>
      sendTutorMessage({
        practiceSessionId,
        studentId: studentId as never,
        prompt: input.prompt,
        questionId: input.questionId as never | undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: practiceTutorThreadQuery(sessionId, studentId).queryKey,
      })
    },
  })

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

  const lastMessage = tutorMessages.at(-1)
  const isGenerating = tutorMutation.isPending
  // Show the "thinking" placeholder only until the assistant's streamed reply
  // starts arriving; once deltas land, the streaming bubble takes over.
  const isTutorThinking = isGenerating
    && (lastMessage?.role !== 'assistant' || lastMessage?.streaming !== true)
  const canSendTutorMessage = tutorThreadError == null && tutorThreadId != null && !isGenerating
  // Only a composer send owns the draft: a quick-prompt chip leaves whatever
  // the student is typing alone, and never writes its own text into it.
  const sendTutorPrompt = (text: string, fromComposer = false) => {
    const trimmed = text.trim()
    if (!trimmed || !canSendTutorMessage) return
    tutorMutation.mutate(
      { prompt: trimmed, questionId },
      {
        // A message the server turns away (daily limit, an exam in progress)
        // gives the student back what they wrote, unless they started another.
        onError: () => {
          if (fromComposer && draftRef.current.trim().length === 0) onDraftChange(text)
        },
      },
    )
    if (fromComposer) onDraftChange('')
  }
  const handleStopTutor = () => {
    if (!isGenerating || isAborting || tutorThreadId == null) return
    setIsAborting(true)
    abortTutorStream({
      practiceSessionId,
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

  return (
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
          {!isCompact ? (
            <button type="button" onClick={onClose} title="Ocultar tutor (⌘\\)" aria-label="Ocultar tutor" className="tutor-icon-btn">
              <PanelRightClose size={14} />
            </button>
          ) : (
            <button type="button" onClick={onClose} aria-label="Cerrar" className="tutor-icon-btn">
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
                        // On a phone the sheet steps aside for the demo. It stays
                        // mounted (only hidden), so this dialog stays open.
                        if (isCompact) onClose()
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

      <PromptInput className="tutor-composer" onSubmit={(message) => sendTutorPrompt(message.text, true)}>
        <PromptInputBody>
          <PromptInputTextarea
            data-tutor-input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
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
        <div className="tutor-alert" role="alert">{readConvexError(tutorMutation.error, 'No se pudo enviar el mensaje al tutor.')}</div>
      ) : null}
      {clearTutorMutation.error ? (
        <div className="tutor-alert">{readConvexError(clearTutorMutation.error, 'No se pudo borrar la conversación.')}</div>
      ) : null}

      {openArtifactId != null ? (
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
    </aside>
  )
}
