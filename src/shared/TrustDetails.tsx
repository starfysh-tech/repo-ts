import { useState } from 'preact/hooks'
import type { AnalysisResult } from '../engine/types'
import { DimensionRow } from './DimensionRow'

// Co-located styles (see ConfidenceMeter for the rationale).
export const trustDetailsStyles = `
  .details { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1); }
  .details__toggle {
    display: flex; align-items: center; gap: 6px; width: 100%;
    margin: 0; padding: 0; border: none; background: transparent; color: inherit;
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left;
  }
  .details__chevron { font-size: 9px; width: 10px; }
  .details__body { margin-top: 8px; }
  .details__subtitle { margin: 12px 0 4px; font-size: 11px; font-weight: 600; color: #4a5159; }
  .details__deferred { margin: 0; padding-left: 16px; font-size: 11px; color: #57606a; }
  .details__deferred li { margin-top: 2px; }
  .details__deferred strong { font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    .details { border-top-color: rgba(255,255,255,0.12); }
    .details__subtitle { color: #b0b7c0; }
    .details__deferred { color: #9198a1; }
  }
`

// Dimensions NOT evaluated here, each with why its absence matters — so a user is
// never misled into reading the verdict as comprehensive. Supply chain (malware,
// known vulnerabilities, dependency risk) is the most security-relevant gap for a
// pre-install decision, so it carries an explicit "check separately" note.
const DEFERRED_DIMENSIONS = [
  { name: 'Supply chain', note: 'malware, known vulnerabilities, and dependency risk are not checked here — assess these separately before installing.' },
] as const

// Collapsible "Trust details": the per-dimension breakdown + the deferred
// dimensions, behind a toggle. Shared by the in-page card and the popup. Default
// open — the details were valued visible; the toggle just lets the user collapse.
export function TrustDetails({ result }: { result: AnalysisResult }) {
  const [open, setOpen] = useState(true)
  return (
    <section class="details">
      <button
        type="button"
        class="details__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span class="details__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        Trust details
      </button>
      {open && (
        <div class="details__body">
          {(result.dimension_results ?? []).map((dim) => (
            <DimensionRow key={dim.dimension_key} dim={dim} />
          ))}
          <h3 class="details__subtitle">Not checked here</h3>
          <ul class="details__deferred">
            {DEFERRED_DIMENSIONS.map(({ name, note }) => (
              <li key={name}>
                <strong>{name}</strong> — {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
