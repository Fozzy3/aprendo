import { Link } from '@tanstack/react-router'
import type { AlbumSticker } from '../lib/album-view.ts'
import { Sticker } from './Sticker.tsx'

function stickerName(sticker: AlbumSticker, isNext: boolean) {
  const state = isNext ? 'te falta' : sticker.shiny ? 'brillante' : sticker.earned ? 'conseguida' : 'por conseguir'
  return `Lámina ${sticker.number}, ${sticker.label}: ${state}`
}

/** A page of the album: every slot of an area, each one a way into its lesson. */
export function StickerAlbum({ stickers, nextId }: { stickers: AlbumSticker[]; nextId: string | null }) {
  return (
    <ol className="album-grid">
      {stickers.map((sticker) => {
        const isNext = sticker.subtopicId === nextId
        return (
          <li key={sticker.subtopicId} className={isNext ? 'is-next' : undefined}>
            <Link
              to="/lesson/$subtopicId"
              params={{ subtopicId: sticker.subtopicId }}
              className="album-slot"
              aria-label={stickerName(sticker, isNext)}
            >
              <Sticker sticker={sticker} isNext={isNext} />
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
