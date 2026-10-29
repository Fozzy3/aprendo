import { describe, expect, test } from 'bun:test'
import { belowFamiliar, classItemAnalysis, classTeachingPlan, type SubtopicEvidence } from '../src/teacher'

describe('classItemAnalysis', () => {
  const answer = (questionId: string, selectedOption: string, isCorrect: boolean) => ({ questionId, selectedOption, isCorrect })

  test('the questions the class misses most, with the wrong option that pulled them', () => {
    const rows = classItemAnalysis([
      answer('q1', 'A', false), answer('q1', 'A', false), answer('q1', 'B', false), answer('q1', 'C', true),
      answer('q2', 'C', true), answer('q2', 'C', true), answer('q2', 'D', false),
      answer('q3', 'A', false), answer('q3', 'A', false),
    ])
    // q3 has 2 answers: too few to say anything about it.
    expect(rows.map((row) => row.questionId)).toEqual(['q1', 'q2'])
    expect(rows[0]).toMatchObject({ answered: 4, wrong: 3, topWrongOption: 'A', topWrongCount: 2 })
  })
})

/** `below` students under Familiar and `above` at or past it, all with evidence. */
function subtopic(subtopicId: string, subjectId: string, below: number, above: number, misconceptions = 0): SubtopicEvidence {
  const students = [
    ...Array.from({ length: below }, (_, index) => ({ studentId: `${subtopicId}-b${index}`, attemptCount: 4, masteryLevel: 'intentado' as const })),
    ...Array.from({ length: above }, (_, index) => ({ studentId: `${subtopicId}-a${index}`, attemptCount: 4, masteryLevel: 'competente' as const })),
  ]
  return { subtopicId, subjectId, students, confidentWrong: misconceptions, declared: misconceptions > 0 ? 10 : 0 }
}

describe('classTeachingPlan', () => {
  test('40 % or more below Familiar goes to the whole class; 15-40 % to a small group; less, to nobody', () => {
    const plan = classTeachingPlan({
      subtopics: [
        subtopic('mat.prop', 'matematicas', 5, 5),
        subtopic('mat.func', 'matematicas', 2, 8),
        subtopic('mat.geo', 'matematicas', 1, 9),
      ],
      students: [],
    })
    expect(plan.wholeClass.map((item) => item.subtopicId)).toEqual(['mat.prop'])
    expect(plan.groups.map((group) => group.subtopicId)).toEqual(['mat.func'])
    expect(plan.groups[0]!.studentIds).toHaveLength(2)
  })

  test('says nothing about a subtopic with fewer than 5 students with evidence', () => {
    const thin = subtopic('lc.inf', 'lectura_critica', 3, 1)
    thin.students.push({ studentId: 'x', attemptCount: 1, masteryLevel: 'intentado' })
    expect(classTeachingPlan({ subtopics: [thin], students: [] }).wholeClass).toEqual([])
  })

  test('keeps at most 2 subtopics for the whole class, ranked by ICFES weight, share below and confident errors', () => {
    const plan = classTeachingPlan({
      subtopics: [
        subtopic('ing.vocab', 'ingles', 9, 1),
        subtopic('mat.prop', 'matematicas', 5, 5),
        subtopic('cn.cel', 'ciencias_naturales', 5, 5, 5),
        subtopic('soc.const', 'sociales_ciudadanas', 6, 4),
      ],
      students: [],
    })
    // Ciencias: weight 3 × 0.5 × 1.5; Sociales 3 × 0.6; Matemáticas 3 × 0.5; Inglés 1 × 0.9.
    expect(plan.wholeClass.map((item) => item.subtopicId)).toEqual(['cn.cel', 'soc.const'])
    expect(plan.wholeClass[0]).toMatchObject({ belowCount: 5, evidencedCount: 10, misconceptionShare: 0.5 })
  })

  test('splits a group need into groups of at most 6', () => {
    const plan = classTeachingPlan({ subtopics: [subtopic('mat.func', 'matematicas', 9, 21)], students: [] })
    expect(plan.groups.map((group) => group.studentIds.length)).toEqual([5, 4])
  })

  test('one-to-one: every student with a risk reason, most reasons first', () => {
    const plan = classTeachingPlan({
      subtopics: [],
      students: [
        { studentId: 'a', riskReasons: ['inactivo'] },
        { studentId: 'b', riskReasons: [] },
        { studentId: 'c', riskReasons: ['sin_nivelacion', 'inactivo'] },
      ],
    })
    expect(plan.individual.map((item) => item.studentId)).toEqual(['c', 'a'])
  })
})

describe('belowFamiliar — the cycle’s before and after', () => {
  test('counts only students with evidence, so a cycle compares like with like', () => {
    const evidence = subtopic('mat.prop', 'matematicas', 6, 4)
    evidence.students.push({ studentId: 'new', attemptCount: 1, masteryLevel: 'sin_empezar' })
    expect(belowFamiliar(evidence)).toEqual({ belowCount: 6, evidencedCount: 10 })
  })
})
