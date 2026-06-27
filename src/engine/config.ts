// Tunable scoring constants — the single place dimension thresholds live,
// finalized against the committed per-archetype fixtures (`__fixtures__/`).

export const SCORE_VERSION = '0.5.0'

/** A repo younger than this reads as "very new" (a low-evidence signal). */
export const VERY_NEW_DAYS = 30

/** Older than this with no push reads as "dormant" — contextual only, NEVER a
 *  caution trigger. A stable, finished utility (e.g. is-number) is quiet by
 *  design; only `archived` escalates to caution. */
export const DORMANT_DAYS = 730

/** A repo older than this counts as "established" (a provenance strength). */
export const ESTABLISHED_DAYS = 365

/** Latest published release within this many days reads as active release discipline. */
export const RELEASE_RECENT_DAYS = 365

/** Governance: this many distinct human contributors (with no single one dominating)
 *  reads as distributed maintenance. */
export const GOV_DISTRIBUTED_MIN = 5
/** A top contributor at/above this share of observed commits reads as bus-factor-1. */
export const GOV_DOMINANT_SHARE = 0.85

/** A closed issue or PR within this many days counts as recent maintainer activity. */
export const RESPONSIVE_RECENT_DAYS = 90
/** This many recent closes (issues + PRs) reads as active triage. */
export const RESPONSIVE_ACTIVE_MIN = 5

/** Confidence is breadth of evidence across dimensions: this many evidenced
 *  dimensions (of the 4) reads high; one fewer reads medium; ≤1 reads low.
 *  Deliberately NOT the dimension count — release is additive, so a quiet repo
 *  without releases keeps its tier instead of being demoted. */
export const HIGH_CONFIDENCE_THRESHOLD = 3

/** Cache TTL and the threshold past which a result reads as "stale". Within this
 *  window a revisit serves the cached analysis with zero API calls. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000
