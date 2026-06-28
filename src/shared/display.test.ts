import { describe, it, expect } from 'vitest'
import { trustDisplay, verdictSummary } from './display'
import type { AnalysisResult, DimensionState, Flag } from '../engine/types'

const dim = (key: string, state: DimensionState) => ({ dimension_key: key, dimension_state: state })
const result = (dims: ReturnType<typeof dim>[], flags: Flag[] = []) =>
  ({ dimension_results: dims, flags }) as unknown as AnalysisResult

describe('trustDisplay', () => {
  it('maps a known trust state to an icon + label', () => {
    expect(trustDisplay('caution')).toEqual({ icon: '▲', label: 'Caution' })
  })

  it('degrades undefined or an unknown state to "Unknown" instead of crashing', () => {
    expect(trustDisplay(undefined)).toEqual({ icon: '?', label: 'Unknown' })
    expect(trustDisplay('bogus_state')).toEqual({ icon: '?', label: 'Unknown' })
  })
})

describe('verdictSummary', () => {
  it('names the strengths and surfaces a mixed area as a caveat (never drops it)', () => {
    expect(
      verdictSummary(result([dim('provenance', 'strong'), dim('security', 'mixed'), dim('transparency', 'strong')])),
    ).toBe('Strong provenance and transparency, with mixed security docs.')
  })

  it('contrasts strengths against both mixed and limited areas', () => {
    // Regression guard: a mixed provenance must not vanish from the takeaway
    // (the bug that made a mixed-provenance repo read as unqualified "Strong …").
    expect(
      verdictSummary(result([dim('provenance', 'mixed'), dim('security', 'unknown'), dim('transparency', 'strong')])),
    ).toBe('Strong transparency, with mixed provenance, but limited security docs.')
  })

  it('leads with a high-severity flag', () => {
    expect(
      verdictSummary(
        result([dim('provenance', 'mixed')], [{ key: 'archived', severity: 'high', label: 'Repository is archived' }]),
      ),
    ).toBe('Repository is archived.')
  })

  it('names the mixed areas when nothing is strong', () => {
    expect(verdictSummary(result([dim('provenance', 'mixed'), dim('security', 'mixed')]))).toBe(
      'Mixed provenance and security docs.',
    )
  })

  it('falls back to a generic line when there are no evaluated dimensions', () => {
    expect(verdictSummary(result([]))).toBe('Mixed evidence across the evaluated areas.')
  })

  it('excludes the manual package_source dimension from the takeaway', () => {
    // A fork's package_source is `mixed`, but it must not inject "mixed package
    // source" into the auto-six takeaway (an honest fork is not a weakness).
    expect(
      verdictSummary(
        result([dim('provenance', 'strong'), dim('transparency', 'strong'), dim('package_source', 'mixed')]),
      ),
    ).toBe('Strong provenance and transparency.')
  })
})
