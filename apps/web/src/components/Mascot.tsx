/**
 * Nico, the spectacled bear.
 *
 * The oso de anteojos is the only bear native to South America and lives in the
 * Colombian Andes. The owl was rejected on purpose: it belongs to Duolingo and
 * is the reflex answer for every education product.
 *
 * What makes a mascot stick, in the order that matters:
 *
 * 1. **An ownable colour.** Duo is memorable partly because he is one specific
 *    green. Nico was mid-brown, which is the most forgettable colour there is —
 *    and it made him read as a generic cartoon animal. He is now a deep
 *    violet-black that ties to the brand and throws the cream markings into hard
 *    contrast.
 * 2. **A silhouette.** Filled solid black he still has to be recognisable, so he
 *    has shoulders and a chest crescent rather than being a head floating in
 *    space.
 * 3. **One signature feature, unmissable.** The spectacle markings. In the first
 *    version they merged with the muzzle into a single cream mass; there is now
 *    clear fur between them, and they are drawn **asymmetric** — which is not a
 *    stylistic liberty but how the species actually works. Researchers identify
 *    individual spectacled bears by their face markings, no two alike. It makes
 *    him specific rather than generic.
 * 4. **Bear, not monkey.** Ears are smaller, set into the top corners rather
 *    than perched high and round, and the muzzle is narrower and lower.
 *
 * Flat shapes, no gradients, drawn on a 64×64 grid so it survives at 32px.
 * Coloured from theme tokens so one drawing works in both themes.
 */

export type MascotMood =
  /** Neutral. Empty states, first run. */
  | 'idle'
  /** Something went well: a finished session, a level up. */
  | 'happy'
  /** Working, loading, generating. */
  | 'thinking'
  /** A streak, a target hit. The only mood that gets arms up. */
  | 'cheering'
  /** Nothing to do here — no questions, no history yet. */
  | 'sleeping'

const SIZES = { sm: 40, md: 64, lg: 96, xl: 132 } as const

export function Mascot({
  mood = 'idle',
  size = 'md',
  className = '',
}: {
  mood?: MascotMood
  size?: keyof typeof SIZES
  className?: string
}) {
  const px = SIZES[size]
  const asleep = mood === 'sleeping'
  const cheering = mood === 'cheering'
  const thinking = mood === 'thinking'

  // Thinking tips the head; the eyes ride with it so the whole face reads as
  // considering rather than as a stare with one feature out of place.
  const eyeY = thinking ? 24 : 24.6

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Nico, el oso de anteojos"
      className={`mascot mascot-${mood} ${className}`.trim()}
      focusable="false"
      style={{ overflow: 'visible' }}
    >
      <g className="mascot-body-group">
        {/* Shoulders. Gives the silhouette something below the jaw — without
            them he is a head in mid-air. Runs past the bottom edge on purpose. */}
        {/* Wide rounded shoulders with a flat cut at y=64. Two earlier tries
            failed here: a rising arc only reached full width near the bottom
            edge and left a white wedge beside the jaw, and a plain rounded rect
            ran to y=69 — past the viewBox, which `overflow: visible` then bled
            over whatever sat below the mascot. */}
        <path
          d="M11 64V59a16 16 0 0 1 16-16h10a16 16 0 0 1 16 16v5z"
          className="mascot-fur"
        />
        {/* The chest crescent: a real marking on this species, and the one part
            of the silhouette that is not a circle. */}
        <path d="M24.5 64c0-6.5 3.4-10 7.5-10s7.5 3.5 7.5 10z" className="mascot-mark" />

      </g>

      <g className="mascot-head-group">
        {/* Ears: tucked into the top corners, smaller than the first pass. Set
            high and round they read monkey, which is exactly what happened. */}
        <circle cx="15" cy="14" r="7" className="mascot-fur" />
        <circle cx="49" cy="14" r="7" className="mascot-fur" />
        <circle cx="15" cy="14" r="3.2" className="mascot-ear-inner" />
        <circle cx="49" cy="14" r="3.2" className="mascot-ear-inner" />

        {/* Head. Slightly wider than tall, flatter across the crown than a
            circle — the bear read. */}
        <rect x="10" y="9" width="44" height="41" rx="17" className="mascot-fur" />

        {/* The spectacles. Deliberately mismatched: the left is a taller round,
            the right a smaller oval carrying a short tail down the cheek. This
            is how the species is actually marked, and it is what stops him
            looking like every other cartoon bear. */}
        <ellipse cx="22.6" cy="24.6" rx="8.8" ry="9.4" className="mascot-mark" />
        <ellipse
          cx="41.4"
          cy="25.4"
          rx="7.6"
          ry="8.4"
          className="mascot-mark"
          transform="rotate(9 41.4 25.4)"
        />

        {asleep ? (
          <>
            <path d="M18.4 26.4q4.6 4 9.2 0" className="mascot-line" />
            <path d="M36.9 26.9q4.1 3.6 8.2 0" className="mascot-line" />
          </>
        ) : (
          <>
            {/* Grouped so one keyframe blinks both eyes. A character that never
                blinks reads as a sticker. */}
            <g className="mascot-eyes">
              <circle cx="22.6" cy={eyeY} r="4.1" className="mascot-eye" />
              <circle cx="41.4" cy={eyeY + 0.8} r="3.7" className="mascot-eye" />
            </g>
            {/* Catchlights, both up-left so he looks at one thing rather than
                in two directions. Without them the eyes are buttons. */}
            <circle cx="21.1" cy={eyeY - 1.5} r="1.35" className="mascot-glint" />
            <circle cx="40" cy={eyeY - 0.7} r="1.2" className="mascot-glint" />
          </>
        )}

        {/* Muzzle. Narrow and low, with clear fur between it and the spectacles
            — in the first version the two merged into one cream blob and the
            whole point of the animal was lost. */}
        <ellipse cx="32" cy="42.8" rx="10.6" ry="7.2" className="mascot-mark" />
        <path
          d="M28.9 37.8h6.2c.7 0 1.1.7.85 1.3-.62 1.5-1.98 2.5-3.95 2.5s-3.33-1-3.95-2.5c-.25-.6.15-1.3.85-1.3z"
          className="mascot-nose"
        />

        {mood === 'happy' || cheering ? (
          <path d="M28.2 43.6q3.8 4 7.6 0" className="mascot-line" />
        ) : thinking ? (
          <path d="M29.2 44.6h5.6" className="mascot-line" />
        ) : asleep ? (
          <ellipse cx="32" cy="45.2" rx="2.3" ry="2.8" className="mascot-line-fill" />
        ) : (
          <path d="M28.8 43.4q3.2 2.9 6.4 0" className="mascot-line" />
        )}
      </g>

      {/* Arms last so they sit on top, and clear of the head's own outline —
          drawn underneath it they were painted over and never appeared. */}
      {cheering ? (
        <g className="mascot-arms">
          {/* Stroked capsules rather than filled outlines: thickness and the
              rounded ends come free, and the angle is one number to tune. The
              filled version read as small fins pinned to his ears. */}
          {/* The lower end runs into the shoulder on purpose; stopping short of
              it left a white wedge between arm and body. */}
          <path d="M17.5 57.5 6 33" className="mascot-limb" />
          <path d="M46.5 57.5 58 33" className="mascot-limb" />
        </g>
      ) : null}

      {asleep ? (
        <g className="mascot-zzz">
          <text x="51" y="12" className="mascot-z" style={{ fontSize: 10 }}>z</text>
          <text x="58" y="5" className="mascot-z" style={{ fontSize: 7.5 }}>z</text>
        </g>
      ) : null}
    </svg>
  )
}

/**
 * Nico plus a line of copy — the shape an empty state usually wants.
 *
 * Kept next to the mascot itself so every empty state in the app frames it the
 * same way instead of each screen inventing its own arrangement.
 */
export function MascotMessage({
  mood = 'idle',
  size = 'lg',
  title,
  children,
  action,
}: {
  mood?: MascotMood
  size?: keyof typeof SIZES
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mascot-message">
      <Mascot mood={mood} size={size} />
      <p className="mascot-message-title">{title}</p>
      {children ? <p className="mascot-message-copy">{children}</p> : null}
      {action ? <div className="mascot-message-action">{action}</div> : null}
    </div>
  )
}
