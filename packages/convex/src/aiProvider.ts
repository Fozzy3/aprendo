import { createOpenRouter, type OpenRouterChatSettings } from '@openrouter/ai-sdk-provider'

/**
 * The one place that decides which model the product talks to.
 *
 * `deepseek/deepseek-v4-flash` rather than the `v4-pro` this used to call: same
 * family and generation, so the prompts written against DeepSeek carry over
 * unchanged, at roughly a twentieth of the output price ($0.165/M against
 * $3.20/M). Output is what dominates the bill (lessons, and the HTML of the
 * tutor's demos), so the output column is the one that matters when comparing.
 *
 * Both workloads need more than plain completion: the tutor calls tools, and
 * lessons go through `generateObject` with a Zod schema. A cheaper model without
 * both would not be a substitute at any price.
 *
 * OpenRouter rather than calling the vendor directly: its provider is already a
 * dependency and matches this repo's `ai@6` types, and it quoted the same model
 * slightly cheaper.
 */

/** Swapping this is the whole migration if a better option turns up. */
export const APRENDO_MODEL_ID = 'deepseek/deepseek-v4-flash'

/**
 * Request settings sent with every call. Measured with `llmBench.ts` on DEV
 * (2026-11-11, tutor prompt, 3 runs each), time to first text / total:
 * - default routing (price-weighted, any host): 367–657 ms / ~1.0 s
 * - `sort: 'latency'`: 233–268 ms / 0.46–0.98 s
 * - `sort: 'throughput'`: one 1.7 s / 5.8 s outlier; qwen3.7-flash 0.7–0.95 s;
 *   mistral-small-2603 0.5–0.7 s at 3x the output price. Neither beat this.
 * The model was not thinking (0 reasoning tokens); `effort: 'none'` keeps it
 * that way if a host changes its default, since a thinking pass adds seconds
 * before the first word. fp4 hosts are left out (quality on maths), and the
 * price cap stops latency sorting from landing on a $0.45–0.56/M host.
 */
export const APRENDO_MODEL_SETTINGS: OpenRouterChatSettings = {
  reasoning: { effort: 'none' },
  provider: {
    sort: 'latency',
    quantizations: ['fp8', 'fp16', 'bf16', 'unknown'],
    max_price: { completion: 0.3 },
  },
}

/**
 * Built per call rather than at module load: Convex evaluates modules at deploy
 * time, and reading a missing variable there would fail the whole deployment
 * instead of the one action that needs it.
 */
export function aprendoModel(
  modelId: string = APRENDO_MODEL_ID,
  // The routing caps fit this model only: the audit's vision and guide models cost more.
  settings: OpenRouterChatSettings = modelId === APRENDO_MODEL_ID ? APRENDO_MODEL_SETTINGS : {},
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'Falta OPENROUTER_API_KEY. Configúrala con: bunx convex env set OPENROUTER_API_KEY <clave>',
    )
  }
  return createOpenRouter({ apiKey })(modelId, settings)
}
