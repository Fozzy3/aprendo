/**
 * Nico, the spectacled bear.
 *
 * The oso de anteojos is the only bear native to South America and lives in the
 * Colombian Andes. The pale markings around its eyes read as glasses without
 * anyone drawing glasses on an animal — a studious character that is already
 * the student's own, rather than a costume. The owl was avoided on purpose: it
 * belongs to Duolingo and is the reflex answer for every education product.
 *
 * Per the product register, delight belongs to moments, not pages. Nico shows
 * up at thresholds — an empty state, a finished session, a broken thing — and
 * stays out of the way while the student is actually working.
 *
 * Drawn on a 64×64 grid with flat shapes and no gradients so it survives being
 * rendered at 32px, and coloured from theme tokens so it works in both themes.
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
  const isAsleep = mood === 'sleeping'

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Nico, el oso de anteojos"
      className={`mascot mascot-${mood} ${className}`.trim()}
      style={{ overflow: 'visible' }}
    >
      {/* Ears — behind the head so the outline reads as one silhouette. */}
      <circle cx="16" cy="15" r="7" className="mascot-fur" />
      <circle cx="48" cy="15" r="7" className="mascot-fur" />
      <circle cx="16" cy="15" r="3.2" className="mascot-ear-inner" />
      <circle cx="48" cy="15" r="3.2" className="mascot-ear-inner" />

      {mood === 'cheering' ? (
        <>
          <rect x="4" y="22" width="7" height="16" rx="3.5" className="mascot-fur" transform="rotate(-28 7.5 30)" />
          <rect x="53" y="22" width="7" height="16" rx="3.5" className="mascot-fur" transform="rotate(28 56.5 30)" />
        </>
      ) : null}

      {/* Head */}
      <rect x="10" y="14" width="44" height="40" rx="19" className="mascot-fur" />

      {/* The spectacles: the whole reason this animal was chosen. */}
      <ellipse cx="24" cy="31" rx="9" ry="10" className="mascot-mark" />
      <ellipse cx="40" cy="31" rx="9" ry="10" className="mascot-mark" />

      {isAsleep ? (
        <>
          <path d="M19 32q5 4 10 0" className="mascot-line" />
          <path d="M35 32q5 4 10 0" className="mascot-line" />
        </>
      ) : (
        <>
          <circle cx="24" cy={mood === 'thinking' ? 30 : 31} r="3.4" className="mascot-eye" />
          <circle cx="40" cy={mood === 'thinking' ? 30 : 31} r="3.4" className="mascot-eye" />
          {/* Catchlights. Without them the eyes read as buttons, not as alive. */}
          <circle cx="25.3" cy={(mood === 'thinking' ? 30 : 31) - 1.2} r="1.15" className="mascot-glint" />
          <circle cx="41.3" cy={(mood === 'thinking' ? 30 : 31) - 1.2} r="1.15" className="mascot-glint" />
        </>
      )}

      {/* Muzzle */}
      <ellipse cx="32" cy="44" rx="11" ry="8" className="mascot-mark" />
      <ellipse cx="32" cy="40.5" rx="3.6" ry="2.8" className="mascot-nose" />

      {mood === 'happy' || mood === 'cheering' ? (
        <path d="M27 45.5q5 5 10 0" className="mascot-line" />
      ) : mood === 'thinking' ? (
        <path d="M28.5 46.5h7" className="mascot-line" />
      ) : isAsleep ? (
        <ellipse cx="32" cy="46.5" rx="2.6" ry="3.2" className="mascot-line-fill" />
      ) : (
        <path d="M28 45.5q4 3.5 8 0" className="mascot-line" />
      )}

      {isAsleep ? (
        <g className="mascot-zzz">
          <text x="52" y="14" className="mascot-z" style={{ fontSize: 9 }}>z</text>
          <text x="58" y="7" className="mascot-z" style={{ fontSize: 7 }}>z</text>
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
