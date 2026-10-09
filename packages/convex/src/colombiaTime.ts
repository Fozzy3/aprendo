/**
 * Day/week bucketing in Colombia time (UTC-5, no DST). Study days and weeks roll
 * over at local midnight rather than UTC midnight. Shared by the streak ("Hoy"),
 * the weekly coach summary, and the progress trend so they all agree on what
 * "this day/week" means.
 */
export const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
// The epoch (1 Jan 1970) was a Thursday. Shifting day numbers by three puts
// the week boundary on Monday, the week a Colombian student actually lives in.
const DAYS_FROM_MONDAY_TO_EPOCH = 3

/** Integer day index in Colombia time (days since the epoch, local midnight boundaries). */
export function colombiaDayNumber(timestampMs: number): number {
  return Math.floor((timestampMs + BOGOTA_OFFSET_MS) / DAY_MS)
}

/** Integer week index in Colombia time: weeks run Monday 00:00 to Sunday 23:59. */
export function colombiaWeekIndex(timestampMs: number): number {
  return Math.floor((colombiaDayNumber(timestampMs) + DAYS_FROM_MONDAY_TO_EPOCH) / 7)
}

/** The UTC timestamp at which a given Colombia day index starts (for labeling). */
export function colombiaDayStartMs(dayNumber: number): number {
  return dayNumber * DAY_MS - BOGOTA_OFFSET_MS
}

/** The UTC timestamp of the Monday a given Colombia week index starts on (for labeling). */
export function colombiaWeekStartMs(weekIndex: number): number {
  return colombiaDayStartMs(weekIndex * 7 - DAYS_FROM_MONDAY_TO_EPOCH)
}
