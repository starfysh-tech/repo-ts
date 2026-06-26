// Shared date math for the scorers. Kept in one place so age/dormancy
// (provenance) and release recency don't drift apart.
export const DAY_MS = 24 * 60 * 60 * 1000

/** Whole-and-fractional days between an `earlier` ISO timestamp and a `later` Date. */
export const daysBetween = (later: Date, earlier: string): number =>
  (later.getTime() - new Date(earlier).getTime()) / DAY_MS
