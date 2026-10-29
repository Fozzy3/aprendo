import { describe, expect, test } from 'bun:test'
import {
  buildNivelacionResult,
  buildSimulacroReport,
  isFirstPlacement,
  resolveSimulacroExam,
  subtopicBreakdown,
  type ReportItem,
} from '../src/examReport'
import { estimateGlobalScore } from '../src/globalScore'
import { getLevelForScore } from '../src/levels'
import { summarizeConfidence } from '../src/confidence'

let nextId = 0
function item(overrides: Partial<ReportItem>): ReportItem {
  nextId += 1
  return {
    sessionId: 's1',
    sessionQuestionId: `sq${nextId}`,
    position: nextId,
    subjectId: 'matematicas',
    subtopicId: 'mat_a',
    isCorrect: true,
    flagged: false,
    timeMs: null,
    officialMs: 135_000,
    ...overrides,
  }
}

describe('subtopicBreakdown', () => {
  test('counts per subtopic, weakest first, blanks as misses', () => {
    const items = [
      item({ subtopicId: 'a', isCorrect: true }),
      item({ subtopicId: 'a', isCorrect: false }),
      item({ subtopicId: 'a', isCorrect: null }),
      item({ subtopicId: 'b', isCorrect: false }),
      item({ subtopicId: 'b', isCorrect: false }),
      item({ subtopicId: 'c', isCorrect: true }),
      item({ subtopicId: null, isCorrect: false }),
    ]
    expect(subtopicBreakdown(items)).toEqual([
      { subtopicId: 'b', correctCount: 0, questionCount: 2 },
      { subtopicId: 'a', correctCount: 1, questionCount: 3 },
      { subtopicId: 'c', correctCount: 1, questionCount: 1 },
    ])
  })

  test('at equal accuracy the subtopic with more misses comes first', () => {
    const items = [
      item({ subtopicId: 'small', isCorrect: false }),
      item({ subtopicId: 'big', isCorrect: false }),
      item({ subtopicId: 'big', isCorrect: false }),
    ]
    expect(subtopicBreakdown(items).map((entry) => entry.subtopicId)).toEqual(['big', 'small'])
  })
})

describe('isFirstPlacement', () => {
  const session = (
    _id: string,
    kind: string,
    status: string,
    completedAt?: number,
  ) => ({ _id, kind, status, startedAt: (completedAt ?? 0) - 1, completedAt })

  test('the first completed nivelación unlocks the app', () => {
    const sessions = [
      session('n0', 'nivelacion', 'abandoned'),
      session('n1', 'nivelacion', 'completed', 10),
      session('n2', 'nivelacion', 'completed', 20),
      session('p1', 'topic', 'completed', 5),
    ]
    expect(isFirstPlacement(sessions, 'n1')).toBe(true)
    expect(isFirstPlacement(sessions, 'n2')).toBe(false)
  })

  test('a legacy diagnostic already placed the student', () => {
    const sessions = [
      session('d1', 'diagnostic', 'completed', 5),
      session('n1', 'nivelacion', 'completed', 10),
    ]
    expect(isFirstPlacement(sessions, 'n1')).toBe(false)
  })
})

describe('buildNivelacionResult', () => {
  const items = [
    item({ subtopicId: 'a', isCorrect: false }),
    item({ subtopicId: 'a', isCorrect: true }),
    item({ subtopicId: 'b', isCorrect: false }),
    item({ subtopicId: 'b', isCorrect: null }),
    item({ subtopicId: 'c', isCorrect: true }),
    item({ subtopicId: 'd', isCorrect: false }),
    item({ subtopicId: 'd', isCorrect: true }),
    item({ subtopicId: 'd', isCorrect: true }),
  ]

  test('scores the session, places it on the ICFES scale and names the next level', () => {
    const result = buildNivelacionResult({
      subjectId: 'matematicas',
      summary: { accuracy: 0.6, answeredCount: 14 },
      items,
      isFirstPlacement: true,
    })
    expect(result.subjectId).toBe('matematicas')
    expect(result.score).toBe(60)
    expect(result.level).toEqual(getLevelForScore('matematicas', 60))
    expect(result.level?.band.descriptorEs.length).toBeGreaterThan(0)
    expect(result.level?.nextBand?.descriptorEs.length).toBeGreaterThan(0)
    expect(result.hasEnoughEvidence).toBe(true)
    expect(result.isFirstPlacement).toBe(true)
  })

  test('the two weakest subtopics, only those with misses', () => {
    const result = buildNivelacionResult({
      subjectId: 'matematicas',
      summary: { accuracy: 0.5, answeredCount: 14 },
      items,
      isFirstPlacement: false,
    })
    expect(result.weakestSubtopics).toEqual([
      { subtopicId: 'b', correctCount: 0, questionCount: 2 },
      { subtopicId: 'a', correctCount: 1, questionCount: 2 },
    ])
  })

  test('a perfect sitting has no weak subtopics', () => {
    const result = buildNivelacionResult({
      subjectId: 'matematicas',
      summary: { accuracy: 1, answeredCount: 15 },
      items: [item({ isCorrect: true })],
      isFirstPlacement: false,
    })
    expect(result.weakestSubtopics).toEqual([])
    expect(result.level?.nextBand).toBeNull()
  })

  test('fewer answers than the evidence floor is flagged', () => {
    const result = buildNivelacionResult({
      subjectId: 'matematicas',
      summary: { accuracy: 0.2, answeredCount: 11 },
      items,
      isFirstPlacement: false,
    })
    expect(result.hasEnoughEvidence).toBe(false)
  })
})

describe('resolveSimulacroExam', () => {
  const sitting = (
    _id: string,
    startedAt: number,
    status: string,
    simulacroSessionNumber?: number,
    subjectId?: string,
  ) => ({ _id, kind: 'simulacro', status, startedAt, simulacroSessionNumber, subjectId })

  const s1a = sitting('s1a', 1, 'completed', 1)
  const s2a = sitting('s2a', 2, 'completed', 2)
  const s1b = sitting('s1b', 3, 'completed', 1)
  const s2b = sitting('s2b', 4, 'in_progress', 2)
  const s1c = sitting('s1c', 7, 'abandoned', 1)
  const s2c = sitting('s2c', 8, 'completed', 2)
  const mat1 = sitting('mat1', 0.5, 'completed', undefined, 'matematicas')
  const mat2 = sitting('mat2', 5, 'completed', undefined, 'matematicas')
  const lc1 = sitting('lc1', 6, 'completed', undefined, 'lectura_critica')
  const sessions = [s2c, mat2, s1a, s2b, lc1, s1b, s2a, mat1, s1c]

  test('Sesión 1 and the Sesión 2 that followed it are one exam', () => {
    expect(resolveSimulacroExam(sessions, s1a)).toEqual({
      sittings: [s1a, s2a],
      missingSessionNumbers: [],
      previous: [],
    })
    expect(resolveSimulacroExam(sessions, s2a).sittings).toEqual([s1a, s2a])
  })

  test('a Sesión 2 still open is missing, and the previous exam is the comparable one', () => {
    expect(resolveSimulacroExam(sessions, s1b)).toEqual({
      sittings: [s1b],
      missingSessionNumbers: [2],
      previous: [s1a, s2a],
    })
  })

  test('a Sesión 2 whose Sesión 1 was abandoned stands alone', () => {
    expect(resolveSimulacroExam(sessions, s2c)).toEqual({
      sittings: [s2c],
      missingSessionNumbers: [1],
      previous: [s1b],
    })
  })

  test('a legacy sitting without a number is Sesión 1, as every simulacro read treats it', () => {
    const legacy = sitting('legacy', 1, 'completed')
    const legacy2 = sitting('legacy2', 2, 'completed', 2)
    expect(resolveSimulacroExam([legacy2, legacy], legacy)).toEqual({
      sittings: [legacy, legacy2],
      missingSessionNumbers: [],
      previous: [],
    })
  })

  test('a per-area simulacro compares with the previous one of the same area', () => {
    expect(resolveSimulacroExam(sessions, mat2)).toEqual({
      sittings: [mat2],
      missingSessionNumbers: [],
      previous: [mat1],
    })
    expect(resolveSimulacroExam(sessions, lc1).previous).toEqual([])
  })
})

describe('buildSimulacroReport', () => {
  const score = (subjectId: string, correctCount: number, questionCount: number, answeredCount = questionCount) => ({
    subjectId,
    correctCount,
    answeredCount,
    questionCount,
  })
  const sesion1 = [
    score('lectura_critica', 30, 41),
    score('matematicas', 20, 25, 23),
    score('ciencias_naturales', 20, 29),
    score('sociales_ciudadanas', 15, 25),
  ]
  const sesion2 = [
    score('matematicas', 10, 19),
    score('ciencias_naturales', 20, 29),
    score('sociales_ciudadanas', 15, 25),
    score('ingles', 40, 55),
  ]

  test('both sittings combine into area scores, levels and the global estimate', () => {
    const report = buildSimulacroReport({
      sittings: [sesion1, sesion2],
      previousSittings: null,
      items: [],
      missingSessionNumbers: [],
    })
    const math = report.areas.find((area) => area.subjectId === 'matematicas')!
    expect(math).toMatchObject({ correctCount: 30, answeredCount: 42, questionCount: 44, score: 68 })
    expect(math.level).toEqual(getLevelForScore('matematicas', 68))
    expect(report.areas.map((area) => area.subjectId)).toEqual([
      'ciencias_naturales',
      'ingles',
      'lectura_critica',
      'matematicas',
      'sociales_ciudadanas',
    ])
    expect(report.global).toEqual(
      estimateGlobalScore(
        report.areas.map((area) => ({
          subjectId: area.subjectId,
          score: area.score,
          attemptCount: area.questionCount,
        })),
      ),
    )
    expect(report.global).not.toBeNull()
    expect(report.missingSubjectIds).toEqual([])
    expect(report.missingSessionNumbers).toEqual([])
  })

  test('only Sesión 1: no global score, and it says what is missing', () => {
    const report = buildSimulacroReport({
      sittings: [sesion1],
      previousSittings: null,
      items: [],
      missingSessionNumbers: [2],
    })
    expect(report.global).toBeNull()
    expect(report.missingSessionNumbers).toEqual([2])
    expect(report.missingSubjectIds).toEqual(['ingles'])
    expect(report.areas.map((area) => area.subjectId)).not.toContain('ingles')
  })

  test('per area: the official ICFES competencias, blanks counted as misses', () => {
    const report = buildSimulacroReport({
      sittings: [sesion1, sesion2],
      previousSittings: null,
      items: [
        item({ competencia: 'argumentacion', isCorrect: true }),
        item({ competencia: 'argumentacion', isCorrect: null }),
        item({ competencia: 'formulacion_ejecucion', isCorrect: true }),
      ],
      missingSessionNumbers: [],
    })
    expect(report.areas.find((area) => area.subjectId === 'matematicas')!.competencias).toEqual([
      { subjectId: 'matematicas', competencia: 'formulacion_ejecucion', answered: 1, correct: 1 },
      { subjectId: 'matematicas', competencia: 'argumentacion', answered: 2, correct: 1 },
    ])
  })

  test('per area: subtopics weakest first, flags, confidence and pace', () => {
    const items = [
      item({ subtopicId: 'x', isCorrect: true, confidence: 'sure', timeMs: 100_000 }),
      item({ subtopicId: 'x', isCorrect: false, confidence: 'sure', flagged: true, timeMs: 400_000 }),
      item({ subtopicId: 'y', isCorrect: null, flagged: true, timeMs: 200_000 }),
      item({ subtopicId: 'y', isCorrect: true, flagged: true, confidence: 'guess' }),
      item({ subjectId: 'ingles', subtopicId: 'z', isCorrect: false, flagged: true }),
    ]
    const report = buildSimulacroReport({
      sittings: [[score('matematicas', 2, 4, 3)], [score('ingles', 0, 1)]],
      previousSittings: null,
      items,
      missingSessionNumbers: [],
    })
    const math = report.areas.find((area) => area.subjectId === 'matematicas')!
    expect(math.subtopics).toEqual([
      { subtopicId: 'x', correctCount: 1, questionCount: 2 },
      { subtopicId: 'y', correctCount: 1, questionCount: 2 },
    ])
    expect(math.flaggedCount).toBe(3)
    // A blank is scored wrong, so a flagged blank is a flagged miss.
    expect(math.flaggedWrongCount).toBe(2)
    expect(math.confidence).toEqual(summarizeConfidence(items.slice(0, 4)))
    expect(math.pace).toMatchObject({ timedCount: 3, averageMs: 233_333, status: 'atrasado' })
    expect(report.slowestQuestions.map((entry) => entry.timeMs)).toEqual([400_000, 200_000])
  })

  test('the change against the previous comparable simulacro, per area and global', () => {
    const report = buildSimulacroReport({
      sittings: [sesion1, sesion2],
      previousSittings: [[score('matematicas', 10, 25)]],
      items: [],
      missingSessionNumbers: [],
    })
    const delta = (subjectId: string) =>
      report.areas.find((area) => area.subjectId === subjectId)!.deltaVsPrevious
    expect(delta('matematicas')).toBe(68 - 40)
    expect(delta('ingles')).toBeNull()
    expect(report.globalDeltaVsPrevious).toBeNull()

    const again = buildSimulacroReport({
      sittings: [sesion1, sesion2],
      previousSittings: [sesion1, sesion2],
      items: [],
      missingSessionNumbers: [],
    })
    expect(again.globalDeltaVsPrevious).toBe(0)
    expect(again.areas.every((area) => area.deltaVsPrevious === 0)).toBe(true)
  })
})
