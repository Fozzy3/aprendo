import nationalContract from '../../../docs/national-results.v1.json'

/**
 * Where a student stands against the country.
 *
 * Same shape as `taxonomy.ts` and `levels.ts`: a declarative JSON contract plus
 * pure lookups, so the figures can be corrected without a code change.
 *
 * The contract is knowingly incomplete — see the notes in
 * `docs/national-results.v1.json`. Every function here returns null rather than
 * interpolating over a gap: a made-up national comparison would be indis-
 * tinguishable from a real one to the student reading it.
 */

export interface NationalShare {
  bandId: string
  percent: number
  year: number
  source: string
}

export interface SubjectNationalResults {
  subjectId: string
  /** True only when `shares` covers every band and sums to 100. */
  complete: boolean
  shares: NationalShare[]
}

const bySubjectId = new Map<string, SubjectNationalResults>()
for (const subject of nationalContract.subjects) {
  bySubjectId.set(subject.id, {
    subjectId: subject.id,
    complete: subject.complete,
    shares: subject.shares,
  })
}

export const NATIONAL_SOURCE = nationalContract.source

export function getSubjectNationalResults(
  subjectId: string,
): SubjectNationalResults | undefined {
  return bySubjectId.get(subjectId)
}

/**
 * The share of the country sitting at exactly this level, or null when the
 * contract does not record it.
 */
export function getNationalShare(subjectId: string, bandId: string): NationalShare | null {
  const subject = bySubjectId.get(subjectId)
  if (subject == null) return null
  return subject.shares.find((share) => share.bandId === bandId) ?? null
}

/**
 * The share of the country at or below a level — the "you are ahead of X%"
 * number.
 *
 * Requires a complete distribution: summing a partial one would understate the
 * country and flatter the student, which is precisely the failure mode that
 * makes a comparison worthless. Returns null until a subject is marked
 * `complete`.
 *
 * `orderedBandIds` must be the subject's bands from lowest to highest (as
 * `levels.ts` reports them), because the contract stores shares unordered.
 */
export function getNationalPercentileAtOrBelow(args: {
  subjectId: string
  bandId: string
  orderedBandIds: string[]
}): number | null {
  const subject = bySubjectId.get(args.subjectId)
  if (subject == null || !subject.complete) return null

  const cutoff = args.orderedBandIds.indexOf(args.bandId)
  if (cutoff === -1) return null

  let total = 0
  for (let index = 0; index <= cutoff; index += 1) {
    const bandId = args.orderedBandIds[index]
    if (bandId == null) return null
    const share = subject.shares.find((entry) => entry.bandId === bandId)
    if (share == null) return null
    total += share.percent
  }

  return Math.min(100, Math.round(total))
}
