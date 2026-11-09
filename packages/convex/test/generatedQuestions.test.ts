import { describe, expect, test } from 'bun:test'
import blueprint from '../../../docs/bank-blueprint.v1.json'
import taxonomyContract from '../../../docs/taxonomy.v1.json'
import { internal } from '../src/_generated/api'
import { authorCell, authorPrompt, type AuthoredDraft } from '../src/generatedQuestions'
import { getSubtopicContext } from '../src/taxonomy'
import { setupTest } from './signIn'

const CELL = { subtopicId: 'matematicas.number_proportionality.ratios_proportions_percent', competencia: 'formulacion_ejecucion', difficulty: 'media' as const, targetGrade: 11, count: 2 }
const ICFES = 'En un páramo de Boyacá se estudia una cadena alimentaria simplificada que incluye frailejones y venados'

const step = (prompt: string) => ({ prompt, choices: [{ text: 'Sí', correct: true }, { text: 'No' }] })
const diagnose = (label: string) => ({ prompt: `¿Qué te hizo elegir la ${label}?`, choices: [{ text: 'Sumé mal' }, { text: 'La adiviné' }] })

const draft = (overrides: Partial<AuthoredDraft> = {}): AuthoredDraft => ({
  stem: 'Una tienda vende cuadernos con 10 % de descuento. ¿Cuánto paga una persona por un cuaderno de 5.000 pesos?',
  options: [{ label: 'A', text: '500 pesos' }, { label: 'B', text: '4.500 pesos' }, { label: 'C', text: '5.500 pesos' }, { label: 'D', text: '4.000 pesos' }],
  correctOption: 'B',
  solution: 'El descuento es de 500 pesos.',
  guide: {
    hint: '¿Qué parte del precio se descuenta?',
    paths: ['A', 'C', 'D'].map((label) => ({ label, diagnose: diagnose(label), steps: [step('¿Restaste el descuento del precio?')] })),
    reveal: 'Al precio se le resta el descuento. Así se obtiene lo que se paga.',
  },
  ...overrides,
})

describe('authorCell', () => {
  const deps = (drafts: AuthoredDraft[]) => {
    const calls: string[] = []
    return {
      calls,
      generate: async (prompt: string) => {
        calls.push(`generate:${prompt}`)
        return drafts
      },
      loadIcfesCorpus: async () => {
        calls.push('corpus')
        return [{ id: 'icfes-1', text: ICFES }]
      },
    }
  }

  // The legal line of F66: paraphrasing ICFES items is forbidden, so the
  // generator must not be able to read one.
  test('the generator is handed nothing from the ICFES rows', async () => {
    const d = deps([draft()])
    await authorCell(CELL, d)
    expect(d.calls[0]!.startsWith('generate:')).toBe(true)
    expect(d.calls[0]!).not.toContain('páramo')
    expect(d.calls[1]).toBe('corpus')
    expect(authorPrompt.length).toBe(1)
  })

  test('the ICFES rows are read only after generating, for the similarity gate', async () => {
    const d = deps([draft()])
    await authorCell(CELL, d)
    expect(d.calls.indexOf('corpus')).toBeGreaterThan(d.calls.findIndex((call) => call.startsWith('generate:')))
  })

  test('an item that keeps runs of an ICFES one is rejected', async () => {
    const copied = draft({ stem: `${ICFES} y varios conejos del lugar` })
    const { accepted, rejected } = await authorCell(CELL, deps([copied]))
    expect(accepted).toEqual([])
    expect(rejected[0]?.reason).toContain('icfes-1')
  })

  test('a guide that leaks the key is rejected', async () => {
    const leaky = draft({ guide: { ...draft().guide, hint: '¿Ya miraste la opción B?' } })
    expect((await authorCell(CELL, deps([leaky]))).accepted).toEqual([])
  })

  test('a key outside the options is rejected', async () => {
    expect((await authorCell(CELL, deps([draft({ correctOption: 'F' })]))).accepted).toEqual([])
  })

  test('a clean item is accepted', async () => {
    const { accepted } = await authorCell(CELL, deps([draft()]))
    expect(accepted).toHaveLength(1)
  })
})

describe('authorPrompt', () => {
  test('the prompt carries the cell and forbids copying', () => {
    const prompt = authorPrompt(CELL)
    expect(prompt).toContain('Formulación y ejecución')
    expect(prompt).toMatch(/nunca.+copi|paráfrasis/i)
  })
})

describe('insertAuthoredQuestions', () => {
  test('an authored item waits in pending, tagged original, with its guide and audit row', async () => {
    const t = setupTest()
    const pdfUploadId = await t.run(async (ctx) => ctx.db.insert('pdfUploads', {
      fileName: 'x', slug: 'ai-generated', pdfStorageId: await ctx.storage.store(new Blob(['x'])), contentType: 'application/x-aprendo-ai-generated',
      sizeBytes: 0, status: 'completed', createdAt: 1, updatedAt: 1,
    }))
    await t.mutation(internal.generatedQuestions.insertAuthoredQuestions, {
      pdfUploadId,
      cell: CELL,
      modelId: 'm',
      drafts: [draft()].map(({ guide, ...rest }) => ({
        ...rest,
        guide: { hint: guide.hint, reveal: guide.reveal, byOption: Object.fromEntries(guide.paths.map(({ label, ...path }) => [label, path])) },
      })),
    })
    const [question] = await t.run((ctx) => ctx.db.query('questions').collect())
    expect(question).toMatchObject({ eligibility: 'pending', bankTier: 'original', targetGrade: 11, answerCorrectOption: 'B' })
    const [guide] = await t.run((ctx) => ctx.db.query('questionGuides').collect())
    expect(guide?.status).toBe('pending')
    const [audit] = await t.run((ctx) => ctx.db.query('questionAudits').collect())
    expect(audit?.source.kind).toBe('authored')
    expect(audit?.status).toBe('pending_checks')
  })

  test('the ICFES corpus for the gate holds no original rows', async () => {
    const t = setupTest()
    await t.run(async (ctx) => {
      const pdfUploadId = await ctx.db.insert('pdfUploads', {
        fileName: 'x', slug: 'x', pdfStorageId: await ctx.storage.store(new Blob(['x'])), contentType: 'application/pdf', sizeBytes: 0, status: 'completed', createdAt: 1, updatedAt: 1,
      })
      const base = { pdfUploadId, questionNumber: 1, sequence: 1, options: [], createdAt: 1, subjectId: 'matematicas' }
      await ctx.db.insert('questions', { ...base, bodyMarkdown: 'icfes stem' })
      await ctx.db.insert('questions', { ...base, bodyMarkdown: 'nuestro', bankTier: 'original' })
    })
    const corpus = await t.query(internal.generatedQuestions.icfesCorpus, { subjectId: 'matematicas' })
    expect(corpus.map((row) => row.text)).toEqual(['icfes stem'])
  })
})

describe('bank-blueprint.v1.json', () => {
  test('adds up to 2000 items, weighted by the official quotas', () => {
    const bySubject = new Map<string, number>()
    for (const cell of blueprint.cells) bySubject.set(cell.subjectId, (bySubject.get(cell.subjectId) ?? 0) + cell.count)
    expect([...bySubject.values()].reduce((sum, count) => sum + count, 0)).toBe(2000)
    expect(bySubject.get('ingles')).toBe(433)
    expect(bySubject.get('lectura_critica')).toBe(323)
    expect(bySubject.get('matematicas')).toBe(394)
    expect(bySubject.get('ciencias_naturales')).toBe(456)
    expect(bySubject.get('sociales_ciudadanas')).toBe(394)
  })

  test('every cell is a real subtopic and competencia of its area', () => {
    const competencias = taxonomyContract.secondary_dimensions.competencia_oficial.values as Record<string, string[]>
    for (const cell of blueprint.cells) {
      const context = getSubtopicContext(cell.subtopicId)
      expect(context?.subjectId).toBe(cell.subjectId)
      expect(context?.categoryId).toBe(cell.categoryId)
      expect(competencias[cell.subjectId]).toContain(cell.competencia)
      expect(['baja', 'media', 'alta']).toContain(cell.difficulty)
    }
  })

  test('English goes first', () => {
    expect(blueprint.authoringOrder[0]).toBe('ingles')
  })
})
