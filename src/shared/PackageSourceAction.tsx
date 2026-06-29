import { useState } from 'preact/hooks'
import type { AnalysisResult } from '../engine/types'
import type { SupportedRepo } from '../content/parseRepoContext'
import { requestPackageSource } from './messages'
import { rationaleText } from '../engine/rationale'
import { DIM_ACCENT, DIM_DISPLAY, NEUTRAL_ACCENT } from './display'

// Co-located styles (see ConfidenceMeter for the rationale).
export const packageSourceActionStyles = `
  .pkgsrc { margin: 10px 0 0; }
  .pkgsrc__btn {
    font-size: 12px; padding: 5px 10px; cursor: pointer;
    border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit;
  }
  .pkgsrc__btn:disabled { cursor: default; opacity: 0.6; }
  .pkgsrc__why { margin: 4px 0 0; font-size: 11px; color: #57606a; line-height: 1.4; }
  .pkgsrc__note { margin: 4px 0 0; font-size: 11px; color: #9a6700; }
  .pkgsrc__result { margin: 6px 0 0; font-size: 12px; line-height: 1.4; }
  .pkgsrc__result-icon { font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    .pkgsrc__btn { border-color: rgba(255,255,255,0.24); }
    .pkgsrc__why { color: #9198a1; }
    .pkgsrc__note { color: #d4a72c; }
  }
`

const packageSourceDimension = (result: AnalysisResult) =>
  (result.dimension_results ?? []).find((d) => d.dimension_key === 'package_source')

/**
 * The manual, on-demand "Package source" check. Renders a button (the heavier
 * registry call runs only on click); on success it lifts the merged, possibly
 * caution-escalated result to the parent via `onResult`. Once a result already
 * carries the package_source dimension, the action hides itself.
 */
export function PackageSourceAction({
  target,
  result,
  onResult,
}: {
  target: SupportedRepo
  result: AnalysisResult
  onResult: (merged: AnalysisResult) => void
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  // Once checked, the result is folded into the verdict — show a persistent
  // outcome line (icon + rationale) here too, so the check visibly resolves
  // instead of the button silently vanishing.
  const checked = packageSourceDimension(result)
  if (checked) {
    // Neutral fallback for an unexpected/corrupted dimension_state, matching
    // DimensionRow — an old-schema cached result must degrade, not crash.
    const display = DIM_DISPLAY[checked.dimension_state] ?? { icon: '?', label: 'Unknown' }
    const accent = DIM_ACCENT[checked.dimension_state] ?? NEUTRAL_ACCENT
    return (
      <div class="pkgsrc">
        <p class="pkgsrc__result">
          <span class="pkgsrc__result-icon" style={`color:${accent}`} aria-hidden="true">
            {display.icon}
          </span>{' '}
          {rationaleText(checked.rationale_segments)}
        </p>
      </div>
    )
  }

  const run = async () => {
    setBusy(true)
    setNote('')
    try {
      const outcome = await requestPackageSource(target)
      if (outcome?.status === 'ok') onResult(outcome.result)
      else if (outcome?.status === 'rate_limited') setNote('Rate limit reached — try again later.')
      else setNote("Couldn't check the package source just now.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="pkgsrc">
      <button type="button" class="pkgsrc__btn" onClick={run} disabled={busy}>
        {busy ? 'Checking…' : 'Check package source'}
      </button>
      <p class="pkgsrc__why">
        Verifies this repo is the published source of the package it declares (npm). Checks linkage
        only — not malware, vulnerabilities, or dependencies.
      </p>
      {note && <p class="pkgsrc__note">{note}</p>}
    </div>
  )
}
