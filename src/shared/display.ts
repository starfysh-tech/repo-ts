import type { ConfidenceState, TrustState } from '../engine/types'

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
