/**
 * The rules of the question audit (F62-F65), kept pure so each is pinned by a
 * test. Nothing here changes a key: the worst a model can do is put a question
 * at the top of a person's queue.
 */
import type { AuditCheck } from './auditChecks'

export type Vision = {
  stemMatches: boolean
  optionsMatch: boolean
  figureNeeded: boolean
  figureLegible: boolean
  textSufficient: boolean
  modelId: string
}
export type Solver = { modelId: string; option: string; confidence: number }
export type SourceKind = 'booklet' | 'ocr' | 'authored'
export type AuditDecision = { status: 'needs_review' | 'auto_passed' | 'rejected'; exclude: boolean; keyDispute: boolean }

const visionDoubts = (vision: Vision) =>
  !vision.stemMatches || !vision.optionsMatch || (vision.figureNeeded && !vision.figureLegible)

const everyModelDisagrees = (solvers: Solver[], key: string | undefined) =>
  key != null && solvers.length >= 2 && solvers.every((solver) => solver.option !== key)

export function auditDecision(
  checks: AuditCheck[],
  vision: Vision | undefined,
  solvers: Solver[],
  context: { key: string | undefined; sourceKind: SourceKind },
): AuditDecision {
  const hardFailure = checks.some((check) => check.result === 'fail')
  const anyDisagrees = solvers.some((solver) => solver.option !== context.key)

  // An authored item is cheap to replace, so a doubt about it costs no person's time.
  if (context.sourceKind === 'authored' && (hardFailure || anyDisagrees)) {
    return { status: 'rejected', exclude: true, keyDispute: false }
  }
  if (hardFailure) return { status: 'needs_review', exclude: true, keyDispute: false }

  const needsVision = context.sourceKind !== 'authored'
  const settled =
    context.key != null
    && solvers.length >= 2
    && !anyDisagrees
    && checks.every((check) => check.result === 'pass')
    && (!needsVision || (vision != null && !visionDoubts(vision)))
  return {
    status: settled ? 'auto_passed' : 'needs_review',
    exclude: false,
    keyDispute: everyModelDisagrees(solvers, context.key),
  }
}

/** Queue order, lowest first. */
export function auditRank(row: {
  status: 'pending_checks' | 'needs_review' | 'auto_passed' | 'rejected' | 'approved' | 'fixed'
  checks: AuditCheck[]
  solvers: Solver[]
  key: string | undefined
  vision?: Vision
}): number {
  if (everyModelDisagrees(row.solvers, row.key)) return 0
  if (row.checks.some((check) => check.result === 'fail')) return 1
  if (row.solvers.some((solver) => solver.option !== row.key) || (row.vision != null && visionDoubts(row.vision))) return 2
  if (row.checks.some((check) => check.result === 'warn')) return 3
  return row.status === 'auto_passed' ? 5 : 4
}

/** FNV-1a: stable, so a seed always draws the same sample. */
function hash(text: string) {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/**
 * Which automatically passed items a person checks anyway: a share of each
 * area, never below the floor, drawn evenly across its subtopics.
 */
export function selectAuditSample(
  rows: Array<{ id: string; subjectId: string; subtopicId?: string }>,
  options: { seed: string; rate: number; floor: number },
): Set<string> {
  const chosen = new Set<string>()
  const areas = new Map<string, typeof rows>()
  for (const row of rows) areas.set(row.subjectId, [...(areas.get(row.subjectId) ?? []), row])

  for (const area of areas.values()) {
    const target = Math.min(area.length, Math.max(options.floor, Math.ceil(options.rate * area.length)))
    const bySubtopic = new Map<string, typeof rows>()
    for (const row of area) bySubtopic.set(row.subtopicId ?? '', [...(bySubtopic.get(row.subtopicId ?? '') ?? []), row])
    const queues = [...bySubtopic.values()].map((rowsOfSubtopic) =>
      rowsOfSubtopic.sort((a, b) => hash(`${options.seed}:${a.id}`) - hash(`${options.seed}:${b.id}`)),
    )
    let taken = 0
    for (let round = 0; taken < target; round += 1) {
      for (const queue of queues) {
        const row = queue[round]
        if (row == null || taken === target) continue
        chosen.add(row.id)
        taken += 1
      }
    }
  }
  return chosen
}

type HistoryEntry = { field: 'key' | 'stem' | 'options' | 'taxonomy' | 'context' | 'guide'; before?: string; after?: string; source: string; by?: string; at: number }

const PROPOSAL = 'key_proposal:'

/** The proposed key change still waiting for its second signature, if any. */
export function pendingKeyProposal<H extends HistoryEntry>(history: H[]): H | null {
  // A re-read booklet only reports what it found: it neither opens nor closes a proposal.
  const last = history.filter((entry) => entry.field === 'key' && entry.source !== 'printed_reread').at(-1)
  return last?.source.startsWith(PROPOSAL) ? last : null
}

export const keyProposalSource = (role: 'teacher' | 'admin') => `${PROPOSAL}${role}`

const KEY_TEXT = 'texto:'

/** A proposal to reword the keyed option: it changes what the key means, so it takes the same two signatures. */
export const keyTextProposal = (text: string) => `${KEY_TEXT}${text}`

/** The wording a proposal asks for, or null when it proposes another key. */
export const proposedKeyText = (after: string | undefined) => (after?.startsWith(KEY_TEXT) ? after.slice(KEY_TEXT.length) : null)

/** A changed key needs a teacher and an admin, two different people. */
export function keyChangeStep(
  history: HistoryEntry[],
  change: { key: string; by: string; role: 'teacher' | 'admin' },
): 'propose' | 'wait' | 'apply' {
  const pending = pendingKeyProposal(history)
  if (pending == null) return 'propose'
  const isProposer = pending.by === change.by
  const sameRole = pending.source === keyProposalSource(change.role)
  // A different key replaces the proposal only from whoever made it, or as the other role's signature.
  if (pending.after !== change.key) return isProposer || !sameRole ? 'propose' : 'wait'
  return isProposer || sameRole ? 'wait' : 'apply'
}

/** A row already serving students keeps its pool; anything else enters when approved. */
export function publishedEligibility(question: { eligibility?: string }): 'diagnostic' | 'practice_only' {
  return question.eligibility === 'practice_only' ? 'practice_only' : 'diagnostic'
}

export function repairedIsCorrect(selectedOption: string, key: string) {
  return selectedOption === key
}

/** Text when it stands on its own; the scan when a figure is needed and one exists. */
export function proposedStemDisplay(vision: Vision | undefined, hasCrop: boolean): 'text' | 'scan' | undefined {
  if (vision == null) return undefined
  if (vision.textSufficient && !vision.figureNeeded) return 'text'
  return hasCrop ? 'scan' : undefined
}
