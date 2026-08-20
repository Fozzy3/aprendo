interface BrandMarkProps {
  size?: number
  strokeWidth?: number
  className?: string
}

/**
 * The Aprendo logo mark.
 *
 * This path data used to be copy-pasted into five files (index, login, admin,
 * diagnostic and the student shell), so any change to the mark had to be made
 * five times. Callers keep their own container/ring; this renders only the SVG.
 */
export default function BrandMark({
  size = 16,
  strokeWidth = 2.5,
  className,
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--brand)"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  )
}
