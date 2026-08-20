/**
 * Circular mastery ring shared by the Progress and Syllabus surfaces. Draws a
 * track plus a foreground arc whose length encodes `value` (0–1). Wrap it in a
 * relatively-positioned element to overlay a centered percentage label.
 */
export function RingProgress({
  value,
  size = 48,
  strokeWidth = 6,
  color,
}: {
  value: number
  size?: number
  strokeWidth?: number
  color: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - value * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="progress-ring"
      />
    </svg>
  )
}
