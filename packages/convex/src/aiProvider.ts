import { createOpenRouter } from '@openrouter/ai-sdk-provider'

/**
 * The one place that decides which model the product talks to.
 *
 * `deepseek/deepseek-v4-flash` rather than the `v4-pro` this used to call: same
 * family and generation, so the prompts written against DeepSeek carry over
 * unchanged, at roughly a twentieth of the output price ($0.165/M against
 * $3.20/M). Output is what dominates the bill — the tutor writes long
 * explanations — so the output column is the one that matters when comparing.
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
 * Built per call rather than at module load: Convex evaluates modules at deploy
 * time, and reading a missing variable there would fail the whole deployment
 * instead of the one action that needs it.
 */
export function aprendoModel(modelId: string = APRENDO_MODEL_ID) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error(
      'Falta OPENROUTER_API_KEY. Configúrala con: bunx convex env set OPENROUTER_API_KEY <clave>',
    )
  }
  return createOpenRouter({ apiKey })(modelId)
}
