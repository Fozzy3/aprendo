// ponytail: dev tool, not product code. Times the tutor's model call so latency
// choices in `aiProvider.ts` rest on numbers. Run on DEV only:
//   bunx convex run llmBench:run
// Each run spends a few cents of OpenRouter credit; keep it rare.
import { stepCountIs, streamText, tool } from 'ai'
import { z } from 'zod'
import type { OpenRouterChatSettings } from '@openrouter/ai-sdk-provider'
import { Agent, listStreams } from '@convex-dev/agent'
import { components, internal } from './_generated/api'
import { internalAction, internalQuery } from './_generated/server'
import { aprendoModel, APRENDO_MODEL_ID, APRENDO_MODEL_SETTINGS } from './aiProvider'
import { buildTutorSystemPrompt } from './tutor'

const QUESTION = {
  questionNumber: 12,
  subjectLabel: 'Matemáticas',
  subtopicLabel: 'Proporcionalidad',
  contextMarkdown: null,
  bodyMarkdown: 'Una receta usa 3 tazas de harina para 12 galletas. ¿Cuántas tazas se necesitan para 30 galletas?',
  options: [
    { label: 'A', bodyMarkdown: '6' },
    { label: 'B', bodyMarkdown: '7,5' },
    { label: 'C', bodyMarkdown: '9' },
    { label: 'D', bodyMarkdown: '10' },
  ],
  correctOption: 'B',
  officialExplanation: 'Es una proporción directa: 3/12 = x/30, así que x = 7,5.',
  demoIdea: 'la gráfica de la función con parámetros que se arrastran y una tabla de valores enlazada.',
  attempt: { selectedOption: 'C', isCorrect: false },
}

type Config = { label: string; modelId: string; settings: OpenRouterChatSettings }

const NO_REASONING: OpenRouterChatSettings = { reasoning: { effort: 'none' } }

// Round 1 (2026-11-11) also had: no-reasoning default routing, sort=throughput,
// qwen/qwen3.7-flash and mistralai/mistral-small-2603. See `aiProvider.ts`.
const CONFIGS: Config[] = [
  { label: 'default routing, settings {}', modelId: APRENDO_MODEL_ID, settings: {} },
  { label: 'sort=latency, any quantization', modelId: APRENDO_MODEL_ID, settings: { ...NO_REASONING, provider: { sort: 'latency' } } },
  { label: 'current (APRENDO_MODEL_SETTINGS)', modelId: APRENDO_MODEL_ID, settings: APRENDO_MODEL_SETTINGS },
]

const PROMPTS = ['Dame una pista', 'Explícame la respuesta', '¿Por qué no es la C?']

export const ping = internalQuery({ args: {}, handler: async () => null })

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    // What one action → query hop costs: the tutor makes several before the model.
    const hops: number[] = []
    for (let i = 0; i < 5; i += 1) {
      const start = Date.now()
      await ctx.runQuery(internal.llmBench.ping, {})
      hops.push(Date.now() - start)
    }

    const system = buildTutorSystemPrompt(QUESTION)
    const rows = []
    for (const config of CONFIGS) {
      for (const prompt of PROMPTS) {
        const start = Date.now()
        let firstReasoning: number | null = null
        let firstText: number | null = null
        let text = ''
        try {
          const result = streamText({
            model: aprendoModel(config.modelId, config.settings),
            system,
            prompt,
            temperature: 0.3,
            maxOutputTokens: 8000,
            stopWhen: stepCountIs(1),
            tools: {
              create_artifact: tool({
                description: 'Crea una demostración interactiva en HTML.',
                inputSchema: z.object({ title: z.string(), description: z.string(), html: z.string() }),
              }),
            },
          })
          for await (const part of result.fullStream) {
            if (part.type === 'reasoning-delta' && firstReasoning == null) firstReasoning = Date.now() - start
            if (part.type === 'text-delta') {
              if (firstText == null) firstText = Date.now() - start
              text += part.text
            }
          }
          const usage = await result.usage
          const metadata = (await result.providerMetadata) as { openrouter?: { provider?: string } } | undefined
          rows.push({
            config: config.label,
            prompt,
            firstReasoningMs: firstReasoning,
            ttftMs: firstText,
            totalMs: Date.now() - start,
            outputTokens: usage.outputTokens,
            reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? usage.reasoningTokens,
            words: text.split(/\s+/).filter(Boolean).length,
            provider: metadata?.openrouter?.provider ?? null,
            reply: text.slice(0, 160),
          })
        } catch (error) {
          rows.push({ config: config.label, prompt, error: error instanceof Error ? error.message.slice(0, 200) : String(error) })
        }
      }
    }
    return { hopMs: hops, promptChars: system.length, rows }
  },
})

/**
 * The tutor's real path minus the app's own checks: an agent thread, the
 * prompt saved, deltas written. Times when the first text delta is readable
 * from the database, which is what the student's subscription sees.
 */
export const e2e = internalAction({
  args: {},
  handler: async (ctx) => {
    const agent = new Agent(components.agent as ConstructorParameters<typeof Agent>[0], { name: 'Bench', languageModel: aprendoModel() })
    const system = buildTutorSystemPrompt(QUESTION)
    const rows = []
    for (const throttleMs of [250, 100]) {
      for (const prompt of PROMPTS) {
        const { threadId, thread } = await agent.createThread(ctx, {})
        const start = Date.now()
        const done = thread.streamText(
          { prompt, system, temperature: 0.3, maxOutputTokens: 8000 },
          { saveStreamDeltas: { throttleMs } },
        )
        let firstVisible: number | null = null
        while (firstVisible == null && Date.now() - start < 15_000) {
          const streams = await listStreams(ctx, components.agent as never, { threadId })
          if (streams.length > 0) {
            const deltas = await ctx.runQuery(components.agent.streams.listDeltas, {
              threadId,
              cursors: streams.map((stream) => ({ streamId: stream.streamId, cursor: 0 })),
            })
            if (deltas.some((delta) => JSON.stringify(delta.parts).includes('"text-delta"'))) firstVisible = Date.now() - start
          }
          if (firstVisible == null) await new Promise((resolve) => setTimeout(resolve, 20))
        }
        const result = await done
        await result.consumeStream()
        rows.push({ throttleMs, prompt, firstVisibleMs: firstVisible, totalMs: Date.now() - start })
        await agent.deleteThreadAsync(ctx, { threadId })
      }
    }
    return rows
  },
})
