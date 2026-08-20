import { abortStream, Agent, createTool, extractText, listMessages, listStreams, syncStreams, vStreamArgs, vStreamMessagesReturnValue } from '@convex-dev/agent'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { stepCountIs } from 'ai'
import { z } from 'zod'
import { internal } from './_generated/api'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { components } from './_generated/api'
import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import type { Doc, Id } from './_generated/dataModel'
import { getSubjectLabel, getSubtopicLabel } from './taxonomy'

const agentComponent = (components as Record<string, unknown>).agent as ConstructorParameters<typeof Agent>[0]

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const BASE_TUTOR_INSTRUCTIONS = [
  'Eres un tutor breve y claro para estudiantes preparando Saber 11.',
  'Responde siempre en español.',
  'Ayuda con estrategias, explicaciones y orientación de estudio.',
  'No inventes detalles que no estén en el contexto proporcionado.',
  'Adicionalmente, tienes acceso a una herramienta llamada `create_artifact` que te permite crear demostraciones interactivas en HTML cuando una visualización o interacción ayude genuinamente al estudiante a entender un concepto. Úsala con criterio: solo cuando aporte algo que el texto no puede. Las reglas detalladas para crear artefactos están en la sección "Demostraciones interactivas (artefactos)" más abajo.',
].join(' ')

const ARTIFACT_AUTHORING_GUIDE = `
## Demostraciones interactivas (artefactos)

Tienes acceso a una herramienta llamada \`create_artifact\` que te permite crear demostraciones interactivas en HTML. Estas demostraciones aparecen en un panel al lado del chat y el estudiante puede interactuar con ellas.

### Cuándo crear un artefacto

Crea un artefacto **solo cuando una demostración interactiva o visual ayude genuinamente** a entender el concepto. Por ejemplo:

- Una visualización geométrica (un triángulo cuyos ángulos el estudiante puede modificar con un slider)
- Una simulación física simple (un objeto cayendo, un péndulo, ondas)
- Un diagrama interactivo (partes de una célula que se etiquetan al hacer clic, mapa con regiones que se resaltan)
- Una representación gráfica de una función matemática
- Una tabla interactiva o gráfico de datos para preguntas de Lectura Crítica o Sociales

**No crees un artefacto cuando:**

- La explicación se puede dar claramente con texto y matemáticas en LaTeX
- El estudiante solo necesita una pista o una aclaración corta
- La pregunta es sobre interpretación de un texto sin componente visual
- Ya hay una imagen suficiente en el enunciado de la pregunta
- Crearías el artefacto solo para "decorar" la respuesta

Regla práctica: si el estudiante puede entender igual de bien con texto, **no uses un artefacto**. Los artefactos son para conceptos donde la interacción o la visualización aporta algo que el texto no puede.

Crea como máximo **un artefacto por respuesta**. Nunca crees varios artefactos en el mismo mensaje.

### Reglas técnicas para el HTML

Cuando llames a \`create_artifact\`, el campo \`html\` debe ser un documento HTML completo y autónomo:

1. **Documento completo:** debe empezar con \`<!DOCTYPE html>\` e incluir \`<html>\`, \`<head>\`, \`<body>\`. El \`<head>\` debe tener \`<meta charset="UTF-8">\` y \`<meta name="viewport" content="width=device-width, initial-scale=1.0">\`.

2. **Todo en un solo archivo:** todo el CSS va dentro de una etiqueta \`<style>\` en el \`<head>\`. Todo el JavaScript va dentro de una etiqueta \`<script>\` justo antes de \`</body>\`. **No uses archivos externos. No uses imports. No cargues librerías de CDN ni de ningún otro lugar.**

3. **Sin librerías externas:** nada de D3, Chart.js, React, jQuery, ni ninguna otra librería. Usa solo HTML, CSS y JavaScript puro (vanilla). Si necesitas un gráfico, dibújalo con SVG o \`<canvas>\`.

4. **Sin \`localStorage\` ni \`sessionStorage\`:** estas APIs no funcionan dentro del artefacto. Guarda el estado solo en variables de JavaScript en memoria.

5. **Idioma:** todos los textos visibles del artefacto deben estar en español. Esto incluye etiquetas, botones, instrucciones, y cualquier texto explicativo.

6. **Tamaño:** el artefacto debe ocupar el 100% del ancho y alto disponibles. Usa \`body { margin: 0; height: 100vh; }\` y diseña tu layout para que se adapte al contenedor.

### Reglas de diseño

El artefacto se renderiza al lado del chat del tutor, en un panel que puede ser estrecho. Diseña pensando en eso:

- **Tipografía:** usa una fuente del sistema: \`font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\`
- **Paleta:** usa colores sobrios y de alto contraste. Fondo blanco o muy claro, texto oscuro. Para acentos puedes usar el azul \`#2563eb\` (azul de Aprendo). Evita degradados llamativos, sombras pesadas, o paletas con muchos colores.
- **Espaciado:** usa espaciado generoso. Los estudiantes están aprendiendo, no compitiendo por espacio.
- **Tamaño de texto:** mínimo 14px para texto secundario, 16px para texto principal. Los títulos pueden ser más grandes.
- **Controles:** botones, sliders y otros controles deben ser claramente visibles y tener estados de hover y focus visibles.
- **Sin emojis decorativos:** no uses emojis para "alegrar" la interfaz. Esto es una herramienta educativa, no una app de redes sociales.
- **Accesibilidad:** usa elementos semánticos (\`<button>\` no \`<div onclick>\`), \`<label>\` para inputs, y suficiente contraste de color.

### Reglas pedagógicas

- **Una idea por artefacto:** cada artefacto debe ilustrar un solo concepto. Si la pregunta abarca varios conceptos, elige el más importante.
- **Manipulable, no animación pasiva:** prefiere artefactos donde el estudiante hace algo (mover un slider, hacer clic, arrastrar) sobre animaciones que solo se reproducen.
- **Descubrimiento, no respuesta:** el artefacto debe ayudar al estudiante a *descubrir* algo, no darle la respuesta directamente. Por ejemplo, antes de que el estudiante haya respondido, no le muestres "esta es la respuesta correcta visualizada". Muéstrale una herramienta con la que pueda explorar el concepto y llegar a la respuesta.
- **Instrucciones cortas y claras:** incluye 1-2 líneas de instrucción al inicio del artefacto explicando qué puede hacer el estudiante. Sin párrafos largos.

### Campos de la herramienta

- \`title\`: título corto en español, máximo 6 palabras. Ejemplo: \`"Suma de ángulos en un triángulo"\`.
- \`description\`: una sola oración en español que explica qué hace el artefacto. Ejemplo: \`"Mueve los vértices del triángulo y observa cómo cambian los ángulos."\`
- \`html\`: el documento HTML completo siguiendo todas las reglas anteriores.
`.trim()

const createArtifactTool = createTool({
  description:
    'Crea una demostración interactiva en HTML que se renderiza al lado del chat. Úsala solo cuando una visualización o interacción ayude genuinamente al estudiante a entender un concepto. Máximo un artefacto por respuesta.',
  inputSchema: z.object({
    title: z
      .string()
      .min(1)
      .max(80)
      .describe('Título corto en español, máximo 6 palabras.'),
    description: z
      .string()
      .min(1)
      .max(240)
      .describe('Una sola oración en español que explica qué hace el artefacto.'),
    html: z
      .string()
      .min(1)
      .describe(
        'Documento HTML completo y autónomo (DOCTYPE + html + head + body). Todo el CSS en <style>, todo el JS en <script>. Sin librerías externas, sin imports, sin CDN. Textos en español.',
      ),
  }),
  execute: async (ctx, input): Promise<{
    artifactId: Id<'practiceTutorArtifacts'>
    title: string
    description: string
  }> => {
    if (ctx.threadId == null || ctx.userId == null) {
      throw new Error('create_artifact requires a thread and user context.')
    }
    const messageId = ctx.messageId ?? null
    const result: { artifactId: Id<'practiceTutorArtifacts'> } = await ctx.runMutation(
      internal.tutor.persistArtifact,
      {
        threadId: ctx.threadId,
        studentId: ctx.userId as Id<'students'>,
        messageId,
        title: input.title,
        description: input.description,
        htmlBody: input.html,
      },
    )
    return {
      artifactId: result.artifactId,
      title: input.title,
      description: input.description,
    }
  },
})

const tutorAgent = new Agent(agentComponent, {
  name: 'Tutor',
  languageModel: openrouter('deepseek/deepseek-v4-pro'),
  instructions: [
    BASE_TUTOR_INSTRUCTIONS,
    'Si no recibes contexto sobre la pregunta actual, dilo claramente y pide la información necesaria.',
  ].join(' '),
  tools: {
    create_artifact: createArtifactTool,
  },
})

type QuestionContext = {
  questionNumber: number
  subjectLabel: string
  subtopicLabel: string
  /**
   * The shared stimulus when the question belongs to a group. Without it the
   * tutor would be answering about a text it cannot see.
   */
  contextMarkdown: string | null
  bodyMarkdown: string
  options: { label: string; bodyMarkdown: string }[]
  correctOption: string | null
  officialExplanation: string | null
  attempt: {
    selectedOption: string
    isCorrect: boolean
  } | null
}

function buildTutorSystemPrompt(question: QuestionContext | null): string {
  if (question == null) {
    return [
      BASE_TUTOR_INSTRUCTIONS,
      'No tienes contexto sobre una pregunta actual; pídeselo al estudiante si hace falta.',
      '',
      ARTIFACT_AUTHORING_GUIDE,
    ].join('\n')
  }

  const lines: string[] = [
    BASE_TUTOR_INSTRUCTIONS,
    '',
    ARTIFACT_AUTHORING_GUIDE,
    '',
    '## Pregunta actual',
  ]
  lines.push(`Asignatura: ${question.subjectLabel}`)
  lines.push(`Subtema: ${question.subtopicLabel}`)
  lines.push(`Número: ${question.questionNumber}`)
  if (question.contextMarkdown != null) {
    lines.push('')
    lines.push('Texto compartido en el que se basa la pregunta:')
    lines.push(question.contextMarkdown)
  }
  lines.push('')
  lines.push('Enunciado:')
  lines.push(question.bodyMarkdown)
  lines.push('')
  lines.push('Opciones:')
  for (const option of question.options) {
    lines.push(`  ${option.label}) ${option.bodyMarkdown}`)
  }

  if (question.attempt != null) {
    const attemptResult = question.attempt.isCorrect ? 'correcta' : 'incorrecta'
    lines.push('')
    lines.push(`El estudiante ya respondió: ${question.attempt.selectedOption} (${attemptResult}).`)
    if (question.correctOption != null) {
      lines.push(`Respuesta correcta: ${question.correctOption}.`)
    }
    if (question.officialExplanation != null) {
      lines.push('Explicación oficial:')
      lines.push(question.officialExplanation)
    }
    if (question.correctOption != null) {
      lines.push('Puedes confirmar la respuesta correcta y explicar el razonamiento si el estudiante lo pide.')
    } else {
      lines.push('La sesión todavía no está en revisión. NO reveles ni confirmes la respuesta correcta; ayuda con pistas y razonamiento.')
    }
  } else {
    lines.push('')
    lines.push('El estudiante AÚN NO ha respondido esta pregunta.')
    lines.push('NO reveles cuál es la respuesta correcta directamente.')
    lines.push('Guíalo con pistas y preguntas socráticas; ayúdalo a descartar opciones sin afirmar cuál es la correcta.')
  }

  return lines.join('\n')
}

async function requireOwnedPracticeSession(
  ctx: { db: { get: (id: Id<'sessions'>) => Promise<Doc<'sessions'> | null> } },
  args: {
    practiceSessionId: Id<'sessions'>
    studentId: Id<'students'>
  },
) {
  // The tutor works for any session kind (recommended, topic, simulacro,
  // diagnostic review). Answer disclosure is gated separately by session
  // status, not by kind.
  const session = await ctx.db.get(args.practiceSessionId)
  if (session == null) {
    throw new Error('Session not found.')
  }
  if (session.studentId !== args.studentId) {
    throw new Error('Session does not belong to this student.')
  }
  return session
}

export const getPracticeTutorThreadMapping = internalQuery({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await requireOwnedPracticeSession(ctx, args)

    const mapping = await ctx.db
      .query('practiceTutorThreads')
      .withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', args.practiceSessionId))
      .unique()

    return mapping
  },
})

export const touchPracticeTutorThread = internalMutation({
  args: {
    practiceSessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query('practiceTutorThreads')
      .withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', args.practiceSessionId))
      .unique()
    if (mapping == null) return

    await ctx.db.patch(mapping._id, {
      updatedAt: Date.now(),
    })
  },
})

export const createOrGetPracticeTutorThread = mutation({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await requireOwnedPracticeSession(ctx, args)

    const existing = await ctx.db
      .query('practiceTutorThreads')
      .withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', args.practiceSessionId))
      .unique()
    if (existing) {
      return {
        threadId: existing.threadId,
      }
    }

    const { threadId } = await tutorAgent.createThread(ctx, {
      userId: args.studentId,
      title: `practice:${args.practiceSessionId}`,
    })
    const now = Date.now()

    await ctx.db.insert('practiceTutorThreads', {
      practiceSessionId: args.practiceSessionId,
      studentId: args.studentId,
      threadId,
      createdAt: now,
      updatedAt: now,
    })

    return { threadId }
  },
})

export const clearPracticeTutorChat = mutation({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await requireOwnedPracticeSession(ctx, args)

    const mapping = await ctx.db
      .query('practiceTutorThreads')
      .withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', args.practiceSessionId))
      .unique()
    if (mapping == null) {
      throw new Error('Tutor thread not found for this practice session.')
    }

    const oldThreadId = mapping.threadId

    const { threadId: newThreadId } = await tutorAgent.createThread(ctx, {
      userId: args.studentId,
      title: `practice:${args.practiceSessionId}`,
    })

    const now = Date.now()
    await ctx.db.patch(mapping._id, {
      threadId: newThreadId,
      updatedAt: now,
    })

    // Recursively delete the old thread's messages + streams in the background.
    // The agent component schedules subsequent batches via the Convex scheduler,
    // so this returns quickly and the UI re-points to the new thread immediately.
    await tutorAgent.deleteThreadAsync(ctx, { threadId: oldThreadId })

    return { threadId: newThreadId }
  },
})

export const getPracticeTutorThread = query({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await requireOwnedPracticeSession(ctx, args)

    const mapping = await ctx.db
      .query('practiceTutorThreads')
      .withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', args.practiceSessionId))
      .unique()

    if (mapping == null) {
      return {
        threadId: null,
        messages: [],
      }
    }

    const paginated = await listMessages(ctx, agentComponent, {
      threadId: mapping.threadId,
      paginationOpts: { cursor: null, numItems: 50 },
      excludeToolMessages: false,
      statuses: ['success', 'failed'],
    })

    return {
      threadId: mapping.threadId,
      messages: paginated.page
        .flatMap((message) => {
          if (message.message == null) return []

          return [{
            id: message._id,
            role: message.message.role,
            content: extractText(message.message) ?? '',
          }]
        })
        .filter((message) =>
          (message.role === 'user' || message.role === 'assistant')
          && message.content.trim().length > 0,
        ),
    }
  },
})

export const listPracticeTutorMessages = query({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs),
  },
  handler: async (ctx, args) => {
    await requireOwnedPracticeSession(ctx, {
      practiceSessionId: args.practiceSessionId,
      studentId: args.studentId,
    })

    const mapping = await ctx.db
      .query('practiceTutorThreads')
      .withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', args.practiceSessionId))
      .unique()
    if (mapping == null) {
      throw new Error('Tutor thread not found for this practice session.')
    }
    // If the requested threadId doesn't match the current mapping, the client
    // is mid-transition (e.g. the chat was just cleared and the thread was
    // rotated). Return an empty page; the client will resubscribe with the new
    // threadId on the next reactive tick. Throwing here causes spurious errors.
    if (mapping.threadId !== args.threadId) {
      const emptyStreams = await syncStreams(ctx, agentComponent, {
        threadId: args.threadId,
        streamArgs: args.streamArgs,
      })
      return {
        page: [],
        isDone: true,
        continueCursor: '',
        streams: emptyStreams,
      }
    }

    const paginated = await listMessages(ctx, agentComponent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
      excludeToolMessages: false,
      statuses: ['success', 'failed', 'pending'],
    })
    const streams = await syncStreams(ctx, agentComponent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    })

    return {
      ...paginated,
      streams,
    }
  },
  returns: vStreamMessagesReturnValue,
})

export const getPracticeQuestionContext = internalQuery({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
    questionId: v.id('questions'),
  },
  handler: async (ctx, args): Promise<QuestionContext | null> => {
    const session = await requireOwnedPracticeSession(ctx, args)

    const question = await ctx.db.get(args.questionId)
    if (question == null) return null

    const attempt = await ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId_sessionId', (q) =>
        q.eq('studentId', args.studentId).eq('sessionId', args.practiceSessionId),
      )
      .filter((q) => q.eq(q.field('questionId'), args.questionId))
      .unique()

    const subjectLabel = question.subjectId
      ? getSubjectLabel(question.subjectId)
      : 'Sin asignar'
    const subtopicLabel = question.primarySubtopicId
      ? getSubtopicLabel(question.primarySubtopicId)
      : 'Sin subtema'

    const isAnswered = attempt != null && attempt.selectedOption != null && attempt.isCorrect != null
    const canReviewAnswers = session.status === 'completed'

    const group = question.groupId == null ? null : await ctx.db.get(question.groupId)

    return {
      questionNumber: question.questionNumber,
      subjectLabel,
      subtopicLabel,
      contextMarkdown: group?.contextMarkdown ?? null,
      bodyMarkdown: question.bodyMarkdown,
      options: question.options.map((option) => ({
        label: option.label,
        bodyMarkdown: option.bodyMarkdown,
      })),
      correctOption: canReviewAnswers ? question.answerCorrectOption ?? null : null,
      officialExplanation: canReviewAnswers ? question.answerSolutionMarkdown ?? null : null,
      attempt: isAnswered
        ? {
            selectedOption: attempt!.selectedOption!,
            isCorrect: attempt!.isCorrect!,
          }
        : null,
    }
  },
})

export const sendPracticeTutorMessage = action({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
    prompt: v.string(),
    questionId: v.optional(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.runQuery(internal.tutor.getPracticeTutorThreadMapping, {
      practiceSessionId: args.practiceSessionId,
      studentId: args.studentId,
    })
    if (mapping == null) {
      throw new Error('Tutor thread not found for this practice session.')
    }

    const questionContext = args.questionId != null
      ? await ctx.runQuery(internal.tutor.getPracticeQuestionContext, {
          practiceSessionId: args.practiceSessionId,
          studentId: args.studentId,
          questionId: args.questionId,
        })
      : null

    const system = buildTutorSystemPrompt(questionContext)

    const { thread } = await tutorAgent.continueThread(ctx, {
      threadId: mapping.threadId,
      userId: args.studentId,
    })
    const result = await thread.streamText(
      {
        prompt: args.prompt,
        system,
        maxOutputTokens: 8000,
        stopWhen: stepCountIs(4),
      },
      {
        storageOptions: {
          saveMessages: 'all',
        },
        saveStreamDeltas: true,
      },
    )

    return {
      promptMessageId: result.promptMessageId,
      order: result.order,
    }
  },
})

const ABORT_REASON = 'Cancelado por el estudiante.'

export const abortPracticeTutorStream = mutation({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
    threadId: v.string(),
    // The order of the streaming message to abort. If omitted, every active
    // stream on the thread is aborted (e.g. when the stream hasn't surfaced an
    // order on the client yet).
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwnedPracticeSession(ctx, {
      practiceSessionId: args.practiceSessionId,
      studentId: args.studentId,
    })

    // Make sure the thread we're aborting actually belongs to this session.
    const mapping = await ctx.db
      .query('practiceTutorThreads')
      .withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', args.practiceSessionId))
      .unique()
    if (mapping == null || mapping.threadId !== args.threadId) {
      return false
    }

    if (args.order != null) {
      return await abortStream(ctx, agentComponent, {
        threadId: args.threadId,
        order: args.order,
        reason: ABORT_REASON,
      })
    }

    const streams = await listStreams(ctx, agentComponent, {
      threadId: args.threadId,
      includeStatuses: ['streaming'],
    })
    let aborted = false
    for (const stream of streams) {
      const didAbort = await abortStream(ctx, agentComponent, {
        streamId: stream.streamId,
        reason: ABORT_REASON,
      })
      aborted = didAbort || aborted
    }
    return aborted
  },
})

export const persistArtifact = internalMutation({
  args: {
    threadId: v.string(),
    studentId: v.id('students'),
    messageId: v.union(v.string(), v.null()),
    title: v.string(),
    description: v.optional(v.string()),
    htmlBody: v.string(),
  },
  handler: async (ctx, args) => {
    const mapping = await ctx.db
      .query('practiceTutorThreads')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .filter((q) => q.eq(q.field('threadId'), args.threadId))
      .unique()
    if (mapping == null) {
      throw new Error('Tutor thread not found for this student.')
    }

    await requireOwnedPracticeSession(ctx, {
      practiceSessionId: mapping.practiceSessionId,
      studentId: args.studentId,
    })

    const artifactId = await ctx.db.insert('practiceTutorArtifacts', {
      threadId: args.threadId,
      messageId: args.messageId ?? '',
      practiceSessionId: mapping.practiceSessionId,
      studentId: args.studentId,
      title: args.title,
      description: args.description,
      htmlBody: args.htmlBody,
      createdAt: Date.now(),
    })

    return { artifactId }
  },
})

export const getArtifact = query({
  args: {
    artifactId: v.id('practiceTutorArtifacts'),
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    const artifact = await ctx.db.get(args.artifactId)
    if (artifact == null) return null
    if (artifact.studentId !== args.studentId) {
      throw new Error('Artifact does not belong to this student.')
    }
    return artifact
  },
})

export const listArtifactsForThread = query({
  args: {
    practiceSessionId: v.id('sessions'),
    studentId: v.id('students'),
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwnedPracticeSession(ctx, {
      practiceSessionId: args.practiceSessionId,
      studentId: args.studentId,
    })

    const rows = await ctx.db
      .query('practiceTutorArtifacts')
      .withIndex('by_threadId', (q) => q.eq('threadId', args.threadId))
      .collect()

    return rows.map((row) => ({
      _id: row._id,
      messageId: row.messageId,
      title: row.title,
      description: row.description,
      createdAt: row.createdAt,
    }))
  },
})
