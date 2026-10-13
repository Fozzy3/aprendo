interface BrandMarkProps {
  size?: number
  className?: string
}

/**
 * The Aprendo mark: one 5 mm cell of the squared notebook with its red margin
 * rule. Callers keep their own layout; this renders only the SVG.
 */
export function BrandMark({ size = 18, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="18" height="18" stroke="var(--ink)" strokeWidth="1.5" />
      <path d="M1 7h18M1 13h18M13 1v18" stroke="var(--rule-strong)" strokeWidth="1" />
      <path d="M7 1v18" stroke="var(--margin)" strokeWidth="1.5" />
    </svg>
  )
}

/** The mark with the name, set in the heading face. */
export function Wordmark({ subtitle }: { subtitle?: string }) {
  return (
    <span className="wordmark">
      <BrandMark />
      <span className="wordmark-name">Aprendo</span>
      {subtitle ? <span className="wordmark-subtitle">{subtitle}</span> : null}
    </span>
  )
}
