import { describe, it, expect } from 'vitest'
import { findWholeWord } from './DimensionRow'

describe('findWholeWord (evidence-link inlining)', () => {
  it('matches case-insensitively so a label folds into lowercase rationale text', () => {
    // The bug this fixes: label "Security policy" vs rationale "...a security policy."
    expect(findWholeWord('Publishes a security policy.', 'Security policy')).toBe(12)
    expect(findWholeWord('Has a README.', 'README')).toBe(6)
  })

  it('only matches whole words, never mid-word', () => {
    expect(findWholeWord('Ships READMEs for each module', 'README')).toBe(-1)
    expect(findWholeWord('the unreadme file', 'README')).toBe(-1)
  })

  it('returns -1 when the label is absent or empty', () => {
    expect(findWholeWord('Licensed, organization-owned.', 'README')).toBe(-1)
    expect(findWholeWord('anything', '')).toBe(-1)
  })
})
