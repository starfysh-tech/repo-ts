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
  it('names the strengths when all evaluated dimensions are strong', () => {
    expect(
      verdictSummary(result([dim('provenance', 'strong'), dim('security', 'mixed'), dim('transparency', 'strong')])),
    ).toBe('Strong provenance and transparency.')
  })

  it('contrasts strengths against gaps', () => {
    expect(
      verdictSummary(result([dim('provenance', 'mixed'), dim('security', 'unknown'), dim('transparency', 'strong')])),
    ).toBe('Strong transparency, but limited security hygiene.')
  })

  it('leads with a high-severity flag', () => {
    expect(
      verdictSummary(
        result([dim('provenance', 'mixed')], [{ key: 'archived', severity: 'high', label: 'Repository is archived' }]),
      ),
    ).toBe('Repository is archived.')
  })

  it('falls back when nothing stands out', () => {
    expect(verdictSummary(result([dim('provenance', 'mixed'), dim('security', 'mixed')]))).toBe(
      'Mixed evidence across the evaluated areas.',
    )
  })
})
