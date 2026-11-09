// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  mutations: {} as Record<string, ReturnType<typeof vi.fn>>,
  confirm: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => ({ queryKey: [getFunctionName(ref), args] }),
  useConvexMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref)
    state.mutations[name] ??= vi.fn(async () => ({ keyChange: null }))
    return state.mutations[name]
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: [string] }) => state.queries[options.queryKey[0]] ?? { isPending: true, data: undefined },
  useMutation: ({ mutationFn, onSuccess }: { mutationFn: (variables: unknown) => Promise<unknown>; onSuccess?: (data: unknown) => void }) => {
    const [result, setResult] = useState<{ status: string; error?: unknown }>({ status: 'idle' })
    return {
      ...result,
      isPending: result.status === 'pending',
      mutate: (variables?: unknown) => {
        setResult({ status: 'pending' })
        mutationFn(variables).then(
          (data) => {
            onSuccess?.(data)
            setResult({ status: 'success' })
          },
          (error: unknown) => setResult({ status: 'error', error }),
        )
      },
    }
  },
}))

vi.mock('../components/MarkdownBlock.tsx', () => ({ MarkdownBlock: ({ markdown }: { markdown: string }) => <div>{markdown}</div> }))
vi.mock('../components/ConfirmDialog.tsx', () => ({ confirmDialog: state.confirm }))
vi.mock('../components/Toast.tsx', () => ({ toast: state.toast }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const AUDIT_ID = 'audit-1'
const QUESTION_ID = 'question-1'

const item = (overrides: object = {}) => ({
  audit: {
    _id: AUDIT_ID, status: 'needs_review', subjectId: 'matematicas', source: { kind: 'booklet', page: 3 },
    checks: [
      { id: 'key_present', result: 'pass' },
      { id: 'katex', result: 'warn', detail: 'Hay un signo $ sin cerrar.' },
      { id: 'options_filled', result: 'fail', detail: 'Opciones vacías: B.' },
    ],
    solvers: [{ modelId: 'google/gemini', option: 'A', confidence: 0.9 }, { modelId: 'anthropic/claude', option: 'B', confidence: 0.7 }],
    vision: { stemMatches: true, optionsMatch: false, figureNeeded: false, figureLegible: true, textSufficient: true, modelId: 'v' },
    history: [{ field: 'key', after: 'C', source: 'inventory', at: 1 }],
  },
  question: {
    _id: QUESTION_ID, questionNumber: 7, bodyMarkdown: 'Enunciado de la pregunta',
    options: [{ label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' }, { label: 'C', bodyMarkdown: 'tres' }],
    answerCorrectOption: 'C', primarySubtopicId: 'st1',
  },
  group: null,
  source: 'ICFES · Matemáticas',
  pageImageUrl: 'https://s/page.png',
  cropUrl: 'https://s/crop.png',
  guide: null,
  rank: 0,
  pendingKey: null,
  reviewerRole: 'teacher',
  subtopics: [{ id: 'st1', label: 'Proporciones' }, { id: 'st2', label: 'Funciones' }],
  openReports: [],
  ...overrides,
})

const queueRow = { auditId: AUDIT_ID, questionId: QUESTION_ID, subjectId: 'matematicas', status: 'needs_review', rank: 0, questionNumber: 7, excerpt: 'Enunciado', failed: 1, warned: 1 }

let container: HTMLElement
let root: Root

beforeEach(() => {
  state.mutations = {}
  state.confirm.mockReset()
  state.toast.mockReset()
  state.queries = {
    'audit:getAuditQueue': { isPending: false, data: { items: [queueRow], total: 1, subjects: ['matematicas'] } },
    'audit:getAuditItem': { isPending: false, data: item() },
    'audit:getReviewerCounts': { isPending: false, data: { mine: 12, byReviewer: null } },
  }
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render() {
  const { AuditQueue } = await import('../components/admin/AuditQueue.tsx')
  const select = vi.fn()
  await act(async () => {
    root.render(<AuditQueue questionId={QUESTION_ID} onSelect={select} />)
  })
  return { select }
}

const press = (key: string, target: EventTarget = window) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })

const button = (name: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name)) as HTMLButtonElement

describe('AuditQueue', () => {
  it('shows the page beside the question, the checks, the models and the history', async () => {
    await render()
    expect(container.querySelector('img[src="https://s/page.png"]')).not.toBeNull()
    expect(container.textContent).toContain('Enunciado de la pregunta')
    expect(container.textContent).toContain('Opciones vacías: B.')
    expect(container.textContent).toContain('google/gemini')
    expect(container.textContent).toContain('90 %')
    expect(container.textContent).toContain('Clave C')
    expect(container.textContent).toContain('Inventario')
  })

  it('says when both models contradict the key', async () => {
    await render()
    expect(container.textContent).toContain('Los dos modelos contradicen la clave')
  })

  it('shows what the reviewer has signed', async () => {
    await render()
    expect(container.textContent).toContain('12')
  })

  it('an admin sees the signatures per reviewer, for pay', async () => {
    state.queries['audit:getReviewerCounts'] = { isPending: false, data: { mine: 0, byReviewer: [{ studentId: 's1', name: 'Marta Ruiz', count: 31 }] } }
    await render()
    expect(container.textContent).toContain('Marta Ruiz')
    expect(container.textContent).toContain('31')
  })

  it('A approves the question', async () => {
    await render()
    await press('a')
    expect(state.mutations['audit:approveAudit']).toHaveBeenCalledWith(expect.objectContaining({ auditId: AUDIT_ID }))
  })

  it('a shortcut does nothing while typing', async () => {
    await render()
    const textarea = container.querySelector('textarea, input') ?? document.body.appendChild(document.createElement('input'))
    await press('a', textarea)
    expect(state.mutations['audit:approveAudit']).not.toHaveBeenCalled()
  })

  it('R rejects after asking, and not before', async () => {
    state.confirm.mockResolvedValue(false)
    await render()
    await press('r')
    expect(state.confirm).toHaveBeenCalled()
    expect(state.mutations['audit:rejectAudit']).not.toHaveBeenCalled()

    state.confirm.mockResolvedValue(true)
    await press('r')
    expect(state.mutations['audit:rejectAudit']).toHaveBeenCalledWith(expect.objectContaining({ auditId: AUDIT_ID }))
  })

  it('C opens the correction form and saving sends only what changed', async () => {
    await render()
    await press('c')
    const stem = container.querySelector('textarea') as HTMLTextAreaElement
    expect(stem.value).toBe('Enunciado de la pregunta')
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
      setter.call(stem, 'Enunciado corregido')
      stem.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => button('Guardar corrección').click())
    expect(state.mutations['audit:fixAudit']).toHaveBeenCalledWith({ auditId: AUDIT_ID, stem: 'Enunciado corregido' })
  })

  it('a pending key change names who still has to sign', async () => {
    state.queries['audit:getAuditItem'] = { isPending: false, data: item({ pendingKey: { after: 'A', source: 'key_proposal:teacher' }, reviewerRole: 'admin' }) }
    await render()
    expect(container.textContent).toContain('Cambio de clave a A')
    expect(container.textContent).toContain('administrador')
  })

  const textProposal = (reviewerRole = 'admin') => ({
    isPending: false,
    data: item({ pendingKey: { after: 'texto:siete', source: 'key_proposal:teacher', keyText: 'siete' }, reviewerRole }),
  })

  it('a proposed text for the keyed option is named, and an unrelated fix does not carry it', async () => {
    state.queries['audit:getAuditItem'] = textProposal()
    await render()
    expect(container.textContent).toContain('Cambio del texto de la clave a «siete»')
    await press('c')
    const inputs = [...container.querySelectorAll('input.input')] as HTMLInputElement[]
    expect(inputs.map((input) => input.value)).toContain('tres')
    expect(inputs.map((input) => input.value)).not.toContain('siete')
    const stem = container.querySelector('textarea') as HTMLTextAreaElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(stem, 'Otro')
      stem.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => button('Guardar corrección').click())
    expect(state.mutations['audit:fixAudit']).toHaveBeenCalledWith({ auditId: AUDIT_ID, stem: 'Otro' })
  })

  it('while a proposal is pending, Aprobar and A are blocked', async () => {
    state.queries['audit:getAuditItem'] = textProposal()
    await render()
    expect(button('Aprobar').disabled).toBe(true)
    await press('a')
    expect(state.mutations['audit:approveAudit']).not.toHaveBeenCalled()
  })

  it('Firmar propuesta signs on its own', async () => {
    state.queries['audit:getAuditItem'] = textProposal()
    await render()
    await act(async () => button('Firmar propuesta').click())
    expect(state.mutations['audit:signKeyProposal']).toHaveBeenCalledWith({ auditId: AUDIT_ID })
    expect(state.mutations['audit:dismissKeyProposal']).not.toHaveBeenCalled()
  })

  it('Descartar propuesta asks first, and only then dismisses', async () => {
    state.queries['audit:getAuditItem'] = textProposal()
    state.confirm.mockResolvedValue(false)
    await render()
    await act(async () => button('Descartar propuesta').click())
    expect(state.confirm).toHaveBeenCalled()
    expect(state.mutations['audit:dismissKeyProposal']).not.toHaveBeenCalled()

    state.confirm.mockResolvedValue(true)
    await act(async () => button('Descartar propuesta').click())
    expect(state.mutations['audit:dismissKeyProposal']).toHaveBeenCalledWith({ auditId: AUDIT_ID })
  })

  it('the role that proposed is offered neither action', async () => {
    state.queries['audit:getAuditItem'] = textProposal('teacher')
    await render()
    expect(button('Firmar propuesta')).toBeUndefined()
    expect(button('Descartar propuesta')).toBeUndefined()
  })

  it('a teacher gets told a key change waits for a second signature', async () => {
    state.mutations['audit:fixAudit'] = vi.fn(async () => ({ keyChange: 'proposed' }))
    await render()
    await press('c')
    const key = container.querySelector('select[name="key"]') as HTMLSelectElement
    await act(async () => {
      key.value = 'A'
      key.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => button('Guardar corrección').click())
    expect(state.mutations['audit:fixAudit']).toHaveBeenCalledWith({ auditId: AUDIT_ID, key: 'A' })
    expect(state.toast).toHaveBeenCalledWith(expect.stringContaining('firma'))
  })

  it('reviews the guide', async () => {
    const guide = {
      _id: 'guide-1', status: 'pending', hint: 'Piensa en la suma', reveal: 'La respuesta es tres.',
      byOption: { A: { diagnose: { prompt: '¿Qué te hizo elegir la A?', choices: [{ text: 'Sumé mal' }] }, steps: [{ prompt: '¿Sumaste?', choices: [{ text: 'Sí', correct: true }, { text: 'No' }] }] } },
    }
    state.queries['audit:getAuditItem'] = { isPending: false, data: item({ guide }) }
    await render()
    expect(container.textContent).toContain('Piensa en la suma')
    expect(container.textContent).toContain('¿Sumaste?')
    await act(async () => button('Aprobar guía').click())
    expect(state.mutations['audit:reviewGuide']).toHaveBeenCalledWith({ guideId: 'guide-1', status: 'approved' })
  })

  it('an empty queue says so', async () => {
    state.queries['audit:getAuditQueue'] = { isPending: false, data: { items: [], total: 0, subjects: ['matematicas'] } }
    state.queries['audit:getAuditItem'] = { isPending: false, data: null }
    const { AuditQueue } = await import('../components/admin/AuditQueue.tsx')
    await act(async () => {
      root.render(<AuditQueue onSelect={vi.fn()} />)
    })
    expect(container.textContent).toContain('No hay preguntas por revisar')
  })

  it('a question with no audit yet can be opened by an admin', async () => {
    state.queries['audit:getAuditItem'] = { isPending: false, data: null }
    await render()
    await act(async () => button('Abrir auditoría').click())
    expect(state.mutations['audit:openAudit']).toHaveBeenCalledWith({ questionId: QUESTION_ID })
  })
})
