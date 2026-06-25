// Tunable scoring constants — the single place thresholds live. These are
// provisional for the Provenance tracer (issue 03) and are finalized against
// the full archetype fixture set when Security + Transparency land (issue 04).

export const SCORE_VERSION = '0.1.0'

/** A repo younger than this reads as "very new" (a low-evidence signal). */
export const VERY_NEW_DAYS = 30

/** Older than this with no push reads as "dormant" — contextual only, NEVER a
 *  caution trigger. A stable, finished utility (e.g. is-number) is quiet by
 *  design; only `archived` escalates to caution. */
export const DORMANT_DAYS = 730

/** A repo older than this counts as "established" (a provenance strength). */
export const ESTABLISHED_DAYS = 365

/** The three dimensions the finished engine evaluates. Confidence is breadth
 *  across all three; a version that wires fewer (issue 03 wires only Provenance)
 *  therefore reports lower confidence, which is correct — not a bad score. */
export const PLANNED_DIMENSION_COUNT = 3
