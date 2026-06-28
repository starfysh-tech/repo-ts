import type { DimensionResult, EvidenceLink, RationaleSegment } from '../engine/types'
import { DIM_ACCENT, DIM_DISPLAY, DIM_TITLE, NEUTRAL_ACCENT } from './display'

// Co-located styles (see ConfidenceMeter for the rationale).
export const dimensionRowStyles = `
  .dim { margin: 0 0 10px; }
  .dim__head { display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
  .dim__state { margin-left: auto; font-size: 11px; }
  .dim__rationale { margin: 2px 0 0; font-size: 12px; color: #57606a; }
  .dim__links { margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .dim__links a { font-size: 11px; color: #0969da; }
  @media (prefers-color-scheme: dark) {
    .dim__rationale { color: #9198a1; }
    .dim__links a { color: #4493f8; }
  }
`

/** Evidence links not already woven inline into the rationale — matched by URL
 *  (exact), not by string-searching the prose — render as trailing chips. */
export function chipLinks(segments: RationaleSegment[], links: EvidenceLink[]): EvidenceLink[] {
  const inlined = new Set(segments.map((s) => s.href).filter(Boolean))
  return links.filter((l) => !inlined.has(l.url))
}

// One dimension's row: icon + title + state (accent-colored, supplementary to
// the icon/text), an evidence-first rationale, and evidence links. The engine
// emits the rationale as segments with explicit inline-link slots; any evidence
// link not woven inline renders as a trailing chip. Shared by card and popup.
export function DimensionRow({ dim }: { dim: DimensionResult }) {
  // Tolerate a corrupted/old-schema stored dimension: unexpected state or
  // missing segments/links degrade rather than crashing the whole card render.
  const s = DIM_DISPLAY[dim.dimension_state] ?? { icon: '?', label: 'Unknown' }
  const accent = DIM_ACCENT[dim.dimension_state] ?? NEUTRAL_ACCENT
  const links = dim.evidence_links ?? []
  const segments = dim.rationale_segments ?? []
  const chips = chipLinks(segments, links)

  return (
    <div class="dim">
      <div class="dim__head">
        <span aria-hidden="true" style={`color:${accent}`}>
          {s.icon}
        </span>
        <strong>{DIM_TITLE[dim.dimension_key] ?? dim.dimension_key}</strong>
        <span class="dim__state" style={`color:${accent}`}>
          {s.label}
        </span>
      </div>
      <p class="dim__rationale">
        {segments.map((seg, i) =>
          seg.href ? (
            <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer">
              {seg.text}
            </a>
          ) : (
            seg.text
          ),
        )}
      </p>
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
