import type {
  GuardSensitivity,
  GuardSeverity,
  ScoringConfig,
  ScoringPreset,
} from '../engine/config'
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

export interface NumericKnob {
  key: NumericKey
  label: string
  why: string
  min: number
  max: number
  /** Input step; integers default to 1. `govDominantShare` is a fraction. */
  step: number
}

/** Ordered for display, grouped loosely by dimension. Bounds are deliberately
 *  generous — they exist to keep a hand-edited value from breaking the engine
 *  (negative days, a share > 1), not to second-guess a deliberate stance. */
export const NUMERIC_KNOBS: NumericKnob[] = [
  {
    key: 'veryNewDays',
    label: 'Very-new window (days)',
    why: 'A repo younger than this reads as "very new" — a low-evidence signal, and one input to the manufactured-credibility guard.',
    min: 1,
    max: 365,
    step: 1,
  },
  {
    key: 'establishedDays',
    label: 'Established age (days)',
    why: 'A repo older than this counts as "established" — a provenance strength that helps it clear the gate to STRONG.',
    min: 30,
    max: 3650,
    step: 1,
  },
  {
    key: 'dormantDays',
    label: 'Dormancy window (days)',
    why: 'No push within this window reads as "dormant". Contextual only — dormancy never triggers caution on its own.',
    min: 90,
    max: 3650,
    step: 1,
  },
  {
    key: 'releaseRecentDays',
    label: 'Recent-release window (days)',
    why: 'A published release within this window reads as active release discipline (an additive lift toward STRONG).',
    min: 30,
    max: 1825,
    step: 1,
  },
  {
    key: 'govDistributedMin',
    label: 'Distributed-maintenance minimum (people)',
    why: 'This many distinct contributors, none dominating, reads as distributed maintenance rather than a one-person project.',
    min: 1,
    max: 50,
    step: 1,
  },
  {
    key: 'govDominantShare',
    label: 'Dominant-contributor share',
    why: 'A single contributor at or above this fraction of observed commits reads as bus-factor-1.',
    min: 0.5,
    max: 1,
    step: 0.05,
  },
  {
    key: 'responsiveRecentDays',
    label: 'Recent-activity window (days)',
    why: 'A closed issue or PR within this window counts as recent maintainer activity.',
    min: 7,
    max: 730,
    step: 1,
  },
  {
    key: 'responsiveActiveMin',
    label: 'Active-triage minimum (closures)',
    why: 'This many recent closures (issues + PRs) reads as active triage (an additive lift toward STRONG).',
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: 'highConfidenceThreshold',
    label: 'High-confidence breadth (dimensions)',
    why: 'Confidence is breadth of evidence: this many evidenced dimensions reads high; one fewer reads medium. It never changes the verdict, only how strongly it is held.',
    min: 1,
    max: 6,
    step: 1,
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
}

/** Additive by default — used to decide whether the current additive selection
 *  has been widened (which weakens conservatism). */
export const DEFAULT_ADDITIVE: DimensionKey[] = ['release', 'responsiveness']

/** True when the chosen additive set includes any dimension that is core by
 *  default — i.e. the user has removed a dimension's ability to demote. */
export function additiveWeakens(selected: DimensionKey[]): boolean {
  return selected.some((d) => !DEFAULT_ADDITIVE.includes(d))
}

/** Narrowing helper so the UI can read/write numeric fields generically without
 *  `any`. The nine numeric keys are exactly the `number`-typed fields. */
export function numericValue(config: ScoringConfig, key: NumericKey): number {
  return config[key]
}
