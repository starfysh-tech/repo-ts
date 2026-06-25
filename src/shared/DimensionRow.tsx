import type { DimensionResult } from '../engine/types'
import { DIM_ACCENT, DIM_DISPLAY, DIM_TITLE } from './display'

// One dimension's row: icon + title + state (accent-colored, supplementary to
// the icon/text), an evidence-first rationale, and evidence links. A link whose
// label is named in the rationale (e.g. "README") folds inline; the rest render
// as trailing chips. Shared by the in-page card and the popup.
export function DimensionRow({ dim }: { dim: DimensionResult }) {
  const s = DIM_DISPLAY[dim.dimension_state]
  const accent = DIM_ACCENT[dim.dimension_state]

  const inlined = new Set<string>()
  const segments: (string | preact.JSX.Element)[] = [dim.rationale_summary]
  for (const link of dim.evidence_links) {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (typeof seg === 'string' && seg.includes(link.label)) {
        const at = seg.indexOf(link.label)
        segments.splice(
          i,
          1,
          seg.slice(0, at),
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>,
          seg.slice(at + link.label.length),
        )
        inlined.add(link.url)
        break
      }
    }
  }
  const chips = dim.evidence_links.filter((l) => !inlined.has(l.url))

  return (
    <div class="dim">
      <div class="dim__head">
        <span aria-hidden="true" style={`color:${accent}`}>
          {s.icon}
        </span>
        <strong>{DIM_TITLE[dim.dimension_key]}</strong>
        <span class="dim__state" style={`color:${accent}`}>
          {s.label}
        </span>
      </div>
      <p class="dim__rationale">{segments}</p>
      {chips.length > 0 && (
        <ul class="dim__links">
          {chips.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
