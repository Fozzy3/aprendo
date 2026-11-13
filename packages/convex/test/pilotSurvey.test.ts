import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import {
  PILOT_SURVEY_QUESTIONS,
  isSurveyDue,
  summarizeSurvey,
  surveyAnswersError,
  type SurveyAnswers,
} from '../src/pilotSurveyQuestions'
import { setupTest, signUp } from './signIn'

/** The six required scales, answered. */
const REQUIRED: SurveyAnswers = {
  start_ease: 4, diagnostic_fit: 3, today_clarity: 5, help_useful: 'na', saber_likeness: 4, helps_improve: 5,
}
/** Who answered: typed on the survey's first screen. */
const WHO = { name: 'Ana Pérez', studentCode: '20231020' }

describe('the pilot survey questions', () => {
  test('are the fifteen of the plan, with unique ids', () => {
    expect(PILOT_SURVEY_QUESTIONS).toHaveLength(15)
    expect(new Set(PILOT_SURVEY_QUESTIONS.map((question) => question.id)).size).toBe(15)
    expect(PILOT_SURVEY_QUESTIONS[0]?.text).toBe('¿Qué tan fácil fue empezar a usar Aprendo?')
    expect(PILOT_SURVEY_QUESTIONS[11]).toMatchObject({ kind: 'nps' })
    expect(PILOT_SURVEY_QUESTIONS.filter((question) => question.required).map((question) => question.id))
      .toEqual(Object.keys(REQUIRED))
  })
})

describe('surveyAnswersError', () => {
  test('accepts the required answers alone, and a full survey', () => {
    expect(surveyAnswersError(REQUIRED)).toBeNull()
    expect(surveyAnswersError({
      ...REQUIRED,
      help_useful: 2,
      come_back: ['racha', 'xp'],
      blockers: ['tiempo'],
      device: 'celular_propio',
      other_prep: ['nada'],
      disappointment: 'muy',
      recommend: 0,
      pay: 'hasta_10',
      confusing: 'Nada',
      change: 'x'.repeat(1000),
    })).toBeNull()
  })

  test('refuses a missing required answer', () => {
    const { start_ease: _, ...rest } = REQUIRED
    expect(surveyAnswersError(rest)).not.toBeNull()
  })

  test('refuses values outside each question', () => {
    for (const bad of [
      { start_ease: 0 }, { start_ease: 6 }, { start_ease: 2.5 }, { start_ease: 'na' },
      { help_useful: 'nunca' }, { recommend: 11 }, { recommend: -1 },
      { device: 'tablet' }, { device: ['celular_propio'] },
      { come_back: ['racha', 'dinero'] }, { come_back: [] }, { come_back: ['racha', 'racha'] }, { come_back: 'racha' },
      { confusing: 'x'.repeat(1001) }, { confusing: '   ' }, { confusing: 3 },
      { unknown_question: 1 },
    ]) {
      expect({ bad, error: surveyAnswersError({ ...REQUIRED, ...bad }) }).not.toMatchObject({ error: null })
    }
  })
})

describe('isSurveyDue', () => {
  const completed = (count: number) => Array.from({ length: count }, () => ({ status: 'completed' }))
  test('after three completed sessions, until answered', () => {
    expect(isSurveyDue(completed(2), false)).toBe(false)
    expect(isSurveyDue([...completed(2), { status: 'in_progress' }, { status: 'abandoned' }], false)).toBe(false)
    expect(isSurveyDue(completed(3), false)).toBe(true)
    expect(isSurveyDue(completed(3), true)).toBe(false)
  })
})

describe('summarizeSurvey', () => {
  const responses = [
    { submittedAt: 1, answers: { ...REQUIRED, start_ease: 5, help_useful: 'na', recommend: 10, disappointment: 'muy', come_back: ['racha', 'xp'], confusing: 'El tutor' } },
    { submittedAt: 3, answers: { ...REQUIRED, start_ease: 3, help_useful: 4, recommend: 9, disappointment: 'algo', come_back: ['racha'], confusing: 'Los simulacros' } },
    { submittedAt: 2, answers: { ...REQUIRED, start_ease: 4, help_useful: 2, recommend: 6, disappointment: 'muy' } },
    { submittedAt: 4, answers: { ...REQUIRED, start_ease: 4, recommend: 8 } },
  ]
  const summary = summarizeSurvey(responses)
  const question = (id: string) => summary.questions.find((entry) => entry.id === id)!
  const count = (id: string, value: string) => question(id).counts.find((entry) => entry.value === value)?.count

  test('counts responses and each question’s answers', () => {
    expect(summary.total).toBe(4)
    expect(question('disappointment').answered).toBe(3)
    expect(question('change').answered).toBe(0)
  })

  test('averages a scale, leaving out "no lo usé"', () => {
    expect(question('start_ease').mean).toBe(4)
    expect(question('help_useful').mean).toBe(3)
    expect(count('help_useful', 'na')).toBe(2)
    expect(count('start_ease', '4')).toBe(2)
  })

  test('counts each option of a multiple choice', () => {
    expect(count('come_back', 'racha')).toBe(2)
    expect(count('come_back', 'xp')).toBe(1)
    expect(count('come_back', 'liga')).toBe(0)
  })

  test('NPS is promoters minus detractors, in percent', () => {
    // 2 promoters (10, 9), 1 passive (8), 1 detractor (6) of 4.
    expect(summary.nps).toBe(25)
    expect(question('recommend').mean).toBe(8.25)
  })

  test('Sean Ellis is the share "muy decepcionado" of those who answered', () => {
    expect(summary.seanEllis).toBeCloseTo(66.67, 1)
  })

  test('lists every free text with its date, newest first', () => {
    expect(question('confusing').texts).toEqual([
      { text: 'Los simulacros', submittedAt: 3 },
      { text: 'El tutor', submittedAt: 1 },
    ])
  })

  test('has nothing to compute without answers', () => {
    const empty = summarizeSurvey([])
    expect(empty).toMatchObject({ total: 0, nps: null, seanEllis: null })
    expect(empty.questions[0]?.mean).toBeNull()
  })
})

describe('pilotSurvey functions', () => {
  test('a student submits once, and sees it', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    expect(await ana.as.query(api.pilotSurvey.getMine, { studentId: ana.studentId })).toBeNull()
    await ana.as.mutation(api.pilotSurvey.submit, { ...WHO, studentId: ana.studentId, answers: { ...REQUIRED, confusing: '  Nada  ' } })
    const mine = await ana.as.query(api.pilotSurvey.getMine, { studentId: ana.studentId })
    expect(typeof mine?.submittedAt).toBe('number')
    const rows = await t.run((ctx) => ctx.db.query('pilotSurveyResponses').collect())
    expect(rows).toHaveLength(1)
    expect(rows[0]?.answers.confusing).toBe('Nada')

    await expect(ana.as.mutation(api.pilotSurvey.submit, { ...WHO, studentId: ana.studentId, answers: REQUIRED }))
      .rejects.toThrow('Ya respondiste')
    expect(await t.run((ctx) => ctx.db.query('pilotSurveyResponses').collect())).toHaveLength(1)
  })

  test('refuses invalid answers and answering for someone else', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const luis = await signUp(t, 'luis@x.co')
    await expect(ana.as.mutation(api.pilotSurvey.submit, { ...WHO, studentId: ana.studentId, answers: { ...REQUIRED, recommend: 12 } }))
      .rejects.toThrow()
    await expect(luis.as.mutation(api.pilotSurvey.submit, { ...WHO, studentId: ana.studentId, answers: REQUIRED })).rejects.toThrow()
    await expect(luis.as.query(api.pilotSurvey.getMine, { studentId: ana.studentId })).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('pilotSurveyResponses').collect())).toEqual([])
  })

  test('only staff read the summary and the raw responses', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await ana.as.mutation(api.pilotSurvey.submit, { ...WHO, studentId: ana.studentId, answers: { ...REQUIRED, recommend: 10 } })

    await expect(ana.as.query(api.pilotSurvey.summary, {})).rejects.toThrow()
    await expect(ana.as.query(api.pilotSurvey.listResponses, {})).rejects.toThrow()
    await expect(t.query(api.pilotSurvey.summary, {})).rejects.toThrow()

    const summary = await admin.as.query(api.pilotSurvey.summary, {})
    expect(summary).toMatchObject({ total: 1, nps: 100 })
    const responses = await admin.as.query(api.pilotSurvey.listResponses, {})
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ submittedAt: expect.any(Number), ...WHO, answers: { ...REQUIRED, recommend: 10 } })
  })

  test('keeps the name and code trimmed, and refuses them blank or too long', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    for (const bad of [{ name: '  ' }, { studentCode: '' }, { name: 'x'.repeat(121) }, { studentCode: '1'.repeat(41) }]) {
      await expect(ana.as.mutation(api.pilotSurvey.submit, { ...WHO, ...bad, studentId: ana.studentId, answers: REQUIRED }))
        .rejects.toThrow('nombre y tu código')
    }
    await ana.as.mutation(api.pilotSurvey.submit, { name: '  Ana Pérez ', studentCode: ' 20231020 ', studentId: ana.studentId, answers: REQUIRED })
    const rows = await t.run((ctx) => ctx.db.query('pilotSurveyResponses').collect())
    expect(rows[0]).toMatchObject(WHO)
  })
})
