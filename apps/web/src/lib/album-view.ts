import { MASTERY_LEVELS, type MasteryLevel } from '@aprendo/convex/mastery'
import { buildStickerAlbum } from '@aprendo/convex/rewards'

type Album = ReturnType<typeof buildStickerAlbum>
export type AlbumSubject = Album['subjects'][number]
export type AlbumSticker = AlbumSubject['stickers'][number]

const EMPTY_ALBUM = buildStickerAlbum([])
const EVERY_STICKER = EMPTY_ALBUM.subjects.flatMap((subject) => subject.stickers)

/** A subtopic's numbered slot in the album, whatever the student has earned. */
export function stickerFor(subtopicId: string | undefined): AlbumSticker | null {
  return EVERY_STICKER.find((sticker) => sticker.subtopicId === subtopicId) ?? null
}

const firstMissing = (subject: AlbumSubject) => subject.stickers.find((sticker) => !sticker.earned) ?? null

/**
 * The page Hoy opens on and the sticker it asks for: the plan's next subtopic
 * while it still misses a sticker, else the first area with a slot left. A full
 * album still shows a page, with nothing to ask for.
 */
export function hoyPage(
  album: Album,
  nextSubtopics: { subtopicId: string; subjectId: string }[],
): { subject: AlbumSubject; next: AlbumSticker | null } {
  for (const candidate of nextSubtopics) {
    const subject = album.subjects.find((item) => item.subjectId === candidate.subjectId)
    const next = subject?.stickers.find((sticker) => sticker.subtopicId === candidate.subtopicId && !sticker.earned)
    if (subject != null && next != null) return { subject, next }
  }
  const subject = album.subjects.find((item) => firstMissing(item) != null) ?? album.subjects[0]!
  return { subject, next: firstMissing(subject) }
}

const rank = (level: MasteryLevel) => MASTERY_LEVELS.indexOf(level)

/** The stickers a session's mastery changes earned: first reaching `competente`, or the shine at `dominado`. */
export function landedStickers(changes: { subtopicId: string; from: MasteryLevel; to: MasteryLevel }[]) {
  return changes.flatMap((change) => {
    const earned = rank(change.from) < rank('competente') && rank(change.to) >= rank('competente')
    const shined = change.to === 'dominado' && change.from !== 'dominado'
    const sticker = stickerFor(change.subtopicId)
    if (sticker == null || !(earned || shined)) return []
    return [{ ...sticker, earned: true, shiny: change.to === 'dominado' }]
  })
}
