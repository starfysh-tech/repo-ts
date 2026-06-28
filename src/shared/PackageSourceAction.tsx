import { useState } from 'preact/hooks'
import type { AnalysisResult } from '../engine/types'
import type { SupportedRepo } from '../content/parseRepoContext'
import { requestPackageSource } from './messages'

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
  @media (prefers-color-scheme: dark) {
    .pkgsrc__btn { border-color: rgba(255,255,255,0.24); }
    .pkgsrc__why { color: #9198a1; }
    .pkgsrc__note { color: #d4a72c; }
  }
`

const alreadyChecked = (result: AnalysisResult) =>
  (result.dimension_results ?? []).some((d) => d.dimension_key === 'package_source')

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

  if (alreadyChecked(result)) return null

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
