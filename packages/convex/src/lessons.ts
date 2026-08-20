import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, mutation, query } from './_generated/server'
import { requireAuthenticatedStudentId } from './auth'
import { decideClaim } from './aiCache'
import { type SubtopicContext, getSubtopicContext } from './taxonomy'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

/** Model + prompt version. Bump PROMPT_VERSION to invalidate and regenerate cached lessons. */
const LESSON_MODEL = 'deepseek/deepseek-v4-pro'
const PROMPT_VERSION = 'v5'

// ── Phase 1: the explanation (fast, reliable). Also decides whether an
// interactive demo would genuinely help, and if so what it should show. ──
const textSchema = z.object({
  ideaBody: z
    .string()
    .describe(
      'La explicación que ENSEÑA el concepto, estilo Khan Academy: empieza por la intuición, construye la idea paso a paso con al menos un ejemplo concreto y cotidiano, y cierra con por qué/para qué sirve. Markdown bien estructurado (subtítulos con ##, listas, $...$ para fórmulas). Claro y completo, pero sin relleno: que un estudiante de grado 11 entienda el tema de verdad. NO incluyas preguntas de práctica, quizzes, "errores comunes" ni formatos de examen.',
    ),
  demoConcept: z
    .string()
    .optional()
    .describe(
      'OPCIONAL: si —y solo si— una visualización o manipulación interactiva ayudaría a entender este subtema mejor que el texto, describe en 1-2 frases qué debería mostrar/permitir manipular el estudiante. Debe ser una herramienta para EXPLORAR y construir intuición (mover, arrastrar, observar), NUNCA una pregunta, quiz o ejercicio evaluado (para practicar ya hay otra función). Omítelo para subtemas puramente verbales/textuales (p. ej. comprensión lectora).',
    ),
})

// ── Phase 2: the interactive demo, as a *body fragment* the app themes itself
// (see DEMO_FRAGMENT_RULES). Generated only when phase 1 asked for one. ──
const demoSchema = z.object({
  html: z
    .string()
    .describe(
      'Fragmento HTML de la demo (sin <!DOCTYPE>/<html>/<head>/<body>): un contenedor raíz, un <style> y un <script> vanilla. Usa las variables CSS de la app; no codifiques colores ni fuentes.',
    ),
})

const LESSON_SYSTEM = [
  'Eres un experto en el examen ICFES Saber 11 de Colombia y un excelente profesor de bachillerato.',
  'Generas micro-lecciones claras, motivadoras y rigurosas para estudiantes.',
  'Responde SIEMPRE en español.',
  'No inventes datos; cuando un concepto sea abstracto, explícalo con un ejemplo concreto y cotidiano (colombiano cuando ayude).',
].join(' ')

/**
 * The demo is a *fragment* embedded in a host document that already provides the
 * app's fonts, color tokens and base styles. The model must use those tokens so
 * the demo looks like part of Aprendo, not a generic web page dropped into an
 * iframe.
 */
const DEMO_FRAGMENT_RULES = [
  'Devuelve SOLO el fragmento de la demo: un único elemento contenedor raíz, más una etiqueta <style> y una etiqueta <script> (JavaScript vanilla). NO incluyas <!DOCTYPE>, <html>, <head> ni <body>: el documento anfitrión ya existe.',
  'El anfitrión ya define las fuentes y un tema (claro/oscuro) mediante variables CSS. ÚSALAS y NO codifiques colores hex ni familias tipográficas propias:',
  '- Marca/primario: var(--brand) (alias: var(--accent)); texto sobre la marca: var(--text-inverted); fondo suave de marca: var(--accent-soft).',
  '- Superficies: var(--bg) (fondo), var(--bg-card) (tarjetas), var(--bg-inset) (hundido).',
  '- Texto: var(--text-primary), var(--text-secondary), var(--text-tertiary).',
  '- Bordes: var(--border); contorno grueso: var(--border-hard). Radios: var(--radius-md), var(--radius-sm).',
  '- Semánticos: var(--success) (acierto), var(--danger) (error), var(--gold) (destacado/recompensa).',
  '- Tipografía: var(--font-sans) para el cuerpo; var(--font-display) para títulos (sans display, gruesa: usa font-weight 700).',
  'Estilo visual de la app: juvenil y con volumen. Los elementos interactivos llevan contorno de 2px (var(--border-hard)) y una sombra dura sin desenfoque (box-shadow: 0 3px 0 var(--border-hard)) que se hunde al presionar. Radios generosos.',
  'No uses CDN, imports ni librerías externas (nada de D3/Chart/React/jQuery); nada de localStorage/sessionStorage. Para gráficos usa SVG o <canvas> dibujado a mano (puedes usar currentColor o las variables anteriores para que respeten el tema).',
  'Diseño: limpio, mucho espacio en blanco, controles (sliders/botones) claramente visibles y con estados de foco. El fragmento debe adaptarse al 100% del ancho disponible; no fijes un alto en vh.',
  'Debe ser MANIPULABLE (sliders, clics, arrastrar) con 1-2 líneas de instrucción al inicio, no una animación pasiva. Todos los textos en español.',
  'NO generes preguntas, quizzes, ejercicios de opción múltiple, ni nada que evalúe o califique al estudiante: la práctica con preguntas es otra función de la app. La demo es solo para EXPLORAR y construir intuición sobre el concepto.',
].join('\n')

function buildTextPrompt(context: SubtopicContext): string {
  return [
    'Escribe una lección para ENSEÑAR el siguiente tema a un estudiante de grado 11 (estilo Khan Academy):',
    `- Materia: ${context.subjectLabel}`,
    `- Categoría: ${context.categoryLabel}`,
    `- Tema: ${context.label}`,
    '',
    'El objetivo es que entienda el concepto a fondo (ideaBody), no prepararlo para el examen.',
    'Decide con criterio si una demo interactiva aportaría (demoConcept); para muchos temas el texto basta.',
    'Tono cercano pero preciso. No incluyas preguntas de práctica ni secciones sobre el formato del ICFES.',
  ].join('\n')
}

function buildDemoPrompt(context: SubtopicContext, demoConcept: string): string {
  return [
    `Crea una demostración interactiva para el subtema "${context.label}" (${context.subjectLabel}).`,
    `Concepto de la demo: ${demoConcept}`,
    '',
    DEMO_FRAGMENT_RULES,
  ].join('\n')
}

export const getConceptLesson = query({
  args: {
    subtopicId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedStudentId(ctx)
    return ctx.db
      .query('conceptLessons')
      .withIndex('by_subtopicId', (q) => q.eq('subtopicId', args.subtopicId))
      .unique()
  },
})

/**
 * Ensure a lesson exists for the subtopic, generating it on demand. Atomically
 * claims the work (status `generating`, stage `writing`) so concurrent viewers
 * of the same subtopic don't trigger duplicate generations — Convex's
 * serializable mutations make the claim race-free. The regeneration policy
 * (failed / stale prompt version / stuck action) lives in `decideClaim`.
 */
export const requestConceptLesson = mutation({
  args: {
    subtopicId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedStudentId(ctx)
    const context = getSubtopicContext(args.subtopicId)
    if (context == null) {
      throw new ConvexError('Subtema no válido.')
    }

    const existing = await ctx.db
      .query('conceptLessons')
      .withIndex('by_subtopicId', (q) => q.eq('subtopicId', args.subtopicId))
      .unique()
    const now = Date.now()

    const schedule = async () => {
      await ctx.scheduler.runAfter(0, internal.lessons.generateConceptLesson, {
        subtopicId: args.subtopicId,
      })
    }

    const decision = decideClaim({ existing, promptVersion: PROMPT_VERSION, now })

    if (decision === 'create') {
      await ctx.db.insert('conceptLessons', {
        subtopicId: args.subtopicId,
        subjectId: context.subjectId,
        status: 'generating',
        stage: 'writing',
        modelId: LESSON_MODEL,
        promptVersion: PROMPT_VERSION,
        createdAt: now,
        updatedAt: now,
      })
      await schedule()
      return { status: 'generating' as const }
    }

    if (decision === 'reclaim') {
      await ctx.db.patch(existing!._id, {
        status: 'generating',
        stage: 'writing',
        modelId: LESSON_MODEL,
        promptVersion: PROMPT_VERSION,
        failureReason: undefined,
        updatedAt: now,
      })
      await schedule()
      return { status: 'generating' as const }
    }

    return { status: existing!.status }
  },
})

export const generateConceptLesson = internalAction({
  args: {
    subtopicId: v.string(),
  },
  handler: async (ctx, args) => {
    const context = getSubtopicContext(args.subtopicId)
    if (context == null) {
      await ctx.runMutation(internal.lessons.markConceptLessonFailed, {
        subtopicId: args.subtopicId,
        failureReason: 'Subtema no válido.',
      })
      return
    }

    // Phase 1 — text sections. A failure here fails the whole lesson.
    let demoConcept: string | undefined
    try {
      const { object } = await generateObject({
        model: openrouter(LESSON_MODEL),
        schema: textSchema,
        system: LESSON_SYSTEM,
        prompt: buildTextPrompt(context),
        maxOutputTokens: 4000,
      })
      demoConcept = object.demoConcept?.trim() || undefined
      await ctx.runMutation(internal.lessons.markConceptLessonText, {
        subtopicId: args.subtopicId,
        ideaBody: object.ideaBody,
        buildingDemo: demoConcept != null,
      })
    } catch (error) {
      await ctx.runMutation(internal.lessons.markConceptLessonFailed, {
        subtopicId: args.subtopicId,
        failureReason: error instanceof Error ? error.message : 'Error de generación.',
      })
      return
    }

    // No demo warranted — the lesson is complete with text alone.
    if (demoConcept == null) {
      await ctx.runMutation(internal.lessons.markConceptLessonReady, { subtopicId: args.subtopicId })
      return
    }

    // Phase 2 — interactive demo. The demo is optional: if it fails, publish the
    // lesson with its text rather than failing the whole thing.
    try {
      const { object } = await generateObject({
        model: openrouter(LESSON_MODEL),
        schema: demoSchema,
        system: LESSON_SYSTEM,
        prompt: buildDemoPrompt(context, demoConcept),
        maxOutputTokens: 6000,
      })
      await ctx.runMutation(internal.lessons.markConceptLessonReady, {
        subtopicId: args.subtopicId,
        demoHtml: object.html,
      })
    } catch {
      await ctx.runMutation(internal.lessons.markConceptLessonReady, { subtopicId: args.subtopicId })
    }
  },
})

/** Phase-1 result: persist the explanation; stay `generating` if a demo follows. */
export const markConceptLessonText = internalMutation({
  args: {
    subtopicId: v.string(),
    ideaBody: v.string(),
    buildingDemo: v.boolean(),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db
      .query('conceptLessons')
      .withIndex('by_subtopicId', (q) => q.eq('subtopicId', args.subtopicId))
      .unique()
    if (lesson == null) return
    await ctx.db.patch(lesson._id, {
      ideaBody: args.ideaBody,
      stage: args.buildingDemo ? 'demo' : undefined,
      updatedAt: Date.now(),
    })
  },
})

/** Finalize the lesson as `ready`, attaching the demo if one was produced. */
export const markConceptLessonReady = internalMutation({
  args: {
    subtopicId: v.string(),
    demoHtml: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db
      .query('conceptLessons')
      .withIndex('by_subtopicId', (q) => q.eq('subtopicId', args.subtopicId))
      .unique()
    if (lesson == null) return
    const now = Date.now()
    await ctx.db.patch(lesson._id, {
      status: 'ready',
      stage: undefined,
      demoHtml: args.demoHtml,
      failureReason: undefined,
      generatedAt: now,
      updatedAt: now,
    })
  },
})

export const markConceptLessonFailed = internalMutation({
  args: {
    subtopicId: v.string(),
    failureReason: v.string(),
  },
  handler: async (ctx, args) => {
    const lesson = await ctx.db
      .query('conceptLessons')
      .withIndex('by_subtopicId', (q) => q.eq('subtopicId', args.subtopicId))
      .unique()
    if (lesson == null) return
    await ctx.db.patch(lesson._id, {
      status: 'failed',
      stage: undefined,
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    })
  },
})
