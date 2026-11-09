import { Sparkles } from 'lucide-react'
import type { AlbumSticker } from '../lib/album-view.ts'
import { STICKER_GLYPHS } from './stickerGlyphs.ts'

export function StickerGlyph({ subtopicId }: { subtopicId: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="sticker-glyph"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={STICKER_GLYPHS[subtopicId]} />
    </svg>
  )
}

/**
 * One numbered slot of the album. Empty until earned, but the next one to earn
 * already shows its picture, lifted and tilted. Its colour comes from the number
 * so a page reads like a page of stickers rather than a chart.
 */
export function Sticker({ sticker, isNext = false }: { sticker: AlbumSticker; isNext?: boolean }) {
  const state = isNext ? 'is-next' : sticker.shiny ? 'is-shiny' : sticker.earned ? 'is-earned' : 'is-empty'
  return (
    <span className={`sticker ${state} tone-${sticker.number % 4}`}>
      <span className="sticker-number">{sticker.number}</span>
      {sticker.earned || isNext ? <StickerGlyph subtopicId={sticker.subtopicId} /> : null}
      {sticker.shiny ? <Sparkles size={15} strokeWidth={2.4} className="sticker-spark" aria-hidden /> : null}
    </span>
  )
}
