import type { DimensionResult } from '../engine/types'
import { DIM_ACCENT, DIM_DISPLAY, DIM_TITLE } from './display'

const isWordChar = (ch: string | undefined) => ch != null && /[a-z0-9]/i.test(ch)

/** Index of `needle` in `haystack` as a case-insensitive whole word, or -1. */
export function findWholeWord(haystack: string, needle: string): number {
  if (!needle) return -1
  const hay = haystack.toLowerCase()
  const target = needle.toLowerCase()
  for (let from = 0; ; ) {
    const i = hay.indexOf(target, from)
    if (i < 0) return -1
    if (!isWordChar(haystack[i - 1]) && !isWordChar(haystack[i + target.length])) return i
    from = i + 1
  }
}

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
      if (typeof seg !== 'string') continue
      // Case-insensitive, whole-word match (the rationale says "security policy"
      // while the label is "Security policy"; and we must not splice mid-word).
      const at = findWholeWord(seg, link.label)
      if (at < 0) continue
      segments.splice(
        i,
        1,
        seg.slice(0, at),
        // Link the rationale's own words (its casing), not the label's.
        <a href={link.url} target="_blank" rel="noopener noreferrer">
          {seg.slice(at, at + link.label.length)}
        </a>,
        seg.slice(at + link.label.length),
      )
      inlined.add(link.url)
      break
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
