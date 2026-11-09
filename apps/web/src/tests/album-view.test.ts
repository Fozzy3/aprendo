import { buildStickerAlbum } from '@aprendo/convex/rewards'
import { describe, expect, it } from 'vitest'
import { hoyPage, landedStickers, stickerFor } from '../lib/album-view.ts'

const matematicas = 'matematicas.number_proportionality.ratios_proportions_percent'
const geometria = 'matematicas.geometry_measurement.plane_geometry'
const lectura = 'lectura_critica.literal_comprehension.word_phrase_meaning'

describe('stickerFor', () => {
  it('numbers a subtopic as the album does', () => {
    const album = buildStickerAlbum([])
    const expected = album.subjects.flatMap((subject) => subject.stickers).find((item) => item.subtopicId === geometria)
    expect(stickerFor(geometria)?.number).toBe(expected?.number)
  })

  it('has no sticker for an unknown subtopic', () => {
    expect(stickerFor('nope')).toBeNull()
  })
})

describe('hoyPage', () => {
  it('opens on the area of the next subtopic the plan picks', () => {
    const page = hoyPage(buildStickerAlbum([]), [{ subtopicId: geometria, subjectId: 'matematicas' }])
    expect(page.subject.subjectId).toBe('matematicas')
    expect(page.next?.subtopicId).toBe(geometria)
  })

  it('falls back to the first area with a slot left, and its first missing sticker', () => {
    const album = buildStickerAlbum([{ subtopicId: lectura, masteryLevel: 'competente' }])
    const page = hoyPage(album, [])
    expect(page.subject.subjectId).toBe('lectura_critica')
    expect(page.next?.subtopicId).not.toBe(lectura)
  })

  it('skips an already earned sticker the plan still names', () => {
    const album = buildStickerAlbum([{ subtopicId: matematicas, masteryLevel: 'competente' }])
    const page = hoyPage(album, [{ subtopicId: matematicas, subjectId: 'matematicas' }])
    expect(page.next?.subtopicId).not.toBe(matematicas)
  })

  it('leaves a full area for one with slots left', () => {
    const everyReading = buildStickerAlbum([]).subjects
      .find((subject) => subject.subjectId === 'lectura_critica')!.stickers
      .map((item) => ({ subtopicId: item.subtopicId, masteryLevel: 'dominado' as const }))
    const page = hoyPage(buildStickerAlbum(everyReading), [])
    expect(page.subject.subjectId).not.toBe('lectura_critica')
    expect(page.next).not.toBeNull()
  })

  it('still shows a page when the whole album is full', () => {
    const everything = buildStickerAlbum([]).subjects.flatMap((subject) => subject.stickers)
      .map((item) => ({ subtopicId: item.subtopicId, masteryLevel: 'dominado' as const }))
    const page = hoyPage(buildStickerAlbum(everything), [])
    expect(page.next).toBeNull()
  })
})

describe('landedStickers', () => {
  it('lands a sticker when a subtopic reaches competente', () => {
    const landed = landedStickers([{ subtopicId: matematicas, from: 'familiar', to: 'competente' }])
    expect(landed).toHaveLength(1)
    expect(landed[0]).toMatchObject({ subtopicId: matematicas, shiny: false })
  })

  it('lands the shiny version at dominado', () => {
    expect(landedStickers([{ subtopicId: matematicas, from: 'competente', to: 'dominado' }])[0]?.shiny).toBe(true)
  })

  it('ignores a move inside the same earned state and any drop', () => {
    expect(landedStickers([
      { subtopicId: matematicas, from: 'intentado', to: 'familiar' },
      { subtopicId: geometria, from: 'dominado', to: 'competente' },
      { subtopicId: lectura, from: 'competente', to: 'competente' },
    ])).toEqual([])
  })
})
