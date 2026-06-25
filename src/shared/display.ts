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
