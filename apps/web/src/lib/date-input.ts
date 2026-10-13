/**
 * `<input type="date">` values for school licenses. Colombia has no daylight
 * saving, so its day is a fixed UTC-5 and needs no time-zone library.
 */
const COLOMBIA_OFFSET_MS = 5 * 3_600_000

/** "Until 2027-06-30" means through the last second of that day in Colombia. */
export function endOfDayFromInput(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match == null) return Number.NaN
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59) + COLOMBIA_OFFSET_MS
}

/** The Colombian day a timestamp falls on, as an input value. */
export function dateInputValue(ms: number): string {
  return new Date(ms - COLOMBIA_OFFSET_MS).toISOString().slice(0, 10)
}
