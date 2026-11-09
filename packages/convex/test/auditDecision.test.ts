import { describe, expect, test } from 'bun:test'
import {
  auditDecision,
  auditRank,
  keyChangeStep,
  pendingKeyProposal,
  proposedStemDisplay,
  publishedEligibility,
  repairedIsCorrect,
  selectAuditSample,
} from '../src/auditDecision'

const pass = [{ id: 'key_present', result: 'pass' as const }]
const warn = [{ id: 'katex', result: 'warn' as const }]
const fail = [{ id: 'options_filled', result: 'fail' as const }]
const goodVision = { stemMatches: true, optionsMatch: true, figureNeeded: false, figureLegible: true, textSufficient: true, modelId: 'v' }
const solver = (option: string, modelId = 'm') => ({ modelId, option, confidence: 0.9 })
const agreeing = [solver('C', 'a'), solver('C', 'b')]
const booklet = { key: 'C', sourceKind: 'booklet' as const }
const authored = { key: 'C', sourceKind: 'authored' as const }

describe('auditDecision', () => {
  test('everything clean passes on its own', () => {
    expect(auditDecision(pass, goodVision, agreeing, booklet)).toEqual({ status: 'auto_passed', exclude: false, keyDispute: false })
  })

  test('a hard failure leaves the pool at once and waits for a person', () => {
    expect(auditDecision(fail, goodVision, agreeing, booklet)).toEqual({ status: 'needs_review', exclude: true, keyDispute: false })
  })

  test('both models against the printed key: first in the queue, the key untouched', () => {
    const decision = auditDecision(pass, goodVision, [solver('A', 'a'), solver('B', 'b')], booklet)
    expect(decision).toEqual({ status: 'needs_review', exclude: false, keyDispute: true })
  })

  test('one model against the key goes to a person without being a dispute', () => {
    const decision = auditDecision(pass, goodVision, [solver('C', 'a'), solver('A', 'b')], booklet)
    expect(decision).toEqual({ status: 'needs_review', exclude: false, keyDispute: false })
  })

  test('a warning, or a vision mismatch, goes to a person', () => {
    expect(auditDecision(warn, goodVision, agreeing, booklet).status).toBe('needs_review')
    expect(auditDecision(pass, { ...goodVision, stemMatches: false }, agreeing, booklet).status).toBe('needs_review')
    expect(auditDecision(pass, { ...goodVision, optionsMatch: false }, agreeing, booklet).status).toBe('needs_review')
    expect(auditDecision(pass, { ...goodVision, figureNeeded: true, figureLegible: false }, agreeing, booklet).status).toBe('needs_review')
  })

  test('without vision or two solvers nothing passes alone', () => {
    expect(auditDecision(pass, undefined, agreeing, booklet).status).toBe('needs_review')
    expect(auditDecision(pass, goodVision, [solver('C')], booklet).status).toBe('needs_review')
    expect(auditDecision(pass, goodVision, [], booklet).status).toBe('needs_review')
  })

  test('an authored item needs no vision, there is no source to compare', () => {
    expect(auditDecision(pass, undefined, agreeing, authored).status).toBe('auto_passed')
  })

  test('an authored item a model disagrees with is rejected', () => {
    expect(auditDecision(pass, undefined, [solver('C', 'a'), solver('A', 'b')], authored)).toEqual({ status: 'rejected', exclude: true, keyDispute: false })
  })

  test('an authored item with a hard failure is rejected', () => {
    expect(auditDecision(fail, undefined, agreeing, authored).status).toBe('rejected')
  })

  test('a question with no key can never pass', () => {
    expect(auditDecision(pass, goodVision, agreeing, { key: undefined, sourceKind: 'booklet' }).status).toBe('needs_review')
  })
})

describe('auditRank', () => {
  const row = (overrides: object) => ({ status: 'needs_review' as const, checks: pass, solvers: agreeing, key: 'C', ...overrides })

  test('the key dispute comes first of all', () => {
    const dispute = auditRank(row({ solvers: [solver('A', 'a'), solver('B', 'b')] }))
    expect(dispute).toBeLessThan(auditRank(row({ checks: fail })))
  })

  test('hard failures, then doubts, then the rest', () => {
    const hard = auditRank(row({ checks: fail }))
    const doubt = auditRank(row({ solvers: [solver('C', 'a'), solver('A', 'b')] }))
    const warned = auditRank(row({ checks: warn }))
    const clean = auditRank(row({}))
    expect(hard).toBeLessThan(doubt)
    expect(doubt).toBeLessThan(warned)
    expect(warned).toBeLessThan(clean)
  })

  test('a two-model dispute needs two different solvers', () => {
    expect(auditRank(row({ solvers: [solver('A', 'a')] }))).toBeGreaterThan(auditRank(row({ solvers: [solver('A', 'a'), solver('B', 'b')] })))
  })

  test('a sample of the passed items comes after everything that needs a decision', () => {
    expect(auditRank(row({ status: 'auto_passed' }))).toBeGreaterThan(auditRank(row({ checks: warn })))
  })
})

describe('selectAuditSample', () => {
  const rows = (subjectId: string, count: number, subtopics = 3) =>
    Array.from({ length: count }, (_, index) => ({ id: `${subjectId}-${index}`, subjectId, subtopicId: `t${index % subtopics}` }))

  test('an area below the floor is reviewed whole', () => {
    const sample = selectAuditSample(rows('mat', 59), { seed: 's', rate: 0.1, floor: 60 })
    expect(sample.size).toBe(59)
  })

  test('takes at least the floor per area', () => {
    const sample = selectAuditSample([...rows('mat', 300), ...rows('ing', 200)], { seed: 's', rate: 0.1, floor: 60 })
    expect([...sample].filter((id) => id.startsWith('mat')).length).toBe(60)
    expect([...sample].filter((id) => id.startsWith('ing')).length).toBe(60)
  })

  test('takes the rate when it is above the floor', () => {
    const sample = selectAuditSample(rows('mat', 1000), { seed: 's', rate: 0.1, floor: 60 })
    expect(sample.size).toBe(100)
  })

  test('the same seed draws the same sample, another seed another', () => {
    const data = rows('mat', 500)
    const first = [...selectAuditSample(data, { seed: 'a', rate: 0.1, floor: 60 })].sort()
    expect([...selectAuditSample(data, { seed: 'a', rate: 0.1, floor: 60 })].sort()).toEqual(first)
    expect([...selectAuditSample(data, { seed: 'b', rate: 0.1, floor: 60 })].sort()).not.toEqual(first)
  })

  test('is stratified: every subtopic of the area is represented', () => {
    const data = rows('mat', 600, 6)
    const sample = selectAuditSample(data, { seed: 's', rate: 0.1, floor: 60 })
    const seen = new Set(data.filter((row) => sample.has(row.id)).map((row) => row.subtopicId))
    expect(seen.size).toBe(6)
  })

  test('rate 1 is the whole bank: the current one is reviewed entirely', () => {
    expect(selectAuditSample(rows('mat', 300), { seed: 's', rate: 1, floor: 60 }).size).toBe(300)
  })
})

describe('key change needs a teacher and an admin', () => {
  const entry = (source: string, after: string, by = 'teacher-1') => ({ field: 'key' as const, before: 'C', after, source, by, at: 1 })

  test('the first person only proposes', () => {
    expect(keyChangeStep([], { key: 'A', by: 'teacher-1', role: 'teacher' })).toBe('propose')
  })

  test('the other role confirms it', () => {
    expect(keyChangeStep([entry('key_proposal:teacher', 'A')], { key: 'A', by: 'admin-1', role: 'admin' })).toBe('apply')
    expect(keyChangeStep([entry('key_proposal:admin', 'A', 'admin-1')], { key: 'A', by: 'teacher-1', role: 'teacher' })).toBe('apply')
  })

  test('the same person cannot confirm their own proposal', () => {
    expect(keyChangeStep([entry('key_proposal:teacher', 'A')], { key: 'A', by: 'teacher-1', role: 'teacher' })).toBe('wait')
  })

  test('two teachers are not a teacher and an admin', () => {
    expect(keyChangeStep([entry('key_proposal:teacher', 'A')], { key: 'A', by: 'teacher-2', role: 'teacher' })).toBe('wait')
  })

  test('a different key starts over', () => {
    expect(keyChangeStep([entry('key_proposal:teacher', 'A')], { key: 'B', by: 'admin-1', role: 'admin' })).toBe('propose')
  })

  test('a colleague of the same role cannot replace it', () => {
    expect(keyChangeStep([entry('key_proposal:teacher', 'A')], { key: 'B', by: 'teacher-2', role: 'teacher' })).toBe('wait')
  })

  test('its proposer may replace it', () => {
    expect(keyChangeStep([entry('key_proposal:teacher', 'A')], { key: 'B', by: 'teacher-1', role: 'teacher' })).toBe('propose')
  })

  test('an applied change closes the proposal', () => {
    const history = [entry('key_proposal:teacher', 'A'), { field: 'key' as const, before: 'C', after: 'A', source: 'key_applied', at: 2 }]
    expect(pendingKeyProposal(history)).toBeNull()
    expect(keyChangeStep(history, { key: 'A', by: 'admin-1', role: 'admin' })).toBe('propose')
  })

  test('a booklet reload neither hides a proposal nor counts as one', () => {
    const proposal = entry('key_proposal:teacher', 'A')
    const reread = { field: 'key' as const, before: 'C', after: 'B', source: 'printed_reread', at: 2 }
    expect(pendingKeyProposal([proposal, reread])).toBe(proposal)
    expect(pendingKeyProposal([reread])).toBeNull()
    expect(keyChangeStep([proposal, reread], { key: 'A', by: 'admin-1', role: 'admin' })).toBe('apply')
  })

  test('other fields do not interrupt a proposal', () => {
    const history = [entry('key_proposal:teacher', 'A'), { field: 'stem' as const, source: 'review', at: 2 }]
    expect(pendingKeyProposal(history)?.after).toBe('A')
  })
})

describe('publishing', () => {
  test('a row already in a pool keeps its pool', () => {
    expect(publishedEligibility({ eligibility: 'practice_only' })).toBe('practice_only')
    expect(publishedEligibility({ eligibility: 'diagnostic' })).toBe('diagnostic')
  })

  test('pending or excluded rows become eligible when approved', () => {
    expect(publishedEligibility({ eligibility: 'pending' })).toBe('diagnostic')
    expect(publishedEligibility({ eligibility: 'excluded' })).toBe('diagnostic')
    expect(publishedEligibility({})).toBe('diagnostic')
  })

  test('a repaired attempt keeps what the student picked and follows the new key', () => {
    expect(repairedIsCorrect('B', 'B')).toBe(true)
    expect(repairedIsCorrect('A', 'B')).toBe(false)
  })

  test('the text is shown when vision says it stands on its own', () => {
    expect(proposedStemDisplay({ ...goodVision }, true)).toBe('text')
  })

  test('a needed figure keeps the scan, if there is one', () => {
    expect(proposedStemDisplay({ ...goodVision, figureNeeded: true }, true)).toBe('scan')
    expect(proposedStemDisplay({ ...goodVision, textSufficient: false }, true)).toBe('scan')
    expect(proposedStemDisplay({ ...goodVision, textSufficient: false }, false)).toBeUndefined()
  })

  test('without vision nothing is proposed', () => {
    expect(proposedStemDisplay(undefined, true)).toBeUndefined()
  })
})
