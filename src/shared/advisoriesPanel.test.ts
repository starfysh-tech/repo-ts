import { describe, expect, it } from 'vitest'
import type { Advisory } from '../engine/advisoriesClient'
import {
  advisoriesHeadline,
  CONSENT_BODY,
  EMPTY_COPY,
  EMPTY_SUBNOTE,
  NO_DEP_COPY,
  pulledLabel,
  UNAVAILABLE_COPY,
} from './AdvisoriesPanel'

// Copy-level guard only (the suite avoids DOM render tests). Two concerns:
// 1. Conservative language — the empty-result and "couldn't check" copy must never
//    use alarm/assurance words.
// 2. The pure headline builder produces the right count string and empty-state copy.

const FORBIDDEN = ['safe', 'secure', 'trusted', 'verified safe', 'dangerous', 'malicious']

const advisory = (severity: Advisory['severity'], id: string): Advisory => ({
  id,
  source: 'GHSA',
  severity,
  package: 'pkg',
  version: '1.0.0',
  summary: 'a summary',
  url: 'https://example.test/' + id,
})

describe('advisories copy', () => {
  // Every string a user reads when the result is benign or the check fails.
  const reassuringCopy = [CONSENT_BODY, EMPTY_COPY, EMPTY_SUBNOTE, NO_DEP_COPY, UNAVAILABLE_COPY]

  it('uses no assurance or alarm words', () => {
    for (const copy of reassuringCopy) {
      const lower = copy.toLowerCase()
      for (const word of FORBIDDEN) {
        expect(lower).not.toContain(word)
      }
    }
  })

  it('reads a backend failure as a non-event, not an alarm', () => {
    expect(UNAVAILABLE_COPY.toLowerCase()).toContain("couldn't check")
  })
})

describe('advisoriesHeadline', () => {
  it('summarizes a mixed-severity result by count and severity', () => {
    const result = {
      status: 'ok' as const,
      scanned: 142,
      asOf: '2026-06-01',
      advisories: [advisory('critical', 'a'), advisory('high', 'b'), advisory('high', 'c')],
    }
    expect(advisoriesHeadline(result)).toBe(
      '3 known advisories across 142 dependencies — 1 critical, 2 high',
    )
  })

  it('uses the singular noun for a single advisory', () => {
    const result = {
      status: 'ok' as const,
      scanned: 10,
      asOf: '2026-06-01',
      advisories: [advisory('low', 'a')],
    }
    expect(advisoriesHeadline(result)).toBe('1 known advisory across 10 dependencies — 1 low')
  })

  it('reports the scanned count for zero advisories', () => {
    const result = { status: 'ok' as const, scanned: 80, asOf: '2026-06-01', advisories: [] }
    expect(advisoriesHeadline(result)).toBe(`${EMPTY_COPY} across 80 dependencies.`)
  })

  it('never embeds the as-of in the headline (it lives by the re-check)', () => {
    const result = { status: 'ok' as const, scanned: 80, asOf: '2026-06-01', advisories: [] }
    expect(advisoriesHeadline(result).toLowerCase()).not.toContain('as of')
  })

  it('uses the singular dependency noun for a single scanned dep', () => {
    const result = { status: 'ok' as const, scanned: 1, asOf: '', advisories: [] }
    expect(advisoriesHeadline(result)).toBe(`${EMPTY_COPY} across 1 dependency.`)
  })
})

describe('pulledLabel', () => {
  const now = new Date('2026-06-29T12:00:00Z')
  // asOf `ms` before `now`, as an ISO string.
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const H = 3_600_000
  const D = 24 * H

  it('returns "" for an absent or unparseable timestamp', () => {
    expect(pulledLabel('', now)).toBe('')
    expect(pulledLabel('not-a-date', now)).toBe('')
  })

  it('reads under an hour as "just now"', () => {
    expect(pulledLabel(ago(40 * 60_000), now)).toBe('just now')
  })

  it('reports whole hours up to a day', () => {
    expect(pulledLabel(ago(5 * H), now)).toBe('5h ago')
    expect(pulledLabel(ago(23 * H), now)).toBe('23h ago')
  })

  it('reports whole days through three days', () => {
    expect(pulledLabel(ago(D), now)).toBe('1d ago')
    expect(pulledLabel(ago(3 * D), now)).toBe('3d ago')
  })

  it('switches to an absolute date (no time) after three days', () => {
    const label = pulledLabel(ago(10 * D), now)
    expect(label).not.toContain('ago')
    expect(label).not.toMatch(/\d:\d/) // no clock time
    expect(label).toContain('2026')
  })
})
