type Ease = [number, number, number, number] | 'easeOut'

/** `280ms` or `0.28s` in seconds, as `motion/react` wants it; a missing token is 0 (no motion). */
function seconds(value: string) {
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return 0
  return value.trim().endsWith('ms') ? number / 1000 : number
}

function bezier(value: string): Ease {
  const numbers = value.match(/-?[\d.]+/g)?.map(Number)
  return numbers?.length === 4 ? (numbers as [number, number, number, number]) : 'easeOut'
}

/**
 * The motion tokens in `student.css`, for `motion/react`: one source for the
 * durations CSS and JS animate with.
 */
export function readMotionTokens(style: Pick<CSSStyleDeclaration, 'getPropertyValue'>) {
  return {
    quick: seconds(style.getPropertyValue('--duration-quick')),
    step: seconds(style.getPropertyValue('--duration-step')),
    spring: seconds(style.getPropertyValue('--duration-spring')),
    stagger: seconds(style.getPropertyValue('--duration-stagger')),
    ease: bezier(style.getPropertyValue('--ease-out-strong')),
  }
}

export function motionTokens() {
  return readMotionTokens(
    typeof document === 'undefined' ? { getPropertyValue: () => '' } : getComputedStyle(document.documentElement),
  )
}
