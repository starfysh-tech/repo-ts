import { CONFIDENCE_FILL, CONFIDENCE_LABEL } from './display'
import type { ConfidenceState } from '../engine/types'

// Co-located styles, injected into both the card's shadow-DOM stylesheet and the
// popup's page stylesheet, so the component ships its own CSS (no two-place drift).
export const confidenceMeterStyles = `
  .meter-row { display: flex; align-items: center; gap: 7px; margin: 7px 0 0; font-size: 12px; color: #57606a; }
  .meter { display: inline-flex; gap: 2px; }
  .meter__seg { width: 16px; height: 5px; border-radius: 2px; background: rgba(0,0,0,0.14); }
  .meter__seg--on { background: #57606a; }
  @media (prefers-color-scheme: dark) {
    .meter-row { color: #9198a1; }
    .meter__seg { background: rgba(255,255,255,0.16); }
    .meter__seg--on { background: #9198a1; }
  }
`

// Confidence as a labelled segmented meter: "Confidence: ▰▰▱". Deliberately
// neutral-colored (not the trust accent) so confidence reads as separate from
// trust, and the word for the level is dropped from view — it echoed the trust
// label ("Mixed" / "Medium") — but kept in aria-label for non-visual users.
export function ConfidenceMeter({ level }: { level: ConfidenceState }) {
  const filled = CONFIDENCE_FILL[level] ?? 0
  return (
    <div class="meter-row">
      <span class="meter-row__label">Confidence:</span>
      <span class="meter" role="img" aria-label={CONFIDENCE_LABEL[level] ?? 'Confidence unknown'}>
        {[0, 1, 2].map((i) => (
          <span class={i < filled ? 'meter__seg meter__seg--on' : 'meter__seg'} key={i} />
        ))}
      </span>
    </div>
  )
}
