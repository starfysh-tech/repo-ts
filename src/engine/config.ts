// Tunable scoring constants — the single place dimension thresholds and policy
// decisions live, finalized against the committed per-archetype fixtures
// (`__fixtures__/`). The engine reads a `ScoringConfig` object (injected at the
// `analyzeRepo` seam) rather than these literals directly, so the values are
// user-configurable (presets + advanced overrides) without touching the scorers.

import type { DimensionKey } from './types'

/** Bumps on a shape/logic change to the analysis (invalidates every cached
 *  entry). Distinct from user value changes, which the config hash handles. */
export const SCORE_VERSION = '0.7.0'

/** Cache TTL and the threshold past which a result reads as "stale". Within this
 *  window a revisit serves the cached analysis with zero API calls. Not yet part
 *  of `ScoringConfig` — it is consumed outside the engine (cache + recency), so
 *  its knob lands with the settings UI, not this seam. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Manufactured-credibility guard sensitivity: how many of the three maturity
 *  dimensions (release + governance + responsiveness) must be strong on a
 *  very-new repo before the guard fires. `off` disables it. */
export type GuardSensitivity = 'off' | 'any-2-of-3' | 'all-3'

/** Guard flag severity. `caution` is the strongest: it overrides the
 *  archived-only caution rule, so it carries the loudest warning in the UI. */
export type GuardSeverity = 'note' | 'medium' | 'caution'

/**
 * Every value the scoring engine consumes. `DEFAULT_SCORING_CONFIG` reproduces
 * the original hardcoded behavior exactly (the committed fixtures are the
 * regression bar). Advanced edits may deviate from these — that is the user's
 * explicit, warned choice (see PRD-user-config).
 */
export interface ScoringConfig {
  // ── Numeric thresholds ─────────────────────────────────────────────────────
  /** A repo younger than this reads as "very new" (a low-evidence signal). */
  veryNewDays: number
  /** Older than this with no push reads as "dormant" — contextual only, NEVER a
   *  caution trigger (only `archived` escalates to caution). */
  dormantDays: number
  /** A repo older than this counts as "established" (a provenance strength). */
  establishedDays: number
  /** Latest published release within this many days reads as active release discipline. */
  releaseRecentDays: number
  /** This many distinct human contributors (no single one dominating) reads as
   *  distributed maintenance. */
  govDistributedMin: number
  /** A top contributor at/above this share of observed commits reads as bus-factor-1. */
  govDominantShare: number
  /** A closed issue or PR within this many days counts as recent maintainer activity. */
  responsiveRecentDays: number
  /** This many recent closes (issues + PRs) reads as active triage. */
  responsiveActiveMin: number
  /** Confidence is breadth of evidence: this many evidenced dimensions reads high;
   *  one fewer reads medium; ≤1 reads low. */
  highConfidenceThreshold: number

  // ── Policy decisions (warned in the UI when they weaken conservatism) ───────
  /** STRONG additionally requires provenance itself to be strong. Off lets a repo
   *  read STRONG on activity alone — a weakening of the conservative guarantee. */
  provenanceGate: boolean
  /** Cross-dimension manufactured-credibility guard. */
  manufacturedGuard: { sensitivity: GuardSensitivity; severity: GuardSeverity }
  /** Which dimensions lift-but-never-demote the verdict (excluded from the
   *  trust-majority denominator). The rest are core. */
  additiveDimensions: DimensionKey[]
}

/** The six dimension keys as a runtime list (the type is compile-time only).
 *  Used to validate a user-supplied `additiveDimensions` override. */
export const DIMENSION_KEYS: DimensionKey[] = [
  'provenance',
  'security',
  'transparency',
  'release',
  'governance',
  'responsiveness',
]

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  veryNewDays: 30,
  dormantDays: 730,
  establishedDays: 365,
  releaseRecentDays: 365,
  govDistributedMin: 5,
  govDominantShare: 0.85,
  responsiveRecentDays: 90,
  responsiveActiveMin: 5,
  highConfidenceThreshold: 3,
  provenanceGate: true,
  manufacturedGuard: { sensitivity: 'all-3', severity: 'medium' },
  additiveDimensions: ['release', 'responsiveness'],
}

/** The named, audience-friendly stances. `balanced` is the default behavior;
 *  `cautious` raises the bars to read STRONG (so more repos read mixed at the
 *  margins); `minimal` is a lighter-touch read for casual browsing. */
export type ScoringPreset = 'balanced' | 'cautious' | 'minimal'

/**
 * Preset → full `ScoringConfig`. These are the proposed baselines, validated
 * against the committed fixtures (the `is-number`-never-`caution` guardrail holds
 * under every preset — none touches the archived flag or sets guard severity to
 * `caution`, the only two caution triggers). A user's advanced overrides (slice C)
 * merge on top of the chosen preset.
 *
 * - `cautious`: harder to be "established" and "distributed", a stricter triage
 *   bar, and the manufactured-credibility guard fires on any 2-of-3 maturity
 *   signals (not all 3) — all raise the bar to STRONG without ever loosening it.
 * - `minimal`: turns the manufactured-credibility caveat off (fewer caveats for
 *   casual browsing). It does NOT disable the provenance gate or the archived
 *   caution — "lighter" never means "less protected against the high-severity
 *   signals".
 */
/** The presets as an ordered runtime list (the type is compile-time only), for
 *  rendering the selector and asserting each preset stays within bounds. */
export const SCORING_PRESET_KEYS: ScoringPreset[] = ['balanced', 'cautious', 'minimal']

export const SCORING_PRESETS: Record<ScoringPreset, ScoringConfig> = {
  balanced: DEFAULT_SCORING_CONFIG,
  cautious: {
    ...DEFAULT_SCORING_CONFIG,
    establishedDays: 730,
    govDistributedMin: 8,
    responsiveActiveMin: 8,
    manufacturedGuard: { sensitivity: 'any-2-of-3', severity: 'medium' },
  },
  minimal: {
    ...DEFAULT_SCORING_CONFIG,
    manufacturedGuard: { sensitivity: 'off', severity: 'medium' },
  },
}

/** Maps the guard's policy severity to a `Flag` severity. `caution` → `high`,
 *  which is what makes it override the archived-only caution rule. */
export const GUARD_FLAG_SEVERITY: Record<GuardSeverity, 'high' | 'medium' | 'low'> = {
  note: 'low',
  medium: 'medium',
  caution: 'high',
}

/**
 * Stable, compact hash of a config's *values*, for the cache key — so two
 * distinct configs never collide and changing any value invalidates prior
 * entries. Canonicalizes (sorted keys, recursively) before hashing so equal
 * configs always hash equal regardless of key order. FNV-1a 32-bit → base36.
 */
export function hashConfig(config: ScoringConfig): string {
  // `additiveDimensions` is semantically a Set (order-irrelevant in `analyzeRepo`),
  // so normalize it before hashing — otherwise a reorder (e.g. a slice-B preset
  // merge) would hash differently and needlessly partition the cache.
  const normalized = { ...config, additiveDimensions: [...config.additiveDimensions].sort() }
  const json = canonicalize(normalized)
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`
}
