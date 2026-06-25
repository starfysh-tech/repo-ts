import type {
  AnalysisResult,
  ConfidenceState,
  DimensionKey,
  DimensionState,
  TrustState,
} from '../engine/types'

// Shared, conservative display vocabulary (per CLAUDE.md product rules): never
// "safe"/"trusted"/"dangerous". Every state carries an icon AND a text label,
// so it is never conveyed by color alone. Used by the card, watchlist, and popup.
export const TRUST_DISPLAY: Record<TrustState, { icon: string; label: string }> = {
  strong_signals: { icon: '✓', label: 'Strong signals' },
  mixed_signals: { icon: '◐', label: 'Mixed signals' },
  caution: { icon: '▲', label: 'Caution' },
  insufficient_evidence: { icon: '?', label: 'Limited evidence' },
}

export const CONFIDENCE_LABEL: Record<ConfidenceState, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

// Safe accessor: watchlist rows render from stored snapshots (untrusted at read
// time — could be corrupted or from a future schema), so an unexpected
// trust_state must degrade to a label, not crash the render.
export function trustDisplay(state?: string): { icon: string; label: string } {
  return (state ? TRUST_DISPLAY[state as TrustState] : undefined) ?? { icon: '?', label: 'Unknown' }
}

// Per-dimension state, conveyed with icon AND text (never color alone).
export const DIM_DISPLAY: Record<DimensionState, { icon: string; label: string }> = {
  strong: { icon: '✓', label: 'Strong' },
  mixed: { icon: '◐', label: 'Mixed' },
  weak: { icon: '△', label: 'Weak' },
  unknown: { icon: '–', label: 'Not enough evidence' },
}

export const DIM_TITLE: Record<DimensionKey, string> = {
  provenance: 'Provenance',
  security: 'Security hygiene',
  transparency: 'Transparency',
}

const joinWords = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/** A one-line plain-language takeaway synthesizing the verdict, so "Mixed
 *  signals / Medium confidence" is paired with what actually drove it.
 *  Qualitative only — no numbers, no banned vocabulary. */
export function verdictSummary(result: AnalysisResult): string {
  const high = result.flags.find((f) => f.severity === 'high')
  if (high) return `${high.label}.`

  const strong = result.dimension_results
    .filter((d) => d.dimension_state === 'strong')
    .map((d) => DIM_TITLE[d.dimension_key].toLowerCase())
  const limited = result.dimension_results
    .filter((d) => d.dimension_state === 'weak' || d.dimension_state === 'unknown')
    .map((d) => DIM_TITLE[d.dimension_key].toLowerCase())

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (strong.length && limited.length) return cap(`strong ${joinWords(strong)}, but limited ${joinWords(limited)}.`)
  if (strong.length) return cap(`strong ${joinWords(strong)}.`)
  if (limited.length) return cap(`limited ${joinWords(limited)}.`)
  return 'Mixed evidence across the evaluated areas.'
}
