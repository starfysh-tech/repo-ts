import type { Flag } from '../engine/types'

// Surfaces sub-Caution flags as a small caveat list. Until now the only UI
// consumer of `flags` was verdictSummary (high-severity → headline), so every
// medium flag (e.g. "No license detected", and now "manufactured-credibility")
// was invisible. This is the one channel that shows them. The △ glyph + the text
// label carry the meaning (never colour alone); △ (outline) is deliberately the
// softer sibling of the ▲ Caution glyph — a caveat, not an alarm.
export const caveatsStyles = `
  .caveats { margin: 8px 0 0; padding: 0; list-style: none; }
  .caveats__item {
    display: flex; gap: 6px; align-items: baseline;
    font-size: 11px; line-height: 1.4; color: #9a6700; margin-top: 4px;
  }
  .caveats__icon { flex: none; font-size: 10px; }
  @media (prefers-color-scheme: dark) {
    .caveats__item { color: #d29922; }
  }
`

export function Caveats({ flags }: { flags: Flag[] }) {
  // High-severity flags drive the headline verdict via verdictSummary, so they are
  // not repeated here — this list is for the sub-Caution caveats only.
  const caveats = (flags ?? []).filter((f) => f.severity !== 'high')
  if (caveats.length === 0) return null
  return (
    <ul class="caveats" aria-label="Caveats">
      {caveats.map((f) => (
        <li key={f.key} class="caveats__item">
          <span class="caveats__icon" aria-hidden="true">△</span>
          <span>{f.label}</span>
        </li>
      ))}
    </ul>
  )
}
