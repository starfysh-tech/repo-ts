import { describe, it, expect } from 'vitest'
import { chipLinks } from './DimensionRow'
import { rationaleText } from '../engine/rationale'
import type { EvidenceLink, RationaleSegment } from '../engine/types'

// The engine now emits rationale as explicit segments (text + inline-link slots),
// so the UI no longer string-matches labels against prose. These cover the two
// pure helpers that replaced `findWholeWord`.

describe('rationaleText', () => {
  it('flattens segments to plain prose (link text included, hrefs dropped)', () => {
    const segs: RationaleSegment[] = [
      { text: 'Has a ' },
      { text: 'README', href: 'https://example/#readme' },
      { text: '.' },
    ]
    expect(rationaleText(segs)).toBe('Has a README.')
  })
})

describe('chipLinks', () => {
  const links: EvidenceLink[] = [
    { label: 'README', url: 'https://example/#readme' },
    { label: 'Repository', url: 'https://example/repo' },
  ]

  it('drops a link already woven inline (matched by URL, not label)', () => {
    const segs: RationaleSegment[] = [{ text: 'Has a ' }, { text: 'README', href: 'https://example/#readme' }]
    // The inlined README falls out; the un-inlined Repository remains a chip.
    expect(chipLinks(segs, links)).toEqual([{ label: 'Repository', url: 'https://example/repo' }])
  })

  it('keeps every link as a chip when no segment carries an href', () => {
    const segs: RationaleSegment[] = [{ text: 'Licensed, organization-owned.' }]
    expect(chipLinks(segs, links)).toEqual(links)
  })

  it('matches by URL, so a label that merely appears as text is still a chip', () => {
    // A segment whose TEXT is "Repository" but with no href must NOT suppress the
    // Repository chip — only an href URL match inlines.
    const segs: RationaleSegment[] = [{ text: 'Repository activity is steady.' }]
    expect(chipLinks(segs, links)).toEqual(links)
  })
})
