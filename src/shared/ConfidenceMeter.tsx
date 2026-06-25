import { CONFIDENCE_FILL, CONFIDENCE_LABEL } from './display'
import type { ConfidenceState } from '../engine/types'

// Confidence as a labelled segmented meter: "Confidence: ▰▰▱". Deliberately
// neutral-colored (not the trust accent) so confidence reads as separate from
// trust, and the word for the level is dropped from view — it echoed the trust
// label ("Mixed" / "Medium") — but kept in aria-label for non-visual users.
export function ConfidenceMeter({ level }: { level: ConfidenceState }) {
  const filled = CONFIDENCE_FILL[level]
  return (
    <div class="meter-row">
      <span class="meter-row__label">Confidence:</span>
      <span class="meter" role="img" aria-label={CONFIDENCE_LABEL[level]}>
        {[0, 1, 2].map((i) => (
          <span class={i < filled ? 'meter__seg meter__seg--on' : 'meter__seg'} key={i} />
        ))}
      </span>
    </div>
  )
}
