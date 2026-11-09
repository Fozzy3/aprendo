import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { api, internal } from '../src/_generated/api'
import type { Doc, Id } from '../src/_generated/dataModel'
import {
  AUDIT_SOLVER_MODELS,
  BOOKLET_CONTENT_TYPE,
  auditItem,
  blindView,
  needsRetag,
  solverPrompt,
  type AuditDeps,
  type AuditItem,
} from '../src/audit'
import { setupTest, signUp } from './signIn'

const now = 1_700_000_000_000
const SUBTOPIC = 'matematicas.number_proportionality.ratios_proportions_percent'
const CATEGORY = 'matematicas.number_proportionality'

type Test = ReturnType<typeof setupTest>

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

async function question(t: Test, overrides: Partial<Doc<'questions'>> = {}, contentType = BOOKLET_CONTENT_TYPE) {
  return t.run(async (ctx) => {
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: `a-${Math.random()}`, pdfStorageId: await ctx.storage.store(new Blob(['pdf'])), contentType,
      sizeBytes: 3, status: 'completed', createdAt: now, updatedAt: now,
    })
    return ctx.db.insert('questions', {
      pdfUploadId, sequence: 1, questionNumber: 1, bodyMarkdown: '¿Cuánto es dos más uno?',
      options: [
        { label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' },
        { label: 'C', bodyMarkdown: 'tres' }, { label: 'D', bodyMarkdown: 'cuatro' },
      ],
      createdAt: now, subjectId: 'matematicas', categoryId: CATEGORY, primarySubtopicId: SUBTOPIC,
      answerCorrectOption: 'C', answerStatus: 'completed', answerSolutionMarkdown: 'Porque sí.', eligibility: 'diagnostic', ...overrides,
    })
  })
}

async function audited(t: Test, questionId: Id<'questions'>, overrides: Partial<Doc<'questionAudits'>> = {}) {
  return t.run(async (ctx) => ctx.db.insert('questionAudits', {
    questionId, subjectId: 'matematicas', status: 'needs_review', pipelineVersion: 'audit-v1', source: { kind: 'booklet' },
    checks: [], solvers: [], history: [], updatedAt: now, ...overrides,
  }))
}

const reviewer = (t: Test, email = 'profe@x.co') => signUp(t, email).then(async (account) => {
  await t.run((ctx) => ctx.db.patch('students', account.studentId, { reviewerSubjects: ['matematicas'] }))
  return account
})

const getQuestion = (t: Test, id: Id<'questions'>) => t.run((ctx) => ctx.db.get('questions', id))
const getAudit = (t: Test, id: Id<'questionAudits'>) => t.run((ctx) => ctx.db.get('questionAudits', id))
const scheduled = (t: Test) => t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())

async function attempt(t: Test, questionId: Id<'questions'>, selectedOption: string, isCorrect: boolean) {
  return t.run(async (ctx) => {
    const studentId = await ctx.db.insert('students', {
      email: `${selectedOption}@x.co`, normalizedEmail: `${selectedOption}@x.co`, createdAt: now, updatedAt: now, lastSeenAt: now,
    })
    const sessionId = await ctx.db.insert('sessions', {
      studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual', startedAt: now, completedAt: now + 60_000,
      questionCount: 1, currentPosition: 1,
      summary: { correctCount: isCorrect ? 1 : 0, answeredCount: 1, questionCount: 1, accuracy: isCorrect ? 1 : 0, durationMs: 60_000, subjectScores: [] },
    })
    const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId, questionId, position: 0, selectionReason: 'topic_focus' })
    const attemptId = await ctx.db.insert('questionAttempts', {
      studentId, sessionId, questionId, sessionQuestionId, attemptType: 'topic', selectedOption, isCorrect, answeredAt: now,
      usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
    })
    return { studentId, sessionId, attemptId }
  })
}

describe('inventory', () => {
  test('a row per question, with the current key as the first history entry', async () => {
    const t = setupTest()
    const questionId = await question(t)
    await t.mutation(internal.audit.startInventory, {})
    const [row] = await t.run((ctx) => ctx.db.query('questionAudits').withIndex('by_questionId', (q) => q.eq('questionId', questionId)).collect())
    expect(row?.status).toBe('pending_checks')
    expect(row?.source.kind).toBe('booklet')
    expect(row?.history[0]).toMatchObject({ field: 'key', after: 'C', source: 'inventory' })
  })

  test('running it twice adds nothing', async () => {
    const t = setupTest()
    await question(t)
    await t.mutation(internal.audit.startInventory, {})
    await t.mutation(internal.audit.startInventory, {})
    expect(await t.run((ctx) => ctx.db.query('questionAudits').collect())).toHaveLength(1)
  })

  test('the source comes from the upload', async () => {
    const t = setupTest()
    const ocr = await question(t, {}, 'application/pdf')
    await t.mutation(internal.audit.startInventory, {})
    const row = await t.run((ctx) => ctx.db.query('questionAudits').withIndex('by_questionId', (q) => q.eq('questionId', ocr)).unique())
    expect(row?.source.kind).toBe('ocr')
  })
})

describe('requireReviewer', () => {
  test('an account with that subject, or an admin, may open the item', async () => {
    const t = setupTest()
    const questionId = await question(t)
    await audited(t, questionId)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    expect((await teacher.as.query(api.audit.getAuditItem, { questionId }))?.question._id).toBe(questionId)
    expect((await admin.as.query(api.audit.getAuditItem, { questionId }))?.question._id).toBe(questionId)
  })

  test('another area, or nobody special, may not', async () => {
    const t = setupTest()
    const questionId = await question(t)
    await audited(t, questionId)
    const student = await signUp(t, 'ana@x.co')
    await expect(student.as.query(api.audit.getAuditItem, { questionId })).rejects.toThrow()
    const other = await signUp(t, 'ingles@x.co')
    await t.run((ctx) => ctx.db.patch('students', other.studentId, { reviewerSubjects: ['ingles'] }))
    await expect(other.as.query(api.audit.getAuditItem, { questionId })).rejects.toThrow()
  })
})

describe('recordAuditResult', () => {
  const pass = [{ id: 'key_present', result: 'pass' as const }]
  const vision = { stemMatches: true, optionsMatch: true, figureNeeded: false, figureLegible: true, textSufficient: true, modelId: 'v' }
  const solvers = (a: string, b: string) => [{ modelId: 'a', option: a, confidence: 0.9 }, { modelId: 'b', option: b, confidence: 0.9 }]

  test('a hard failure leaves the pool at once', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'pending_checks' })
    await t.mutation(internal.audit.recordAuditResult, { auditId, checks: [{ id: 'options_filled', result: 'fail' }], solvers: [] })
    expect((await getQuestion(t, questionId))?.eligibility).toBe('excluded')
    expect((await getAudit(t, auditId))?.status).toBe('needs_review')
  })

  test('models can never change a printed key', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'pending_checks' })
    await t.mutation(internal.audit.recordAuditResult, { auditId, checks: pass, vision, solvers: solvers('A', 'A') })
    const row = await getQuestion(t, questionId)
    expect(row?.answerCorrectOption).toBe('C')
    expect(row?.eligibility).toBe('diagnostic')
    expect((await getAudit(t, auditId))?.status).toBe('needs_review')
  })

  test('re-tagging writes the taxonomy and nothing else', async () => {
    const t = setupTest()
    const questionId = await question(t, { taxonomyModelId: 'keyword-rules', taxonomyStatus: 'needs_review' })
    const auditId = await audited(t, questionId, { status: 'pending_checks' })
    const before = (await getQuestion(t, questionId))!
    const target = 'matematicas.functions_variation.functions_graphs'
    await t.mutation(internal.audit.recordAuditResult, {
      auditId, checks: pass, vision, solvers: solvers('C', 'C'),
      retag: {
        status: 'completed', taxonomyVersion: 'v1', taxonomyRelease: 'r1', subjectId: 'matematicas',
        categoryId: 'matematicas.functions_variation', primarySubtopicId: target,
        secondarySubtopicIds: [], secondaryDimensions: [], confidence: 0.9, modelId: 'g', promptVersion: 'p',
      },
    })
    const after = (await getQuestion(t, questionId))!
    expect(after.primarySubtopicId).toBe(target)
    expect(after.taxonomyStatus).toBe('completed')
    expect(after.answerCorrectOption).toBe(before.answerCorrectOption)
    expect(after.bodyMarkdown).toBe(before.bodyMarkdown)
    expect(after.eligibility).toBe(before.eligibility)
    expect((await getAudit(t, auditId))?.history.at(-1)).toMatchObject({ field: 'taxonomy', after: target })
  })

  test('a re-tag into another area is ignored: the booklet settles the area', async () => {
    const t = setupTest()
    const questionId = await question(t, { taxonomyModelId: 'keyword-rules' })
    const auditId = await audited(t, questionId, { status: 'pending_checks' })
    await t.mutation(internal.audit.recordAuditResult, {
      auditId, checks: pass, vision, solvers: solvers('C', 'C'),
      retag: {
        status: 'completed', taxonomyVersion: 'v1', taxonomyRelease: 'r1', subjectId: 'ingles', categoryId: 'x', primarySubtopicId: 'y',
        secondarySubtopicIds: [], secondaryDimensions: [], confidence: 0.9, modelId: 'g', promptVersion: 'p',
      },
    })
    expect((await getQuestion(t, questionId))?.subjectId).toBe('matematicas')
  })

  const repairs = async (t: Test) => (await scheduled(t)).filter((job) => job.name.includes('repairAttempts'))

  test('a pipeline rejection of an authored item voids it and repairs what it graded', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'pending_checks', source: { kind: 'authored' } })
    await t.mutation(internal.audit.recordAuditResult, { auditId, checks: pass, solvers: solvers('A', 'A') })
    const row = await getQuestion(t, questionId)
    expect(row?.eligibility).toBe('excluded')
    expect(row?.voidedAt).toBeDefined()
    expect((await getAudit(t, auditId))?.status).toBe('rejected')
    expect((await getAudit(t, auditId))?.repair).toMatchObject({ status: 'running', regrade: false })
    expect(await repairs(t)).toHaveLength(1)
  })

  test('a hard failure that only waits for a person voids nothing', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'pending_checks' })
    await t.mutation(internal.audit.recordAuditResult, { auditId, checks: [{ id: 'options_filled', result: 'fail' }], solvers: [] })
    expect((await getQuestion(t, questionId))?.voidedAt).toBeUndefined()
    expect(await repairs(t)).toHaveLength(0)
  })

  test('a re-tag that moves the subtopic rebuilds what it graded; the same tag does not', async () => {
    const retag = (primarySubtopicId: string, categoryId: string) => ({
      status: 'completed' as const, taxonomyVersion: 'v1', taxonomyRelease: 'r1', subjectId: 'matematicas', categoryId, primarySubtopicId,
      secondarySubtopicIds: [], secondaryDimensions: [], confidence: 0.9, modelId: 'g', promptVersion: 'p',
    })
    const t = setupTest()
    const questionId = await question(t, { taxonomyModelId: 'keyword-rules' })
    const auditId = await audited(t, questionId, { status: 'pending_checks' })
    await t.mutation(internal.audit.recordAuditResult, { auditId, checks: pass, vision, solvers: solvers('C', 'C'), retag: retag(SUBTOPIC, CATEGORY) })
    expect(await repairs(t)).toHaveLength(0)
    await t.mutation(internal.audit.recordAuditResult, {
      auditId, checks: pass, vision, solvers: solvers('C', 'C'),
      retag: retag('matematicas.functions_variation.functions_graphs', 'matematicas.functions_variation'),
    })
    expect(await repairs(t)).toHaveLength(1)
  })
})

describe('un-voiding a question', () => {
  test('publishing a voided question rebuilds what it graded', async () => {
    const t = setupTest()
    const questionId = await question(t, { voidedAt: now, eligibility: 'excluded' })
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.approveAudit, { auditId })
    expect((await getQuestion(t, questionId))?.voidedAt).toBeUndefined()
    expect((await scheduled(t)).some((job) => job.name.includes('repairAttempts'))).toBe(true)
  })

  test('a key change in the same signature keeps its regrade', async () => {
    const t = setupTest()
    const questionId = await question(t, { voidedAt: now, eligibility: 'excluded' })
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await admin.as.mutation(api.audit.signKeyProposal, { auditId })
    expect((await getAudit(t, auditId))?.repair).toMatchObject({ status: 'running', regrade: true })
  })
})

describe('the pipeline, with the models injected', () => {
  const item = (overrides: Partial<AuditItem> = {}): AuditItem => ({
    auditId: 'a' as Id<'questionAudits'>,
    sourceKind: 'booklet',
    question: {
      bodyMarkdown: '¿Cuánto es dos más uno?',
      options: [{ label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' }, { label: 'C', bodyMarkdown: 'tres' }, { label: 'D', bodyMarkdown: 'cuatro' }],
      answerCorrectOption: 'C', answerSolutionMarkdown: 'La C porque sí', subjectId: 'matematicas', categoryId: CATEGORY, primarySubtopicId: SUBTOPIC,
      taxonomyModelId: 'keyword-rules',
    },
    group: null,
    cropUrl: 'https://s/crop', groupCropUrl: null, pageImageUrl: 'https://s/page',
    crop: { size: 40_000, contentType: 'image/png' },
    ...overrides,
  })

  const deps = (overrides: Partial<AuditDeps> = {}): AuditDeps & { calls: Record<string, unknown[]> } => {
    const calls: Record<string, unknown[]> = { vision: [], solve: [], retag: [] }
    return {
      calls,
      compareVision: async (input) => {
        calls.vision!.push(input)
        return { stemMatches: true, optionsMatch: true, figureNeeded: false, figureLegible: true, textSufficient: true, modelId: 'vision-model' }
      },
      solvers: AUDIT_SOLVER_MODELS.map((modelId) => async (view) => {
        calls.solve!.push({ modelId, view })
        return { modelId, option: 'C', confidence: 0.9 }
      }),
      retag: async (view) => {
        calls.retag!.push(view)
        return { taxonomy: true } as never
      },
      urlResolves: async () => true,
      ...overrides,
    }
  }

  test('the two solvers are different vendors', () => {
    const vendors = AUDIT_SOLVER_MODELS.map((modelId) => modelId.split('/')[0])
    expect(new Set(vendors).size).toBe(2)
  })

  test('the solvers are blind: nothing they receive carries the key or the solution', async () => {
    const d = deps()
    await auditItem(item(), d)
    for (const call of d.calls.solve as Array<{ view: object }>) {
      const seen = JSON.stringify(call.view)
      expect(seen).not.toContain('answerCorrectOption')
      expect(seen).not.toContain('La C porque sí')
    }
    expect(solverPrompt(blindView(item())).includes('La C porque sí')).toBe(false)
  })

  test('the solvers see the images, the crop and the group stimulus', async () => {
    const d = deps()
    await auditItem(item({ groupCropUrl: 'https://s/group', group: { contextMarkdown: 'Texto compartido', contextImages: ['https://s/img'] } }), d)
    const { view } = (d.calls.solve as Array<{ view: { images: string[]; contextMarkdown?: string } }>)[0]!
    expect(view.images).toEqual(expect.arrayContaining(['https://s/crop', 'https://s/group', 'https://s/img']))
    expect(view.contextMarkdown).toBe('Texto compartido')
  })

  test('vision compares the page and the crop; an authored item skips it', async () => {
    const d = deps()
    const result = await auditItem(item(), d)
    expect(d.calls.vision).toHaveLength(1)
    expect(result.vision?.modelId).toBe('vision-model')

    const authored = deps()
    const noVision = await auditItem(item({ sourceKind: 'authored' }), authored)
    expect(authored.calls.vision).toHaveLength(0)
    expect(noVision.vision).toBeUndefined()
  })

  test('no model is paid for a question that already failed hard', async () => {
    const d = deps()
    const result = await auditItem(item({ question: { ...item().question, answerCorrectOption: undefined } }), d)
    expect(result.solvers).toEqual([])
    expect(d.calls.solve).toHaveLength(0)
    expect(d.calls.vision).toHaveLength(0)
    expect(result.checks.find((check) => check.id === 'key_present')?.result).toBe('fail')
  })

  test('only keyword or unfinished tags are re-tagged', async () => {
    expect(needsRetag({ taxonomyModelId: 'keyword-rules', taxonomyStatus: 'completed' })).toBe(true)
    expect(needsRetag({ taxonomyModelId: 'gemini', taxonomyStatus: 'needs_review' })).toBe(true)
    expect(needsRetag({ taxonomyModelId: 'gemini', taxonomyStatus: 'completed' })).toBe(false)
  })

  test('a url that does not answer becomes a failing check', async () => {
    const d = deps({ urlResolves: async () => false })
    const result = await auditItem(item({ question: { ...item().question, bodyMarkdown: 'Mira ![](https://x.co/a) ¿qué ves?' } }), d)
    expect(result.checks.find((check) => check.id === 'urls_resolve')?.result).toBe('fail')
  })

  test('an OCR item is matched to its page', async () => {
    const d = deps({ loadOcrPages: async () => [{ pageNumber: 4, markdown: '¿Cuánto es dos más uno? A uno B dos' }] })
    const result = await auditItem(item({ sourceKind: 'ocr', crop: null, cropUrl: null, pageImageUrl: null }), d)
    expect(result.page).toBe(4)
  })
})

describe('reviewing', () => {
  test('approving publishes a pending question and counts for the reviewer', async () => {
    const t = setupTest()
    const questionId = await question(t, { eligibility: 'pending' })
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.approveAudit, { auditId })
    expect((await getQuestion(t, questionId))?.eligibility).toBe('diagnostic')
    const row = await getAudit(t, auditId)
    expect(row).toMatchObject({ status: 'approved', reviewedBy: teacher.studentId })
    const counts = await teacher.as.query(api.audit.getReviewerCounts, {})
    expect(counts.mine).toBe(1)
  })

  test('a typo is fixed without touching any attempt', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const { attemptId } = await attempt(t, questionId, 'A', false)
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.fixAudit, { auditId, stem: '¿Cuánto es dos más dos?' })
    expect((await getQuestion(t, questionId))?.bodyMarkdown).toBe('¿Cuánto es dos más dos?')
    expect((await t.run((ctx) => ctx.db.get('questionAttempts', attemptId)))?.isCorrect).toBe(false)
    expect((await getAudit(t, auditId))?.history.at(-1)).toMatchObject({ field: 'stem', by: teacher.studentId })
  })

  test('a teacher alone only proposes a key change', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const outcome = await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    expect(outcome.keyChange).toBe('proposed')
    expect((await getQuestion(t, questionId))?.answerCorrectOption).toBe('C')
    expect((await getAudit(t, auditId))?.status).toBe('needs_review')
  })

  test('the admin signing the same key applies it, and repairs the attempts', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const was = await attempt(t, questionId, 'C', true)
    const now_ = await attempt(t, questionId, 'A', false)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    const outcome = await admin.as.mutation(api.audit.signKeyProposal, { auditId })
    expect(outcome.keyChange).toBe('applied')

    const row = await getQuestion(t, questionId)
    expect(row?.answerCorrectOption).toBe('A')
    expect(row?.answerSolutionMarkdown).toBeUndefined()

    await t.mutation(internal.audit.repairAttempts, { questionId })
    await t.mutation(internal.audit.recomputeSessionSummary, { sessionId: now_.sessionId })
    const attemptWas = await t.run((ctx) => ctx.db.get('questionAttempts', was.attemptId))
    const attemptNow = await t.run((ctx) => ctx.db.get('questionAttempts', now_.attemptId))
    expect(attemptWas).toMatchObject({ selectedOption: 'C', isCorrect: false })
    expect(attemptNow).toMatchObject({ selectedOption: 'A', isCorrect: true })

    const summary = (await t.run((ctx) => ctx.db.get('sessions', now_.sessionId)))?.summary
    expect(summary).toMatchObject({ correctCount: 1, accuracy: 1, durationMs: 60_000 })

    const rebuilds = (await scheduled(t)).filter((job) => job.name.includes('rebuildStudentProgress'))
    expect(rebuilds.map((job) => job.args[0].studentId).sort()).toEqual([was.studentId, now_.studentId].sort())
  })

  test('a repair recomputes one session per job, and leaves its state on the audit row', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const first = await attempt(t, questionId, 'C', true)
    const second = await attempt(t, questionId, 'A', false)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await admin.as.mutation(api.audit.signKeyProposal, { auditId })
    expect((await getAudit(t, auditId))?.repair).toMatchObject({ status: 'running', regrade: true, repaired: 0 })

    await t.mutation(internal.audit.repairAttempts, { questionId })
    const untouched = (await t.run((ctx) => ctx.db.get('sessions', second.sessionId)))?.summary
    expect(untouched).toMatchObject({ correctCount: 0 })
    const jobs = (await scheduled(t)).filter((job) => job.name.includes('recomputeSessionSummary'))
    expect(jobs.map((job) => job.args[0].sessionId).sort()).toEqual([first.sessionId, second.sessionId].sort())
    expect((await getAudit(t, auditId))?.repair).toMatchObject({ status: 'done', regrade: true, repaired: 2 })
  })

  test('each page reads the key that is current then', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const { attemptId } = await attempt(t, questionId, 'D', false)
    await t.run((ctx) => ctx.db.patch('questionAudits', auditId, { repair: { status: 'running', regrade: true, repaired: 0, updatedAt: now } }))
    await t.run((ctx) => ctx.db.patch('questions', questionId, { answerCorrectOption: 'D' }))
    await t.mutation(internal.audit.repairAttempts, { questionId })
    expect((await t.run((ctx) => ctx.db.get('questionAttempts', attemptId)))?.isCorrect).toBe(true)
  })

  test('a repair stopped between pages resumes from the row', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    for (let index = 0; index < 51; index += 1) await attempt(t, questionId, 'A', false)
    await t.run((ctx) => ctx.db.patch('questionAudits', auditId, { repair: { status: 'running', regrade: false, repaired: 0, updatedAt: now } }))

    await t.mutation(internal.audit.repairAttempts, { questionId })
    const midway = (await getAudit(t, auditId))?.repair
    expect(midway).toMatchObject({ status: 'running', repaired: 50 })
    expect(midway?.cursor).toBeDefined()

    await t.mutation(internal.audit.repairAttempts, { questionId })
    expect((await getAudit(t, auditId))?.repair).toMatchObject({ status: 'done', repaired: 51 })
  })

  test('a repair that is already over does not run again', async () => {
    const t = setupTest()
    const questionId = await question(t)
    await audited(t, questionId, { repair: { status: 'done', regrade: true, repaired: 3, updatedAt: now } })
    await attempt(t, questionId, 'A', false)
    expect(await t.mutation(internal.audit.repairAttempts, { questionId })).toEqual({ repaired: 0 })
  })

  test('one reviewer cannot change what the key means through its text', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const options = [
      { label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' },
      { label: 'C', bodyMarkdown: 'siete' }, { label: 'D', bodyMarkdown: 'cuatro' },
    ]
    const outcome = await teacher.as.mutation(api.audit.fixAudit, { auditId, options })
    expect(outcome.keyChange).toBe('proposed')
    expect((await getQuestion(t, questionId))?.options[2]?.bodyMarkdown).toBe('tres')
    expect((await getAudit(t, auditId))?.status).toBe('needs_review')
    await expect(teacher.as.mutation(api.audit.fixAudit, { auditId, options })).rejects.toThrow()
  })

  test('the second signature on the same text applies it, and the attempts stay', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const { attemptId } = await attempt(t, questionId, 'C', true)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    const options = [
      { label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' },
      { label: 'C', bodyMarkdown: 'siete' }, { label: 'D', bodyMarkdown: 'cuatro' },
    ]
    await teacher.as.mutation(api.audit.fixAudit, { auditId, options })
    const outcome = await admin.as.mutation(api.audit.signKeyProposal, { auditId })
    expect(outcome.keyChange).toBe('applied')
    expect((await getQuestion(t, questionId))?.options[2]?.bodyMarkdown).toBe('siete')
    expect((await getQuestion(t, questionId))?.answerCorrectOption).toBe('C')
    expect((await t.run((ctx) => ctx.db.get('questionAttempts', attemptId)))?.isCorrect).toBe(true)
    expect((await scheduled(t)).some((job) => job.name.includes('repairAttempts'))).toBe(false)
    expect((await getAudit(t, auditId))?.status).toBe('fixed')
  })

  test('a typo in a wrong option needs one signature, and the text waits only for the key', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const typo = [
      { label: 'A', bodyMarkdown: 'Uno' }, { label: 'B', bodyMarkdown: 'dos' },
      { label: 'C', bodyMarkdown: 'tres' }, { label: 'D', bodyMarkdown: 'cuatro' },
    ]
    expect((await teacher.as.mutation(api.audit.fixAudit, { auditId, options: typo })).keyChange).toBeNull()
    expect((await getQuestion(t, questionId))?.options[0]?.bodyMarkdown).toBe('Uno')
  })

  test('the key and the text of its option are not changed in one signature', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await expect(teacher.as.mutation(api.audit.fixAudit, {
      auditId, key: 'A',
      options: [{ label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' }, { label: 'C', bodyMarkdown: 'siete' }, { label: 'D', bodyMarkdown: 'cuatro' }],
    })).rejects.toThrow(/por separado/)
  })

  test('the new key and the text of its option are not changed in one signature either', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await expect(teacher.as.mutation(api.audit.fixAudit, {
      auditId, key: 'A',
      options: [{ label: 'A', bodyMarkdown: 'siete' }, { label: 'B', bodyMarkdown: 'dos' }, { label: 'C', bodyMarkdown: 'tres' }, { label: 'D', bodyMarkdown: 'cuatro' }],
    })).rejects.toThrow(/por separado/)
    expect((await getQuestion(t, questionId))?.options[0]?.bodyMarkdown).toBe('uno')
  })

  test('a changed stem or option resets the guide written on the old text', async () => {
    const t = setupTest()
    const guideFor = async (questionId: Id<'questions'>) => t.run((ctx) => ctx.db.insert('questionGuides', {
      questionId, hint: 'h', byOption: {}, reveal: 'r', modelId: 'm', promptVersion: 'p', status: 'approved', createdAt: now,
    }))
    const teacher = await reviewer(t)

    const stemQuestion = await question(t)
    const stemAudit = await audited(t, stemQuestion)
    const stemGuide = await guideFor(stemQuestion)
    await teacher.as.mutation(api.audit.fixAudit, { auditId: stemAudit, stem: 'Otro enunciado' })
    expect((await t.run((ctx) => ctx.db.get('questionGuides', stemGuide)))?.status).toBe('rejected')

    const optionQuestion = await question(t)
    const optionAudit = await audited(t, optionQuestion)
    const optionGuide = await guideFor(optionQuestion)
    await teacher.as.mutation(api.audit.fixAudit, {
      auditId: optionAudit,
      options: [{ label: 'A', bodyMarkdown: 'Uno' }, { label: 'B', bodyMarkdown: 'dos' }, { label: 'C', bodyMarkdown: 'tres' }, { label: 'D', bodyMarkdown: 'cuatro' }],
    })
    expect((await t.run((ctx) => ctx.db.get('questionGuides', optionGuide)))?.status).toBe('rejected')
  })

  test('a note or a tag leaves the guide alone', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const guideId = await t.run((ctx) => ctx.db.insert('questionGuides', {
      questionId, hint: 'h', byOption: {}, reveal: 'r', modelId: 'm', promptVersion: 'p', status: 'approved', createdAt: now,
    }))
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.fixAudit, { auditId, note: 'Revisada' })
    expect((await t.run((ctx) => ctx.db.get('questionGuides', guideId)))?.status).toBe('approved')
  })

  test('the reviewer who proposed a key change cannot wave it away by approving', async () => {
    const t = setupTest()
    const questionId = await question(t, { eligibility: 'pending' })
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await expect(teacher.as.mutation(api.audit.approveAudit, { auditId })).rejects.toThrow(/disputa/)
    expect((await getQuestion(t, questionId))?.eligibility).toBe('pending')
  })

  test('neither can a second person of the same role', async () => {
    const t = setupTest()
    const questionId = await question(t, { eligibility: 'pending' })
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const colleague = await reviewer(t, 'otra@x.co')
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await expect(colleague.as.mutation(api.audit.approveAudit, { auditId })).rejects.toThrow(/disputa/)
  })

  test('not even the other role approves over a proposal: it signs or dismisses it first', async () => {
    const t = setupTest()
    const questionId = await question(t, { eligibility: 'pending' })
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await expect(admin.as.mutation(api.audit.approveAudit, { auditId })).rejects.toThrow(/disputa/)
    expect(await getAudit(t, auditId)).toMatchObject({ status: 'needs_review' })
    expect((await getQuestion(t, questionId))?.eligibility).toBe('pending')
  })

  test('dismissing a proposal only closes it: the key stays and the question still waits for its approval', async () => {
    const t = setupTest()
    const questionId = await question(t, { eligibility: 'pending' })
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await admin.as.mutation(api.audit.dismissKeyProposal, { auditId })
    const row = await getAudit(t, auditId)
    expect(row).toMatchObject({ status: 'needs_review' })
    expect(row?.history.at(-1)).toMatchObject({ source: 'key_proposal_dismissed', by: admin.studentId })
    expect((await getQuestion(t, questionId))?.answerCorrectOption).toBe('C')
    expect((await getQuestion(t, questionId))?.eligibility).toBe('pending')
    await admin.as.mutation(api.audit.approveAudit, { auditId })
    expect(await getAudit(t, auditId)).toMatchObject({ status: 'approved' })
  })

  test('dismissing takes the other role, like signing', async () => {
    const t = setupTest()
    const auditId = await audited(t, await question(t))
    const teacher = await reviewer(t)
    const colleague = await reviewer(t, 'otra@x.co')
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await expect(teacher.as.mutation(api.audit.dismissKeyProposal, { auditId })).rejects.toThrow(/disputa/)
    await expect(colleague.as.mutation(api.audit.dismissKeyProposal, { auditId })).rejects.toThrow(/disputa/)
    await expect(colleague.as.mutation(api.audit.signKeyProposal, { auditId })).rejects.toThrow(/firma/)
  })

  test('there is nothing to sign or dismiss without a proposal', async () => {
    const t = setupTest()
    const auditId = await audited(t, await question(t))
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await expect(admin.as.mutation(api.audit.signKeyProposal, { auditId })).rejects.toThrow(/propuesta/)
    await expect(admin.as.mutation(api.audit.dismissKeyProposal, { auditId })).rejects.toThrow(/propuesta/)
  })

  test('a correction never signs a proposal, by key or by text', async () => {
    const t = setupTest()
    const keyAudit = await audited(t, await question(t))
    const textQuestion = await question(t)
    const textAudit = await audited(t, textQuestion)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    const options = [{ label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' }, { label: 'C', bodyMarkdown: 'siete' }, { label: 'D', bodyMarkdown: 'cuatro' }]
    await teacher.as.mutation(api.audit.fixAudit, { auditId: keyAudit, key: 'A' })
    await teacher.as.mutation(api.audit.fixAudit, { auditId: textAudit, options })
    await expect(admin.as.mutation(api.audit.fixAudit, { auditId: keyAudit, key: 'A' })).rejects.toThrow(/Firmar propuesta/)
    await expect(admin.as.mutation(api.audit.fixAudit, { auditId: textAudit, options })).rejects.toThrow(/Firmar propuesta/)
    expect((await getQuestion(t, textQuestion))?.options[2]?.bodyMarkdown).toBe('tres')
  })

  test('an unrelated fix leaves a pending proposal open and goes through', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    expect((await admin.as.mutation(api.audit.fixAudit, { auditId, stem: 'Enunciado corregido' })).keyChange).toBeNull()
    const row = await getAudit(t, auditId)
    expect((await getQuestion(t, questionId))).toMatchObject({ bodyMarkdown: 'Enunciado corregido', answerCorrectOption: 'C' })
    expect(row).toMatchObject({ status: 'needs_review' })
    expect(row?.history.some((entry) => entry.source === 'key_proposal:teacher')).toBe(true)
    await admin.as.mutation(api.audit.signKeyProposal, { auditId })
    expect((await getQuestion(t, questionId))?.answerCorrectOption).toBe('A')
  })

  test('a colleague cannot overwrite a pending proposal; the proposer and the other role may', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const colleague = await reviewer(t, 'otra@x.co')
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await expect(colleague.as.mutation(api.audit.fixAudit, { auditId, key: 'B' })).rejects.toThrow(/propuesta/)
    expect((await getAudit(t, auditId))?.history.at(-1)).toMatchObject({ after: 'A', by: teacher.studentId })

    expect((await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'D' })).keyChange).toBe('proposed')
    expect((await getAudit(t, auditId))?.history.at(-1)).toMatchObject({ after: 'D', by: teacher.studentId })
    expect((await admin.as.mutation(api.audit.fixAudit, { auditId, key: 'B' })).keyChange).toBe('proposed')
    expect((await getAudit(t, auditId))?.history.at(-1)).toMatchObject({ after: 'B', by: admin.studentId })
  })

  test('a key is never set to nothing', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await expect(admin.as.mutation(api.audit.fixAudit, { auditId, key: '' })).rejects.toThrow()
    expect((await getQuestion(t, questionId))?.answerCorrectOption).toBe('C')
  })

  test('the same person cannot sign twice', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await expect(teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })).rejects.toThrow()
  })

  test('a changed key invalidates the guide built on the old one', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const guideId = await t.run((ctx) => ctx.db.insert('questionGuides', {
      questionId, hint: 'h', byOption: {}, reveal: 'r', modelId: 'm', promptVersion: 'p', status: 'approved', createdAt: now,
    }))
    const teacher = await reviewer(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await admin.as.mutation(api.audit.signKeyProposal, { auditId })
    expect((await t.run((ctx) => ctx.db.get('questionGuides', guideId)))?.status).toBe('rejected')
  })

  test('rejecting voids the question and leaves the attempts alone', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const { attemptId } = await attempt(t, questionId, 'C', true)
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.rejectAudit, { auditId, note: 'Figura ilegible' })
    const row = await getQuestion(t, questionId)
    expect(row?.eligibility).toBe('excluded')
    expect(row?.voidedAt).toBeDefined()
    expect(row?.answerCorrectOption).toBe('C')
    expect((await t.run((ctx) => ctx.db.get('questionAttempts', attemptId)))?.isCorrect).toBe(true)
    expect((await scheduled(t)).some((job) => job.name.includes('repairAttempts'))).toBe(true)
  })

  test('the rebuild leaves a voided question out', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const { studentId } = await attempt(t, questionId, 'C', true)
    await t.mutation(internal.progress.rebuildStudentProgress, { studentId })
    const before = await t.run((ctx) => ctx.db.query('learnerSubjectAggregates').collect())
    expect(before).toHaveLength(1)
    await t.run((ctx) => ctx.db.patch('questions', questionId, { voidedAt: now }))
    await t.mutation(internal.progress.rebuildStudentProgress, { studentId })
    expect(await t.run((ctx) => ctx.db.query('learnerSubjectAggregates').collect())).toHaveLength(0)
  })

  test('the taxonomy fix must stay inside the area', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await expect(teacher.as.mutation(api.audit.fixAudit, { auditId, subtopicId: 'ingles.cualquiera' })).rejects.toThrow()
  })

  test('options keep their labels and cannot be emptied', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await expect(teacher.as.mutation(api.audit.fixAudit, {
      auditId, options: [{ label: 'A', bodyMarkdown: 'x' }, { label: 'B', bodyMarkdown: '' }, { label: 'C', bodyMarkdown: 'z' }, { label: 'D', bodyMarkdown: 'w' }],
    })).rejects.toThrow()
  })
})

describe('guides wait for the key', () => {
  const scheduledGuides = async (t: Test) => (await scheduled(t)).filter((job) => job.name.includes('generateGuide'))

  test('an original item gets a guide only when approved', async () => {
    const t = setupTest()
    const questionId = await question(t, { bankTier: 'original', eligibility: 'pending' })
    const auditId = await audited(t, questionId)
    expect(await scheduledGuides(t)).toHaveLength(0)
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.approveAudit, { auditId })
    expect(await scheduledGuides(t)).toHaveLength(1)
  })

  test('an ICFES item never gets one (G1)', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.approveAudit, { auditId })
    expect(await scheduledGuides(t)).toHaveLength(0)
  })

  test('the generator refuses an item whose key was not approved', async () => {
    const t = setupTest()
    const questionId = await question(t, { bankTier: 'original', eligibility: 'pending' })
    await audited(t, questionId)
    expect(await t.query(internal.audit.guideSource, { questionId })).toBeNull()
  })

  test('a teacher approves or rejects a guide, and it is recorded', async () => {
    const t = setupTest()
    const questionId = await question(t, { bankTier: 'original' })
    await audited(t, questionId)
    const guideId = await t.run((ctx) => ctx.db.insert('questionGuides', {
      questionId, hint: 'h', byOption: {}, reveal: 'r', modelId: 'm', promptVersion: 'p', status: 'pending', createdAt: now,
    }))
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.reviewGuide, { guideId, status: 'approved' })
    expect(await t.run((ctx) => ctx.db.get('questionGuides', guideId))).toMatchObject({ status: 'approved', reviewedBy: teacher.studentId })
  })

  const guideFor = (t: Test, questionId: Id<'questions'>, status: 'pending' | 'rejected') => t.run((ctx) => ctx.db.insert('questionGuides', {
    questionId, hint: 'h', byOption: {}, reveal: 'r', modelId: 'm', promptVersion: 'p', status, createdAt: now,
  }))

  test('a guide a key or text change invalidated is not approved again', async () => {
    const t = setupTest()
    const questionId = await question(t, { bankTier: 'original' })
    await audited(t, questionId)
    const guideId = await guideFor(t, questionId, 'rejected')
    const teacher = await reviewer(t)
    await expect(teacher.as.mutation(api.audit.reviewGuide, { guideId, status: 'approved' })).rejects.toThrow(/rechazada/)
    expect((await t.run((ctx) => ctx.db.get('questionGuides', guideId)))?.status).toBe('rejected')
  })

  test('a guide waits while its key is in dispute, but can still be rejected', async () => {
    const t = setupTest()
    const questionId = await question(t, { bankTier: 'original' })
    const auditId = await audited(t, questionId)
    const guideId = await guideFor(t, questionId, 'pending')
    const teacher = await reviewer(t)
    await teacher.as.mutation(api.audit.fixAudit, { auditId, key: 'A' })
    await expect(teacher.as.mutation(api.audit.reviewGuide, { guideId, status: 'approved' })).rejects.toThrow(/en disputa/)
    await teacher.as.mutation(api.audit.reviewGuide, { guideId, status: 'rejected' })
    expect((await t.run((ctx) => ctx.db.get('questionGuides', guideId)))?.status).toBe('rejected')
  })
})

describe('the queue', () => {
  test('a two-model dispute comes first, and only the reviewer\'s areas are listed', async () => {
    const t = setupTest()
    const calm = await question(t)
    const disputed = await question(t)
    const inglesQuestion = await question(t, { subjectId: 'ingles' })
    await audited(t, calm, { solvers: [{ modelId: 'a', option: 'C', confidence: 1 }, { modelId: 'b', option: 'C', confidence: 1 }] })
    await audited(t, disputed, { solvers: [{ modelId: 'a', option: 'A', confidence: 1 }, { modelId: 'b', option: 'B', confidence: 1 }] })
    await audited(t, inglesQuestion, { subjectId: 'ingles' })
    const teacher = await reviewer(t)
    const queue = await teacher.as.query(api.audit.getAuditQueue, {})
    expect(queue.items.map((item) => item.questionId)).toEqual([disputed, calm])
  })

  test('a passed item appears only when it was sampled', async () => {
    const t = setupTest()
    const sampled = await question(t)
    const skipped = await question(t)
    await audited(t, sampled, { status: 'auto_passed', sampled: true })
    await audited(t, skipped, { status: 'auto_passed', sampled: false })
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    const queue = await admin.as.query(api.audit.getAuditQueue, {})
    expect(queue.items.map((item) => item.questionId)).toEqual([sampled])
  })

  test('the current bank is reviewed whole by default', async () => {
    const t = setupTest()
    const a = await question(t)
    const auditId = await audited(t, a, { status: 'auto_passed' })
    await t.mutation(internal.audit.drawAuditSample, { seed: 's' })
    expect((await getAudit(t, auditId))?.sampled).toBe(true)
  })

  test('only auto-passed items outside the sample publish alone, and never an original', async () => {
    const t = setupTest()
    const icfes = await question(t, { eligibility: 'pending' })
    const original = await question(t, { eligibility: 'pending', bankTier: 'original' })
    await audited(t, icfes, { status: 'auto_passed', sampled: false })
    await audited(t, original, { status: 'auto_passed', sampled: false })
    await t.mutation(internal.audit.publishAutoPassed, {})
    expect((await getQuestion(t, icfes))?.eligibility).toBe('diagnostic')
    expect((await getQuestion(t, original))?.eligibility).toBe('pending')
  })
})

describe('reviewer accounts', () => {
  test('granting subjects makes the account a reviewer of those areas', async () => {
    const t = setupTest()
    const { studentId } = await signUp(t, 'marta@x.co')
    await t.mutation(internal.audit.grantReviewer, { email: 'marta@x.co', subjects: ['ingles'] })
    expect((await t.run((ctx) => ctx.db.get('students', studentId)))?.reviewerSubjects).toEqual(['ingles'])
  })

  test('an unknown area is refused', async () => {
    const t = setupTest()
    await signUp(t, 'marta@x.co')
    await expect(t.mutation(internal.audit.grantReviewer, { email: 'marta@x.co', subjects: ['cocina'] })).rejects.toThrow()
  })

  test('an admin opening a question from the bank creates its row, ready to review', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await admin.as.mutation(api.audit.openAudit, { questionId })
    const row = await t.run((ctx) => ctx.db.query('questionAudits').withIndex('by_questionId', (q) => q.eq('questionId', questionId)).unique())
    expect(row?.status).toBe('needs_review')
  })
})

describe('reports feed the audit', () => {
  const report = api.questionReports.reportQuestionProblem

  /** A session of `studentId` that served `questionId`, the only thing that lets them report it. */
  const servedTo = (t: Test, studentId: Id<'students'>, questionId: Id<'questions'>) => t.run(async (ctx) => {
    const sessionId = await ctx.db.insert('sessions', {
      studentId, kind: 'topic', status: 'in_progress', recommendationSource: 'manual', startedAt: now, questionCount: 1, currentPosition: 1,
    })
    await ctx.db.insert('sessionQuestions', { sessionId, questionId, position: 1, selectionReason: 'topic_focus' })
    return sessionId
  })

  test('a report on the answer returns an approved item to review', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'approved' })
    const student = await signUp(t, 'ana@x.co')
    await student.as.mutation(report, { questionId, sessionId: await servedTo(t, student.studentId, questionId), reason: 'respuesta_incorrecta' })
    expect((await getAudit(t, auditId))?.status).toBe('needs_review')
  })

  test('a report on the image does too', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'fixed' })
    const student = await signUp(t, 'ana@x.co')
    await student.as.mutation(report, { questionId, sessionId: await servedTo(t, student.studentId, questionId), reason: 'imagen_ilegible' })
    expect((await getAudit(t, auditId))?.status).toBe('needs_review')
  })

  test('other reasons do not', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'approved' })
    const student = await signUp(t, 'ana@x.co')
    await student.as.mutation(report, { questionId, sessionId: await servedTo(t, student.studentId, questionId), reason: 'enunciado_confuso' })
    expect((await getAudit(t, auditId))?.status).toBe('approved')
  })

  test('a question not yet inventoried gets its audit row', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const student = await signUp(t, 'ana@x.co')
    await student.as.mutation(report, { questionId, sessionId: await servedTo(t, student.studentId, questionId), reason: 'respuesta_incorrecta' })
    const row = await t.run((ctx) => ctx.db.query('questionAudits').withIndex('by_questionId', (q) => q.eq('questionId', questionId)).unique())
    expect(row?.status).toBe('needs_review')
  })

  test('only a session of that student that served the item can report it', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const other = await question(t)
    const auditId = await audited(t, questionId, { status: 'approved' })
    const student = await signUp(t, 'ana@x.co')
    const stranger = await signUp(t, 'beto@x.co')
    const hers = await servedTo(t, student.studentId, questionId)
    await expect(stranger.as.mutation(report, { questionId, sessionId: hers, reason: 'respuesta_incorrecta' })).rejects.toThrow()
    const unrelated = await servedTo(t, student.studentId, other)
    await expect(student.as.mutation(report, { questionId, sessionId: unrelated, reason: 'respuesta_incorrecta' })).rejects.toThrow()
    expect((await getAudit(t, auditId))?.status).toBe('approved')
  })

  test('editing an open report never reopens the audit', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'approved' })
    const student = await signUp(t, 'ana@x.co')
    const sessionId = await servedTo(t, student.studentId, questionId)
    await student.as.mutation(report, { questionId, sessionId, reason: 'respuesta_incorrecta' })
    await t.run((ctx) => ctx.db.patch('questionAudits', auditId, { status: 'approved' }))
    await student.as.mutation(report, { questionId, sessionId, reason: 'respuesta_incorrecta', note: 'Otra vez' })
    expect((await getAudit(t, auditId))?.status).toBe('approved')
  })

  test('a report does not undo a reviewer\'s rejection', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'rejected' })
    const student = await signUp(t, 'ana@x.co')
    await student.as.mutation(report, { questionId, sessionId: await servedTo(t, student.studentId, questionId), reason: 'respuesta_incorrecta' })
    expect((await getAudit(t, auditId))?.status).toBe('rejected')
  })

  test('a reopened item is not lost to its guide: signing it again asks for one', async () => {
    const t = setupTest()
    const questionId = await question(t, { bankTier: 'original', eligibility: 'pending' })
    const auditId = await audited(t, questionId)
    const teacher = await reviewer(t)
    const student = await signUp(t, 'ana@x.co')
    await teacher.as.mutation(api.audit.approveAudit, { auditId })
    await student.as.mutation(report, { questionId, sessionId: await servedTo(t, student.studentId, questionId), reason: 'respuesta_incorrecta' })
    expect((await getAudit(t, auditId))?.status).toBe('needs_review')
    expect(await t.query(internal.audit.guideSource, { questionId })).toBeNull()
    await teacher.as.mutation(api.audit.approveAudit, { auditId })
    expect((await scheduled(t)).filter((job) => job.name.includes('generateGuide'))).toHaveLength(2)
    expect(await t.query(internal.audit.guideSource, { questionId })).not.toBeNull()
  })

  test('a row still in the pipeline stays there', async () => {
    const t = setupTest()
    const questionId = await question(t)
    const auditId = await audited(t, questionId, { status: 'pending_checks' })
    const student = await signUp(t, 'ana@x.co')
    await student.as.mutation(report, { questionId, sessionId: await servedTo(t, student.studentId, questionId), reason: 'respuesta_incorrecta' })
    expect((await getAudit(t, auditId))?.status).toBe('pending_checks')
  })
})
