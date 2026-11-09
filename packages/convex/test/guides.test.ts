import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import { isGuideServable, ladderLength, pathSteps, shuffledChoices } from '../src/guides'
import { setupTest, signUp } from './signIn'

const SUBTOPIC = 'matematicas.functions_variation.functions_graphs'
const now = 1_700_000_000_000

type Guide = 'approved' | 'pending' | 'rejected' | null
const step = (prompt: string) => ({ prompt, choices: [{ text: 'sí', correct: true }, { text: 'no' }] })
const GUIDE_BODY = {
  hint: '¿Qué te piden?',
  byOption: {
    B: { diagnose: { prompt: '¿Qué te hizo elegir la B?', choices: [{ text: 'razón 1' }, { text: 'razón 2' }] }, steps: [step('b1'), step('b2'), step('b3')] },
    C: { diagnose: { prompt: '¿Qué te hizo elegir la C?', choices: [{ text: 'razón c' }] }, steps: [step('c1')] },
  },
  reveal: 'Porque sí.',
  modelId: 'm', promptVersion: 'v1', createdAt: now,
}

async function setup(t: ReturnType<typeof setupTest>, opts: {
  guide?: Guide
  kind?: 'topic' | 'simulacro'
  bankTier?: 'icfes' | 'original'
  eligibilityReasons?: string[]
  feedbackMode?: 'inmediata' | undefined
  masteryLevel?: 'familiar' | 'competente' | 'dominado'
} = {}) {
  const { studentId, as } = await signUp(t, 'ana@x.co')
  const ids = await t.run(async (ctx) => {
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['pdf'])), contentType: 'application/pdf',
      sizeBytes: 3, status: 'uploaded', createdAt: now, updatedAt: now,
    })
    const questionId = await ctx.db.insert('questions', {
      pdfUploadId, sequence: 1, questionNumber: 1, bodyMarkdown: 'q',
      options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }, { label: 'C', bodyMarkdown: 'c' }],
      createdAt: now, subjectId: 'matematicas', categoryId: 'c', primarySubtopicId: SUBTOPIC,
      answerCorrectOption: 'A', answerSolutionMarkdown: 'La solución.', answerDistractorRationales: [{ label: 'B', rationaleMarkdown: 'no' }],
      bankTier: opts.bankTier,
      eligibilityReasons: opts.eligibilityReasons,
    })
    if (opts.guide != null) {
      await ctx.db.insert('questionGuides', { questionId, ...GUIDE_BODY, status: opts.guide })
    }
    const kind = opts.kind ?? 'topic'
    const sessionId = await ctx.db.insert('sessions', {
      studentId, kind, status: 'in_progress', recommendationSource: 'manual', subjectId: 'matematicas',
      feedbackMode: kind === 'topic' ? 'inmediata' : undefined,
      startedAt: now, questionCount: 1, currentPosition: 1,
    })
    const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId, questionId, position: 1, selectionReason: 'topic_focus' })
    if (opts.masteryLevel != null) {
      await ctx.db.insert('learnerSubtopicAggregates', {
        studentId, subjectId: 'matematicas', subtopicId: SUBTOPIC, attemptCount: 1, correctCount: 1, accuracy: 1,
        recentAttemptCount: 1, recentAccuracy: 1, avgResponseTimeMs: 1, hintRate: 0, tutorRate: 0, masteryScore: 1, evidenceLevel: 'low',
        updatedAt: now, masteryLevel: opts.masteryLevel,
      })
    }
    return { sessionId, sessionQuestionId, questionId }
  })
  return { studentId, as, ...ids }
}

type Ctx = Awaited<ReturnType<typeof setup>>
const args = (c: Ctx) => ({ sessionId: c.sessionId, sessionQuestionId: c.sessionQuestionId })
const answer = (c: Ctx, selectedOption: string, confidence?: 'sure' | 'unsure' | 'guess') =>
  c.as.mutation(api.sessions.submitAnswer, { ...args(c), selectedOption, responseTimeMs: 10_000, confidence })
const check = (c: Ctx) => c.as.mutation(api.sessions.checkAnswer, args(c))
const guideView = (c: Ctx) => c.as.query(api.guides.getGuideStep, args(c))
const tap = (c: Ctx, choiceIndex = 0) => c.as.mutation(api.guides.answerGuideStep, { ...args(c), choiceIndex })

async function walkAllSteps(c: Ctx) {
  for (let view = await guideView(c); view?.phase === 'step'; view = await guideView(c)) await tap(c)
}

describe('pure path rules', () => {
  test('a guide is served only when approved; pending only for the seed bank opened for the demo', () => {
    expect(isGuideServable({ status: 'approved' }, {})).toBe(true)
    expect(isGuideServable({ status: 'pending' }, { eligibilityReasons: ['seed_demo'] })).toBe(true)
    expect(isGuideServable({ status: 'pending' }, { eligibilityReasons: ['audit_approved'] })).toBe(false)
    expect(isGuideServable({ status: 'pending' }, {})).toBe(false)
    expect(isGuideServable({ status: 'rejected' }, { eligibilityReasons: ['seed_demo'] })).toBe(false)
  })

  test('the ladder fades with mastery', () => {
    expect(ladderLength('sin_empezar', 3)).toBe(3)
    expect(ladderLength('intentado', 3)).toBe(3)
    expect(ladderLength('familiar', 3)).toBe(3)
    expect(ladderLength('competente', 3)).toBe(1)
    expect(ladderLength('dominado', 3)).toBe(0)
    expect(ladderLength('competente', 0)).toBe(0)
  })

  test('the path opens with the diagnosis, unless there is no ladder at all', () => {
    const entry = { diagnose: step('d'), steps: [step('s1'), step('s2')] }
    expect(pathSteps(entry, 'familiar').map((item) => item.prompt)).toEqual(['d', 's1', 's2'])
    expect(pathSteps(entry, 'competente').map((item) => item.prompt)).toEqual(['d', 's1'])
    expect(pathSteps(entry, 'dominado')).toEqual([])
  })

  test('choices are shuffled by question and step: stable, and the right one is not always first', () => {
    const entry = {
      diagnose: { prompt: 'd', choices: [{ text: 'r1' }, { text: 'r2' }, { text: 'r3' }] },
      steps: Array.from({ length: 3 }, (_, index) => ({
        prompt: `s${index}`,
        choices: [{ text: `bien ${index}`, correct: true }, { text: `mal ${index}` }, { text: `peor ${index}` }],
      })),
    }
    const ids = Array.from({ length: 40 }, (_, index) => `question-${index}`)

    const firsts = ids.flatMap((id) => shuffledChoices(entry, id).steps).map((step) => step.choices[0]!.correct === true)
    expect(firsts.some(Boolean)).toBe(true)
    expect(firsts.some((first) => !first)).toBe(true)

    // The same question and step always give the same order, across a query and the mutation behind it.
    expect(shuffledChoices(entry, 'q1')).toEqual(shuffledChoices(entry, 'q1'))

    for (const id of ids) {
      const shuffled = shuffledChoices(entry, id)
      // What is shuffled is the order, never which one is correct.
      for (const [index, step] of shuffled.steps.entries()) {
        expect([...step.choices].sort((a, b) => a.text.localeCompare(b.text))).toEqual(
          [...entry.steps[index]!.choices].sort((a, b) => a.text.localeCompare(b.text)),
        )
      }
    }
  })
})

describe('checkAnswer', () => {
  test('a wrong answer does not get the key, its explanation or the rationales', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    expect(await check(c)).toEqual({
      selectedOption: 'B',
      isCorrect: false,
      correctOption: null,
      solutionMarkdown: null,
      distractorRationales: [],
      explanationSource: null,
      guidedPathOpen: true,
    })
    const session = await c.as.query(api.sessions.getSession, { sessionId: c.sessionId })
    expect(session?.questions[0]?.question.answerCorrectOption).toBeUndefined()
    expect(session?.questions[0]?.attempt?.isCorrect).toBeUndefined()
  })

  test('a right answer shows the key at once', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'A', 'sure')
    expect(await check(c)).toMatchObject({ isCorrect: true, correctOption: 'A', solutionMarkdown: 'La solución.', guidedPathOpen: false })
    expect(await guideView(c)).toBeNull()
  })

  test('the first answer is locked once checked', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await expect(answer(c, 'A')).rejects.toThrow()
  })
})

describe('the guided path', () => {
  test('nothing is served before the answer is checked', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    expect(await guideView(c)).toBeNull()
    await answer(c, 'B')
    expect(await guideView(c)).toBeNull()
  })

  test('serves the steps one at a time, only for the picked option, without marking the right choice', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)

    const first = await guideView(c)
    expect(first).toMatchObject({ phase: 'step', stepIndex: 0, stepCount: 4, prompt: '¿Qué te hizo elegir la B?', canReveal: false })
    expect([...(first as { choices: string[] }).choices].sort()).toEqual(['razón 1', 'razón 2'])
    expect(JSON.stringify(first)).not.toContain('reveal":"')

    await tap(c, 1)
    const second = await guideView(c)
    expect(second).toMatchObject({ phase: 'step', stepIndex: 1, prompt: 'b1', canReveal: true })
    expect(JSON.stringify(second)).not.toContain('correct')

    // The diagnosis has no wrong answer; a ladder step says how the tap went.
    const indexOf = (view: unknown, text: string) => (view as { choices: string[] }).choices.indexOf(text)
    expect(await tap(c, indexOf(second, 'sí'))).toEqual({ correct: true })
    expect(await tap(c, indexOf(await guideView(c), 'no'))).toEqual({ correct: false })
    expect(await guideView(c)).toMatchObject({ phase: 'step', stepIndex: 3 })
    await tap(c, 0)
    expect(await guideView(c)).toEqual({ phase: 'retry', canReveal: true })
  })

  test('a right retry is "self_corrected" and never changes the first answer', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await walkAllSteps(c)

    const ended = await c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'A' })
    expect(ended).toMatchObject({ phase: 'ended', outcome: 'self_corrected', correctOption: 'A', solutionMarkdown: 'La solución.', reveal: 'Porque sí.' })

    const attempt = await t.run((ctx) => ctx.db.query('questionAttempts').withIndex('by_sessionQuestionId', (q) => q.eq('sessionQuestionId', c.sessionQuestionId)).unique())
    expect(attempt).toMatchObject({ selectedOption: 'B', isCorrect: false, guidedOutcome: 'self_corrected' })

    const session = await c.as.query(api.sessions.getSession, { sessionId: c.sessionId })
    expect(session?.questions[0]?.question.answerCorrectOption).toBe('A')
    expect(await check(c)).toMatchObject({ correctOption: 'A', guidedPathOpen: false, isCorrect: false })
  })

  test('a second miss reveals the answer', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await walkAllSteps(c)
    expect(await c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'C' })).toMatchObject({ outcome: 'revealed', correctOption: 'A' })
    expect(await guideView(c)).toMatchObject({ phase: 'ended', outcome: 'revealed' })
  })

  test('the retry waits for the ladder, and an unknown option is refused', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await expect(c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'A' })).rejects.toThrow()
    await walkAllSteps(c)
    await expect(c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'Z' })).rejects.toThrow()
  })

  test('"Muéstrame" appears only after step 1, and using it early is a skip', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await expect(c.as.mutation(api.guides.revealGuidedAnswer, args(c))).rejects.toThrow()
    await tap(c)
    const ended = await c.as.mutation(api.guides.revealGuidedAnswer, args(c))
    expect(ended).toMatchObject({ outcome: 'revealed', correctOption: 'A', reveal: 'Porque sí.' })
    const attempt = await t.run((ctx) => ctx.db.query('questionAttempts').withIndex('by_sessionQuestionId', (q) => q.eq('sessionQuestionId', c.sessionQuestionId)).unique())
    expect(attempt?.guidedSkipped).toBe(true)
  })

  test('asking for the answer after walking the ladder is not a skip', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await walkAllSteps(c)
    await c.as.mutation(api.guides.revealGuidedAnswer, args(c))
    const attempt = await t.run((ctx) => ctx.db.query('questionAttempts').withIndex('by_sessionQuestionId', (q) => q.eq('sessionQuestionId', c.sessionQuestionId)).unique())
    expect(attempt?.guidedSkipped).toBeUndefined()
    expect(attempt?.guidedOutcome).toBe('revealed')
  })

  test('the ladder follows mastery: one step at competente, none at dominado', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved', masteryLevel: 'competente' })
    await answer(c, 'B')
    await check(c)
    expect(await guideView(c)).toMatchObject({ phase: 'step', stepCount: 2 })
  })

  test('dominado goes straight to the retry', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved', masteryLevel: 'dominado' })
    await answer(c, 'B')
    await check(c)
    expect(await guideView(c)).toEqual({ phase: 'retry', canReveal: false })
  })

  test('only the first answer feeds mastery and the session summary', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await walkAllSteps(c)
    await c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'A' })
    const summary = await c.as.mutation(api.sessions.completeSession, { sessionId: c.sessionId })
    expect(summary.correctCount).toBe(0)
    const aggregate = await t.run((ctx) => ctx.db.query('learnerSubtopicAggregates')
      .withIndex('by_studentId_subtopicId', (q) => q.eq('studentId', c.studentId).eq('subtopicId', SUBTOPIC)).first())
    expect(aggregate?.correctCount).toBe(0)
    expect((await t.run((ctx) => ctx.db.get('questions', c.questionId)))?.difficultyAttemptCount).toBe(1)
  })
})

describe('which guide is served', () => {
  test('a pending guide is held back on an ICFES item', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'pending' })
    await answer(c, 'B')
    await check(c)
    expect(await guideView(c)).toEqual({ phase: 'retry', canReveal: false })
  })

  test('a pending guide is served on a seed item opened for the demo', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'pending', bankTier: 'original', eligibilityReasons: ['seed_demo'] })
    await answer(c, 'B')
    await check(c)
    expect((await guideView(c))?.phase).toBe('step')
  })

  test('a pending guide waits for a teacher on any other authored item', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'pending', bankTier: 'original', eligibilityReasons: ['audit_approved'] })
    await answer(c, 'B')
    await check(c)
    expect(await guideView(c)).toEqual({ phase: 'retry', canReveal: false })
  })

  test('a rejected guide is never served', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'rejected', bankTier: 'original' })
    await answer(c, 'B')
    await check(c)
    expect(await guideView(c)).toEqual({ phase: 'retry', canReveal: false })
  })
})

describe('a question with no guide', () => {
  test('withholds the key, allows one retry, then reveals', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: null })
    await answer(c, 'B')
    expect(await check(c)).toMatchObject({ correctOption: null, guidedPathOpen: true })
    expect(await guideView(c)).toEqual({ phase: 'retry', canReveal: false })
    await expect(c.as.mutation(api.guides.revealGuidedAnswer, args(c))).rejects.toThrow()

    const ended = await c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'C' })
    expect(ended).toMatchObject({ outcome: 'revealed', correctOption: 'A', solutionMarkdown: 'La solución.', reveal: null })
  })

  test('a right retry self-corrects', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: null })
    await answer(c, 'B')
    await check(c)
    expect(await c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'A' })).toMatchObject({ outcome: 'self_corrected' })
  })
})

describe('right but unsure: one "why" question', () => {
  test('low confidence gets the why step once; sure gets nothing', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'A', 'guess')
    await check(c)
    expect(await guideView(c)).toMatchObject({ phase: 'why' })
    await tap(c, 0)
    expect(await guideView(c)).toBeNull()
  })

  test('the question is about the right answer, never taken from a wrong option\'s path', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'A', 'unsure')
    await check(c)
    const view = await guideView(c)
    expect(view?.phase).toBe('why')
    const wrongPaths = Object.values(GUIDE_BODY.byOption).flatMap((path) => [path.diagnose, ...path.steps])
    expect(wrongPaths.map((item) => item.prompt)).not.toContain(view && 'prompt' in view ? view.prompt : '')
    expect(await tap(c, 0)).toEqual({ correct: null })
  })

  test('without a servable guide there is nothing to ask', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: null })
    await answer(c, 'A', 'unsure')
    await check(c)
    expect(await guideView(c)).toBeNull()
  })
})

describe('the hint before answering', () => {
  test('returns the guide hint, once checked no more, and records the use', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    expect(await c.as.mutation(api.guides.takeGuideHint, args(c))).toEqual({ hint: '¿Qué te piden?' })
    const attempt = await t.run((ctx) => ctx.db.query('questionAttempts').withIndex('by_sessionQuestionId', (q) => q.eq('sessionQuestionId', c.sessionQuestionId)).unique())
    expect(attempt).toMatchObject({ usedHint: true, hintCount: 1 })
    expect(attempt?.selectedOption).toBeUndefined()
  })

  test('without a servable guide there is no hint and nothing is counted', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: null })
    expect(await c.as.mutation(api.guides.takeGuideHint, args(c))).toEqual({ hint: null })
    const attempt = await t.run((ctx) => ctx.db.query('questionAttempts').withIndex('by_sessionQuestionId', (q) => q.eq('sessionQuestionId', c.sessionQuestionId)).unique())
    expect(attempt).toBeNull()
  })
})

describe('exams keep their seals', () => {
  test('in a simulacro no guide is served and no hint is given, whatever the attempt says', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved', kind: 'simulacro' })
    await answer(c, 'B')
    await expect(c.as.mutation(api.sessions.checkAnswer, args(c))).rejects.toThrow()
    await t.run(async (ctx) => {
      const attempt = await ctx.db.query('questionAttempts').withIndex('by_sessionQuestionId', (q) => q.eq('sessionQuestionId', c.sessionQuestionId)).unique()
      await ctx.db.patch('questionAttempts', attempt!._id, { checkedAt: now })
    })
    expect(await guideView(c)).toBeNull()
    await expect(c.as.mutation(api.guides.takeGuideHint, args(c))).rejects.toThrow()
    await expect(tap(c)).rejects.toThrow()
    await expect(c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'A' })).rejects.toThrow()
    await expect(c.as.mutation(api.guides.revealGuidedAnswer, args(c))).rejects.toThrow()
  })

  test('another student cannot walk someone else’s path', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    const { as: other } = await signUp(t, 'eva@x.co')
    await expect(other.query(api.guides.getGuideStep, args(c))).rejects.toThrow()
    await expect(other.mutation(api.guides.answerGuideStep, { ...args(c), choiceIndex: 0 })).rejects.toThrow()
  })

  test('an item a live exam asks stays sealed on the path', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await t.run(async (ctx) => {
      const examId = await ctx.db.insert('sessions', {
        studentId: c.studentId, kind: 'simulacro', status: 'in_progress', recommendationSource: 'rule_based', startedAt: now, questionCount: 1, currentPosition: 1,
      })
      await ctx.db.insert('sessionQuestions', { sessionId: examId, questionId: c.questionId, position: 1, selectionReason: 'balanced_coverage' })
    })
    expect(await guideView(c)).toBeNull()
    await expect(c.as.mutation(api.guides.answerGuideStep, { ...args(c), choiceIndex: 0 })).rejects.toThrow()
    await expect(c.as.mutation(api.guides.retryGuidedAnswer, { ...args(c), selectedOption: 'A' })).rejects.toThrow()
  })
})

describe('the review', () => {
  test('after the close the path for the picked option is available with its reveal', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    await check(c)
    await c.as.mutation(api.sessions.completeSession, { sessionId: c.sessionId })
    const review = await c.as.query(api.guides.getReviewGuide, { sessionId: c.sessionId, sessionQuestionId: c.sessionQuestionId })
    expect(review?.steps.map((item) => item.prompt)).toEqual(['¿Qué te hizo elegir la B?', 'b1', 'b2', 'b3'])
    expect(review?.reveal).toBe('Porque sí.')
  })

  test('is null while the session is open and for a question answered right', async () => {
    const t = setupTest()
    const c = await setup(t, { guide: 'approved' })
    await answer(c, 'B')
    expect(await c.as.query(api.guides.getReviewGuide, { sessionId: c.sessionId, sessionQuestionId: c.sessionQuestionId })).toBeNull()

    const right = await setup(setupTest(), { guide: 'approved' })
    await answer(right, 'A')
    await right.as.mutation(api.sessions.completeSession, { sessionId: right.sessionId })
    expect(await right.as.query(api.guides.getReviewGuide, { sessionId: right.sessionId, sessionQuestionId: right.sessionQuestionId })).toBeNull()
  })
})
