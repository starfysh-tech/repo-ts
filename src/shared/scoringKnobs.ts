import { DEFAULT_SCORING_CONFIG } from '../engine/config'
import type { GuardSensitivity, GuardSeverity, ScoringPreset } from '../engine/config'
import type { DimensionKey } from '../engine/types'

// The user-facing knob inventory for the Advanced scoring UI (slice C). It is the
// single source of truth for each dial's label, plain-language "why", control
// type, and bounds — so the settings page renders generically and the validation
// seam (`resolveScoringConfig`) clamps numeric overrides against the SAME bounds.
// Engine code never imports this; it's UI + validation metadata only.

/** The nine numeric `ScoringConfig` fields (the policy fields are heterogeneous
 *  and handled explicitly in the UI, not through this generic list). */
export type NumericKey =
  | 'veryNewDays'
  | 'dormantDays'
  | 'establishedDays'
  | 'releaseRecentDays'
  | 'govDistributedMin'
  | 'govDominantShare'
  | 'responsiveRecentDays'
  | 'responsiveActiveMin'
  | 'highConfidenceThreshold'

/** The dimension/area a threshold tunes — used to group the Advanced UI by the
 *  user's mental model (the verdict's own structure) instead of one flat list. */
export type KnobGroup = 'provenance' | 'governance' | 'release' | 'responsiveness' | 'confidence'

export const KNOB_GROUPS: { key: KnobGroup; label: string; why: string }[] = [
  { key: 'provenance', label: 'Provenance', why: 'Origin, age, and standing.' },
  { key: 'governance', label: 'Governance', why: 'How distributed maintenance is.' },
  { key: 'release', label: 'Release discipline', why: 'Published-release cadence.' },
  { key: 'responsiveness', label: 'Responsiveness', why: 'Recent issue / PR activity.' },
  { key: 'confidence', label: 'Confidence', why: 'How strongly the verdict is held — never changes the verdict itself.' },
]

export interface NumericKnob {
  key: NumericKey
  label: string
  why: string
  min: number
  max: number
  /** Input step; integers default to 1. `govDominantShare` is a fraction. */
  step: number
  /** Which Advanced group this dial lives under. */
  group: KnobGroup
  /** Unit suffix shown next to the value (e.g. "days", "people", "" for a share). */
  unit: string
  /** Does raising the value make the tool MORE conservative? Drives the
   *  lenient⇄strict orientation + the "↑ raises the bar" hint. */
  higherIsStricter: boolean
}

/** Ordered for display, grouped loosely by dimension. Bounds are deliberately
 *  generous — they exist to keep a hand-edited value from breaking the engine
 *  (negative days, a share > 1), not to second-guess a deliberate stance. */
export const NUMERIC_KNOBS: NumericKnob[] = [
  {
    key: 'veryNewDays',
    label: 'Very-new window',
    why: 'A repo younger than this reads as "very new" — a low-evidence signal, and one input to the manufactured-credibility guard.',
    min: 1, max: 365, step: 1, group: 'provenance', unit: 'days', higherIsStricter: true,
  },
  {
    key: 'establishedDays',
    label: 'Established age',
    why: 'A repo older than this counts as "established" — a provenance strength that helps it clear the gate to STRONG.',
    min: 30, max: 3650, step: 1, group: 'provenance', unit: 'days', higherIsStricter: true,
  },
  {
    key: 'dormantDays',
    label: 'Dormancy window',
    why: 'No push within this window reads as "dormant". Contextual only — dormancy never triggers caution on its own.',
    min: 90, max: 3650, step: 1, group: 'provenance', unit: 'days', higherIsStricter: false,
  },
  {
    key: 'govDistributedMin',
    label: 'Distributed-maintenance minimum',
    why: 'This many distinct contributors, none dominating, reads as distributed maintenance rather than a one-person project.',
    min: 1, max: 50, step: 1, group: 'governance', unit: 'people', higherIsStricter: true,
  },
  {
    key: 'govDominantShare',
    label: 'Dominant-contributor share',
    why: 'A single contributor at or above this fraction of observed commits reads as bus-factor-1.',
    min: 0.5, max: 1, step: 0.05, group: 'governance', unit: '', higherIsStricter: false,
  },
  {
    key: 'releaseRecentDays',
    label: 'Recent-release window',
    why: 'A published release within this window reads as active release discipline (a lift toward STRONG).',
    min: 30, max: 1825, step: 1, group: 'release', unit: 'days', higherIsStricter: false,
  },
  {
    key: 'responsiveRecentDays',
    label: 'Recent-activity window',
    why: 'A closed issue or PR within this window counts as recent maintainer activity.',
    min: 7, max: 730, step: 1, group: 'responsiveness', unit: 'days', higherIsStricter: false,
  },
  {
    key: 'responsiveActiveMin',
    label: 'Active-triage minimum',
    why: 'This many recent closures (issues + PRs) reads as active triage (a lift toward STRONG).',
    min: 1, max: 100, step: 1, group: 'responsiveness', unit: 'closures', higherIsStricter: true,
  },
  {
    key: 'highConfidenceThreshold',
    label: 'High-confidence breadth',
    why: 'This many evidenced dimensions reads high confidence; one fewer reads medium. Never changes the verdict, only how strongly it is held.',
    min: 1, max: 6, step: 1, group: 'confidence', unit: 'dimensions', higherIsStricter: true,
  },
]

/** Numeric bounds keyed for O(1) clamp lookup, derived from the knob list so the
 *  UI inputs and the validation seam can never drift apart. */
export const NUMERIC_BOUNDS: Record<NumericKey, { min: number; max: number }> = NUMERIC_KNOBS.reduce(
  (acc, k) => {
    acc[k.key] = { min: k.min, max: k.max }
    return acc
  },
  {} as Record<NumericKey, { min: number; max: number }>,
)

/** Guard-sensitivity options for the enum control. `off` weakens conservatism
 *  (disables the manufactured-credibility guard entirely). */
export const GUARD_SENSITIVITY_OPTIONS: { value: GuardSensitivity; label: string; weakens: boolean }[] =
  [
    { value: 'all-3', label: 'All 3 maturity signals (strictest to fire)', weakens: false },
    { value: 'any-2-of-3', label: 'Any 2 of 3 maturity signals', weakens: false },
    { value: 'off', label: 'Off — disable the guard', weakens: true },
  ]

/** Guard-severity options. `caution` is the loud one: it overrides the
 *  archived-only caution rule, so the UI flags it distinctly (not merely "weakens"). */
export const GUARD_SEVERITY_OPTIONS: {
  value: GuardSeverity
  label: string
  emphasis: 'none' | 'caution'
}[] = [
  { value: 'note', label: 'Note (quietest)', emphasis: 'none' },
  { value: 'medium', label: 'Medium caveat', emphasis: 'none' },
  { value: 'caution', label: 'Caution (overrides the archived-only rule)', emphasis: 'caution' },
]

/** Plain-language copy for each preset, shown beside the selector. */
export const PRESET_COPY: Record<ScoringPreset, { label: string; why: string }> = {
  balanced: {
    label: 'Balanced',
    why: 'The default. Conservative, evidence-based — the stance every fixture is locked against.',
  },
  cautious: {
    label: 'Cautious',
    why: 'Higher bars to reach strong signals, so more repos read mixed at the margins. Never loosens a high-severity signal.',
  },
  minimal: {
    label: 'Minimal',
    why: 'Lighter touch for casual browsing — turns off the manufactured-credibility caveat. Keeps the provenance gate and the archived caution.',
  },
}

/** The six dimensions, with the additive default. Marking a dimension additive
 *  means it can lift the verdict toward STRONG but can never demote it — so adding
 *  a dimension that is core by default WEAKENS conservatism (it loses its veto). */
export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  provenance: 'Provenance',
  security: 'Security docs',
  transparency: 'Transparency',
  release: 'Release discipline',
  governance: 'Governance',
  responsiveness: 'Responsiveness',
  // Not a user-configurable additive knob (always-additive, manual); listed only
  // to satisfy the DimensionKey record. The settings UI iterates DIMENSION_KEYS.
  package_source: 'Package source',
}

/** Additive by default — used to decide whether the current additive selection
 *  has been widened (which weakens conservatism). Derived from the engine default
 *  so it can't drift from the balanced preset's actual additive set. */
export const DEFAULT_ADDITIVE: DimensionKey[] = DEFAULT_SCORING_CONFIG.additiveDimensions

/** True when the chosen additive set includes any dimension that is core by
 *  default — i.e. the user has removed a dimension's ability to demote. */
export function additiveWeakens(selected: DimensionKey[]): boolean {
  return selected.some((d) => !DEFAULT_ADDITIVE.includes(d))
}

/** Plain-language role of a dimension, given whether it's additive (lift-only) or
 *  core (can also lower the verdict) — replaces the internal "additive/core"
 *  vocabulary in the settings UI. */
export function dimensionRole(isAdditive: boolean): { label: string; impact: string } {
  return isAdditive
    ? { label: 'Lift only', impact: 'can raise the verdict toward strong, but never pull it down' }
    : { label: 'Can lower', impact: 'a weak result here can pull the verdict down' }
}
