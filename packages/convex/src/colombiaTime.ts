/**
 * Day/week bucketing in Colombia time (UTC-5, no DST). Study days and weeks roll
 * over at local midnight rather than UTC midnight. Shared by the streak ("Hoy"),
 * the weekly coach summary, and the progress trend so they all agree on what
 * "this day/week" means.
 */
export const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/** Integer day index in Colombia time (days since the epoch, local midnight boundaries). */
export function colombiaDayNumber(timestampMs: number): number {
  return Math.floor((timestampMs + BOGOTA_OFFSET_MS) / DAY_MS)
}

/** Integer week index in Colombia time (7-day buckets aligned to the epoch). */
export function colombiaWeekIndex(timestampMs: number): number {
  return Math.floor((timestampMs + BOGOTA_OFFSET_MS) / WEEK_MS)
}

/** The UTC timestamp at which a given Colombia day index starts (for labeling). */
export function colombiaDayStartMs(dayNumber: number): number {
  return dayNumber * DAY_MS - BOGOTA_OFFSET_MS
}

/** The UTC timestamp at which a given Colombia week index starts (for labeling). */
export function colombiaWeekStartMs(weekIndex: number): number {
  return weekIndex * WEEK_MS - BOGOTA_OFFSET_MS
}
