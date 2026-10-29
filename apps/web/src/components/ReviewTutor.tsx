import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Mic, PanelRightClose, Sparkles, SquarePlay, Trash2, Volume2, VolumeX } from 'lucide-react'
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
import { MarkdownBlock } from './MarkdownBlock.tsx'
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from './ai-elements/conversation.tsx'
import { Message, MessageContent } from './ai-elements/message.tsx'
import { PromptInput, PromptInputBody, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from './ai-elements/prompt-input.tsx'
import { practiceTutorThreadQuery } from '../lib/student-queries.ts'
import { readConvexError } from '../lib/convex-error.ts'
import { cleanTutorReply } from '../lib/tutor-reply.ts'
import { canSpeak, createRecognition, speak, stopSpeaking } from '../lib/speech.ts'
import { readStored, writeStored } from '../lib/solve-state.ts'

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

const QUICK_PROMPTS = {
  review: [
    'Explícame la respuesta',
    'Muéstramelo en una demo interactiva',
    'Dame un problema similar',
    '¿Qué debo repasar?',
  ],
  // Before the key is out the tutor only nudges (tutor.ts): the prompts ask for that.
  solve: [
    'Dame una pista',
    '¿Qué me está preguntando?',
    '¿Cómo descarto opciones?',
    'Muéstramelo en una demo interactiva',
  ],
} as const

/**
 * The review tutor: thread, composer, and the demos it can open.
 *
 * Its own module so the review route can load it with `React.lazy`. The agent
 * client, the ai-elements chat kit (whose message renderer pulls Streamdown's
 * mermaid and shiki plugins) and the artifact dialog weigh hundreds of KB, and
 * most reviews on a phone never open the tutor — so the review renders without
 * them and fetches this chunk the first time the panel is shown.
 *
 * Each question has its own chat (the route keys this on the question), and
 * its thread is created by the first message, not by looking at the question.
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
  mode = 'review',
}: {
  sessionId: string
  practiceSessionId: Id<'sessions'>
  studentId: string
  /** The question on screen: its chat, and the context of each prompt. */
  questionId: string
  isCompact: boolean
  onClose: () => void
  /** Owned by the route so a collapse/expand remount doesn't lose it. */
  draft: string
  onDraftChange: (value: string) => void
  /** 'solve' while the question is open: hint prompts, no "explain the answer". */
  mode?: 'solve' | 'review'
}) {
  const queryClient = useQueryClient()

  const createTutorThread = useConvexMutation(api.tutor.createOrGetPracticeTutorThread)
  const clearTutorChat = useConvexMutation(api.tutor.clearPracticeTutorChat)
  const abortTutorStream = useConvexMutation(api.tutor.abortPracticeTutorStream)
  const sendTutorMessage = useAction(api.tutor.sendPracticeTutorMessage)

  const [isAborting, setIsAborting] = useState(false)
  // Voice, phase 0 (plans/tutor-voz.md): the browser listens and reads aloud; no audio is kept.
  const [readAloud, setReadAloud] = useState(() => readStored('aprendo:tutor-voice') === '1')
  const [isListening, setIsListening] = useState(false)
  const [canListen] = useState(() => createRecognition() != null)
  const recognitionRef = useRef<ReturnType<typeof createRecognition>>(null)
  const spokenIdRef = useRef<string | null | undefined>(undefined)
  const [openArtifactId, setOpenArtifactId] = useState<Id<'practiceTutorArtifacts'> | null>(null)
  // The composer's latest text, read when a send fails after it was cleared.
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const threadQueryOptions = practiceTutorThreadQuery(sessionId, studentId, questionId)
  const tutorThreadQuery = useQuery(threadQueryOptions)
  const tutorThreadId = tutorThreadQuery.data?.threadId ?? null
  const tutorThreadError = tutorThreadQuery.error
    ? readConvexError(tutorThreadQuery.error, 'No se pudo iniciar el tutor.')
    : null
  const tutorMessagesResult = useThreadMessages(
    api.tutor.listPracticeTutorMessages,
    tutorThreadId == null
      ? 'skip'
      : {
        practiceSessionId: sessionId as never,
        studentId: studentId as never,
        questionId: questionId as never,
        threadId: tutorThreadId,
      },
    { initialNumItems: 50, stream: true },
  )

  const clearTutorMutation = useMutation({
    mutationFn: async () =>
      clearTutorChat({ practiceSessionId, studentId: studentId as never, questionId: questionId as never }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: threadQueryOptions.queryKey })
    },
  })

  const tutorMutation = useMutation({
    mutationFn: async (input: { prompt: string }) => {
      const ids = { practiceSessionId, studentId: studentId as never, questionId: questionId as never }
      if (tutorThreadId == null) await createTutorThread(ids)
      return sendTutorMessage({ ...ids, prompt: input.prompt })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: threadQueryOptions.queryKey })
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

      const text = extractText(inner)?.trim() ?? ''
      const content = inner.role === 'assistant' ? cleanTutorReply(text) : text
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
  // Read each finished reply once. What was on screen when the chat loaded is
  // history (null for an empty chat, so its first reply is read).
  const hasLoadedMessages = tutorThreadQuery.isSuccess
    && (tutorThreadId == null || tutorMessagesResult.status !== 'LoadingFirstPage')
  useEffect(() => {
    if (!hasLoadedMessages) return
    if (spokenIdRef.current === undefined) {
      spokenIdRef.current = lastMessage?.id ?? null
      return
    }
    if (lastMessage == null || lastMessage.role !== 'assistant' || lastMessage.streaming === true) return
    if (spokenIdRef.current === lastMessage.id) return
    spokenIdRef.current = lastMessage.id
    if (readAloud) speak(lastMessage.content)
  }, [hasLoadedMessages, lastMessage, readAloud])
  // Leaving the question (the chat is keyed by it) stops the mic and the voice.
  useEffect(() => () => {
    recognitionRef.current?.stop()
    stopSpeaking()
  }, [])
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition = createRecognition()
    if (recognition == null) return
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim()
      // The student sees what was understood and sends it themselves.
      if (transcript.length > 0) onDraftChange(`${draftRef.current} ${transcript}`.trim())
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }
  // A reply still streaming counts too: coming back to its question remounts
  // this without the pending send, and the thread must not get a second one.
  const isGenerating = tutorMutation.isPending || streamingOrder != null
  // Show the "thinking" placeholder only until the assistant's streamed reply
  // starts arriving; once deltas land, the streaming bubble takes over.
  const isTutorThinking = isGenerating
    && (lastMessage?.role !== 'assistant' || lastMessage?.streaming !== true)
  const canSendTutorMessage = tutorThreadError == null && tutorThreadQuery.data != null && !isGenerating
  // Only a composer send owns the draft: a quick-prompt chip leaves whatever
  // the student is typing alone, and never writes its own text into it.
  const sendTutorPrompt = (text: string, fromComposer = false) => {
    const trimmed = text.trim()
    if (!trimmed || !canSendTutorMessage) return
    tutorMutation.mutate(
      { prompt: trimmed },
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
      questionId: questionId as never,
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
            <span className="tutor-subtitle"><Sparkles size={10} /> {mode === 'solve' ? 'pistas' : 'revisión'}</span>
          </div>
        </div>
        <div className="inline-flex items-center gap-1">
          {canSpeak() ? (
            <button
              type="button"
              onClick={() => {
                const next = !readAloud
                setReadAloud(next)
                writeStored('aprendo:tutor-voice', next ? '1' : null)
                if (!next) stopSpeaking()
              }}
              aria-pressed={readAloud}
              title={readAloud ? 'Dejar de leer en voz alta' : 'Leer las respuestas en voz alta'}
              aria-label={readAloud ? 'Dejar de leer en voz alta' : 'Leer las respuestas en voz alta'}
              className="tutor-icon-btn"
            >
              {readAloud ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          ) : null}
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
                {mode === 'solve'
                  ? 'Este chat es solo de esta pregunta. No te doy la respuesta: te ayudo a llegar a ella con pistas y preguntas.'
                  : 'Este chat es solo de esta pregunta. Pídeme que la explique, te la muestre en una demo, te dé otra parecida o te diga qué repasar.'}
              </p>
              <div className="mt-[0.65rem] flex flex-col gap-[0.4rem]" role="group" aria-label="Sugerencias">
                {QUICK_PROMPTS[mode].map((prompt) => (
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
                  {message.content.length > 0 ? <MarkdownBlock markdown={message.content} skipHtml /> : null}
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
                    <span className="tutor-artifact-pending text-xs inline-flex items-center gap-2"><span className="page-loader-dots" aria-hidden><span /><span /><span /></span>Preparando demostración…</span>
                  ) : null}
                </MessageContent>
              </Message>
            ))
          )}
          {isTutorThinking ? (
            <Message from="assistant" className="flex flex-row items-start gap-[0.55rem]">
              <span className="tutor-msg-avatar" aria-hidden><Bot size={12} /></span>
              <MessageContent className="tutor-bubble tutor-bubble-assistant">
                <span className="text-sm inline-flex items-center gap-2"><span className="page-loader-dots" aria-hidden><span /><span /><span /></span>Pensando…</span>
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
            placeholder="Escribe un mensaje para el tutor…"
            enterKeyHint="send"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <span className="tutor-composer-hint"><kbd>Enter</kbd> para enviar</span>
          {canListen ? (
            <button
              type="button"
              className={`tutor-icon-btn${isListening ? ' is-listening' : ''}`}
              onClick={toggleListening}
              aria-pressed={isListening}
              aria-label={isListening ? 'Dejar de escuchar' : 'Hablarle al tutor'}
              title={isListening ? 'Dejar de escuchar' : 'Hablarle al tutor'}
            >
              <Mic size={14} />
            </button>
          ) : null}
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
