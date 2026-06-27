import { describe, it, expect } from 'vitest'
import { detectManufacturedCredibility } from './manufacturedCredibility'
import { DEFAULT_SCORING_CONFIG } from './config'
import type { DimensionContribution, DimensionKey, DimensionState, GithubRepo } from './types'

const now = new Date('2026-06-24T00:00:00Z')

// A repo created `ageDays` before `now`; only created_at matters to the guard.
const repoAged = (ageDays: number): GithubRepo => {
  const created = new Date(now.getTime() - ageDays * 24 * 60 * 60 * 1000).toISOString()
  return {
    full_name: 'o/r', private: false, archived: false, disabled: false, fork: false,
    license: { key: 'mit', spdx_id: 'MIT' }, owner: { type: 'User', login: 'o' },
    created_at: created, pushed_at: created, homepage: null, topics: [], description: null,
  }
}

const dim = (key: DimensionKey, state: DimensionState): DimensionContribution => ({
  dimension: {
    dimension_key: key, dimension_state: state, confidence_state: 'high',
    triggered_signals: [], evidence_links: [], rationale_segments: [],
  },
  hasEvidence: true, flags: [], positives: [],
})

// The implausible "house": every maturity signal strong on a <30d repo.
const allMaturityStrong: DimensionContribution[] = [
  dim('release', 'strong'),
  dim('governance', 'strong'),
  dim('responsiveness', 'strong'),
]

describe('detectManufacturedCredibility', () => {
  it('fires a medium caveat when a very-new repo has all three maturity signals strong', () => {
    const flag = detectManufacturedCredibility(allMaturityStrong, repoAged(10), now)
    expect(flag).not.toBeNull()
    expect(flag?.key).toBe('manufactured-credibility')
    expect(flag?.severity).toBe('medium') // never high — archived stays the only caution trigger
  })

  it('does not fire on an established repo, however active', () => {
    expect(detectManufacturedCredibility(allMaturityStrong, repoAged(400), now)).toBeNull()
  })

  it('does not fire when only two maturity signals are strong (normal early activity)', () => {
    const twoStrong = [
      dim('release', 'strong'),
      dim('governance', 'strong'),
      dim('responsiveness', 'mixed'),
    ]
    expect(detectManufacturedCredibility(twoStrong, repoAged(10), now)).toBeNull()
  })

  it('does not fire when a maturity signal is merely present but not strong', () => {
    const mixedResponsiveness = [
      dim('release', 'strong'),
      dim('governance', 'strong'),
      dim('responsiveness', 'unknown'),
    ]
    expect(detectManufacturedCredibility(mixedResponsiveness, repoAged(5), now)).toBeNull()
  })

  it('treats exactly VERY_NEW_DAYS (30) as no-longer-very-new (boundary)', () => {
    expect(detectManufacturedCredibility(allMaturityStrong, repoAged(30), now)).toBeNull()
  })

  it('does not fire when sensitivity is off, even with all three strong', () => {
    const config = {
      ...DEFAULT_SCORING_CONFIG,
      manufacturedGuard: { sensitivity: 'off' as const, severity: 'medium' as const },
    }
    expect(detectManufacturedCredibility(allMaturityStrong, repoAged(10), now, config)).toBeNull()
  })

  it('fires under any-2-of-3 with exactly two maturity signals strong', () => {
    const config = {
      ...DEFAULT_SCORING_CONFIG,
      manufacturedGuard: { sensitivity: 'any-2-of-3' as const, severity: 'medium' as const },
    }
    const twoStrong = [
      dim('release', 'strong'),
      dim('governance', 'strong'),
      dim('responsiveness', 'mixed'),
    ]
    const flag = detectManufacturedCredibility(twoStrong, repoAged(10), now, config)
    expect(flag).not.toBeNull()
    expect(flag?.key).toBe('manufactured-credibility')
  })

  it('maps severity "caution" to a high-severity flag (overrides archived-only caution rule)', () => {
    const config = {
      ...DEFAULT_SCORING_CONFIG,
      manufacturedGuard: { sensitivity: 'all-3' as const, severity: 'caution' as const },
    }
    const flag = detectManufacturedCredibility(allMaturityStrong, repoAged(10), now, config)
    expect(flag?.severity).toBe('high')
  })

  it('maps severity "note" to a low-severity flag', () => {
    const config = {
      ...DEFAULT_SCORING_CONFIG,
      manufacturedGuard: { sensitivity: 'all-3' as const, severity: 'note' as const },
    }
    const flag = detectManufacturedCredibility(allMaturityStrong, repoAged(10), now, config)
    expect(flag?.severity).toBe('low')
  })
})
