import { buildStickerAlbum } from '@aprendo/convex/rewards'
import { describe, expect, it } from 'vitest'
import { STICKER_GLYPHS } from '../components/stickerGlyphs.ts'

describe('STICKER_GLYPHS', () => {
  const stickers = buildStickerAlbum([]).subjects.flatMap((subject) => subject.stickers)

  it('draws one glyph for each of the 33 subtopics', () => {
    expect(stickers).toHaveLength(33)
    for (const { subtopicId } of stickers) expect(STICKER_GLYPHS[subtopicId], subtopicId).toBeDefined()
  })

  it('has no glyph for anything outside the taxonomy', () => {
    const ids = new Set(stickers.map((sticker) => sticker.subtopicId))
    for (const id of Object.keys(STICKER_GLYPHS)) expect(ids.has(id), id).toBe(true)
  })

  it('never reuses a drawing', () => {
    const drawings = Object.values(STICKER_GLYPHS)
    expect(new Set(drawings).size).toBe(drawings.length)
  })
})
