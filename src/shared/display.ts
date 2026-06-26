import type {
  AnalysisResult,
  ConfidenceState,
  DimensionKey,
  DimensionResult,
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

// Accent colors are SUPPLEMENTARY — the icon and text label always carry the
// state, so the UI never depends on color alone. Tuned to be conservative
// (caution is a warm severe, not an alarm red).
export const TRUST_ACCENT: Record<TrustState, string> = {
  strong_signals: '#1a7f37',
  mixed_signals: '#9a6700',
  caution: '#bc4c00',
  insufficient_evidence: '#6e7781',
}

export const DIM_ACCENT: Record<DimensionState, string> = {
  strong: '#1a7f37',
  mixed: '#9a6700',
  weak: '#bc4c00',
  unknown: '#6e7781',
}

/** Slate neutral used when there is no trust verdict yet (loading/error/etc.). */
export const NEUTRAL_ACCENT = '#6e7781'

/** The accent for a trust state, or the neutral when there's no verdict. */
export function trustAccent(state?: TrustState): string {
  return state ? TRUST_ACCENT[state] : NEUTRAL_ACCENT
}

/** How many of the 3 confidence-meter segments are filled. */
export const CONFIDENCE_FILL: Record<ConfidenceState, number> = { high: 3, medium: 2, low: 1 }

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
  release: 'Release discipline',
  governance: 'Governance',
}

const joinWords = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

/** A one-line plain-language takeaway synthesizing the verdict, so "Mixed
 *  signals / Medium confidence" is paired with what actually drove it.
 *  Qualitative only — no numbers, no banned vocabulary. */
export function verdictSummary(result: AnalysisResult): string {
  // Tolerate a corrupted/old-schema stored result: missing arrays or an
  // unexpected dimension key degrade rather than throwing.
  const high = (result.flags ?? []).find((f) => f.severity === 'high')
  if (high) return `${high.label}.`

  const dims = result.dimension_results ?? []
  const titleOf = (d: DimensionResult) => (DIM_TITLE[d.dimension_key] ?? d.dimension_key ?? '').toLowerCase()
  const strong = dims.filter((d) => d.dimension_state === 'strong').map(titleOf)
  const limited = dims.filter((d) => d.dimension_state === 'weak' || d.dimension_state === 'unknown').map(titleOf)

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (strong.length && limited.length) return cap(`strong ${joinWords(strong)}, but limited ${joinWords(limited)}.`)
  if (strong.length) return cap(`strong ${joinWords(strong)}.`)
  if (limited.length) return cap(`limited ${joinWords(limited)}.`)
  return 'Mixed evidence across the evaluated areas.'
}
