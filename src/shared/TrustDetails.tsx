import { useState } from 'preact/hooks'
import type { AnalysisResult } from '../engine/types'
import { DimensionRow } from './DimensionRow'

// The four dimensions deferred from this version (shown as "not evaluated" so the
// user is never misled into thinking they were assessed and passed).
const DEFERRED_DIMENSIONS = ['Release discipline', 'Governance', 'Supply chain', 'Responsiveness']

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
          {result.dimension_results.map((dim) => (
            <DimensionRow key={dim.dimension_key} dim={dim} />
          ))}
          <h3 class="details__subtitle">Not evaluated in this version</h3>
          <ul class="details__deferred">
            {DEFERRED_DIMENSIONS.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
