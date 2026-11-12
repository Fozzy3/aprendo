import { describe, expect, test } from 'bun:test'

process.env.OPENROUTER_API_KEY ??= 'test'
const { APRENDO_MODEL_ID, APRENDO_MODEL_SETTINGS, aprendoModel } = await import('../src/aiProvider')

describe('aprendoModel', () => {
  test('the default model goes out without thinking, on the fastest host under the price cap', () => {
    expect(aprendoModel().settings).toEqual(APRENDO_MODEL_SETTINGS)
    expect(APRENDO_MODEL_SETTINGS.reasoning).toEqual({ effort: 'none' })
    expect(APRENDO_MODEL_SETTINGS.provider?.sort).toBe('latency')
    expect(APRENDO_MODEL_SETTINGS.provider?.quantizations).not.toContain('fp4')
  })

  test('another model keeps its own routing: the caps would leave a pricier one without hosts', () => {
    expect(aprendoModel('anthropic/claude-sonnet-5').settings).toEqual({})
    expect(aprendoModel(APRENDO_MODEL_ID).settings).toEqual(APRENDO_MODEL_SETTINGS)
  })
})
