/**
 * Assembles one area of a simulacro form.
 *
 * Taking the first N of the bank gave every student the same form, made Sesión 2
 * repeat Sesión 1 and made every retake identical — answers the student had
 * already read in the review. Instead: questions the student has never been
 * shown come first, then the least recently shown; ties are broken by a seeded
 * hash so two students (or two attempts) get different forms, yet the same seed
 * always rebuilds the same one.
 *
 * Shared-stimulus groups move as one unit, with the semantics of
 * `questionPool.expandToGroups`: whole or not at all, and a group that does not
 * fit the remaining slots is skipped rather than split. Pure, so it is testable
 * without Convex.
 */

export type FormQuestion = { _id: string; groupId?: string; groupPosition?: number }

type Unit<Q> = { key: string; members: Q[]; firstIndex: number }

/** FNV-1a: a cheap, stable string hash — enough to shuffle, not to secure. */
function hash(text: string) {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

export function pickSimulacroForm<Q extends FormQuestion>(args: {
  /** Launchable questions for one area, in booklet order. */
  questions: Q[]
  /** Questions wanted — members, not groups. */
  limit: number
  /** studentId + attempt number. */
  seed: string
  /** Question id → when the student was last shown it. Absent = never. */
  lastSeenAt: ReadonlyMap<string, number>
  /** Items that must not appear, e.g. Sesión 1's when building Sesión 2. */
  exclude: ReadonlySet<string>
}): Q[] {
  const units = new Map<string, Unit<Q>>()
  args.questions.forEach((question, index) => {
    const key = question.groupId ?? question._id
    const unit = units.get(key) ?? { key, members: [], firstIndex: index }
    unit.members.push(question)
    units.set(key, unit)
  })

  // Never shown reads as shown at time zero: older than any real sighting.
  const lastSeen = (unit: Unit<Q>) =>
    Math.max(...unit.members.map((member) => args.lastSeenAt.get(member._id) ?? 0))

  const ranked = [...units.values()]
    // Half a text is worse than none: one excluded member takes its group out.
    .filter((unit) => unit.members.every((member) => !args.exclude.has(member._id)))
    .map((unit) => ({ unit, seenAt: lastSeen(unit), tieBreak: hash(`${args.seed}:${unit.key}`) }))
    .sort((a, b) => a.seenAt - b.seenAt || a.tieBreak - b.tieBreak)

  const picked: Unit<Q>[] = []
  let count = 0
  for (const { unit } of ranked) {
    if (count >= args.limit) break
    if (count + unit.members.length > args.limit) continue
    picked.push(unit)
    count += unit.members.length
  }

  // Presented in booklet order, members adjacent — pick order would put every
  // repeat at the end of the area.
  return picked
    .sort((a, b) => a.firstIndex - b.firstIndex)
    .flatMap((unit) =>
      [...unit.members].sort((a, b) => (a.groupPosition ?? 0) - (b.groupPosition ?? 0)),
    )
}

type SubjectScore = {
  subjectId: string
  correctCount: number
  answeredCount: number
  questionCount: number
}

/**
 * Whole-exam score per area, summed over the sittings' summaries. Out of what
 * was actually served: Sesión 2 cannot reuse Sesión 1's items, so on a small
 * bank an area comes out short, and scoring against the official count would
 * mark every question never shown as wrong. An area never served falls back to
 * the official count.
 */
export function scoreSimulacroSubjects(
  targets: { subjectId: string; questionCount: number }[],
  sittings: SubjectScore[][],
): (SubjectScore & { score: number })[] {
  return targets.map((target) => {
    const scores = sittings.flat().filter((score) => score.subjectId === target.subjectId)
    const sum = (key: 'correctCount' | 'answeredCount' | 'questionCount') =>
      scores.reduce((total, score) => total + score[key], 0)
    const served = sum('questionCount')
    const questionCount = served > 0 ? served : target.questionCount
    const correctCount = sum('correctCount')
    return {
      subjectId: target.subjectId,
      correctCount,
      answeredCount: sum('answeredCount'),
      questionCount,
      score: Math.round((correctCount / questionCount) * 100),
    }
  })
}
