import { describe, it, expect } from 'vitest'
import { scoreGovernance } from './governance'
import type { GithubContributor } from './types'
import type { SupportedRepo } from '../content/parseRepoContext'

const target: SupportedRepo = { kind: 'repo', owner: 'o', repo: 'r' }

// Concise builders so each case reads as its contributor shape, not boilerplate.
const usr = (login: string, contributions: number): GithubContributor => ({
  login,
  type: 'User',
  contributions,
})
const bot = (login: string, contributions: number): GithubContributor => ({
  login,
  type: 'Bot',
  contributions,
})

// An even spread of N users, each with the same number of commits.
const evenUsers = (count: number, each = 10): GithubContributor[] =>
  Array.from({ length: count }, (_, i) => usr(`u${i}`, each))

describe('scoreGovernance', () => {
  it('returns unknown with no evidence for an empty array', () => {
    const r = scoreGovernance([], target)
    expect(r.dimension.dimension_state).toBe('unknown')
    expect(r.hasEvidence).toBe(false)
    expect(r.flags).toEqual([])
  })

  it('returns unknown for a single contributor (no distribution to judge)', () => {
    const r = scoreGovernance([usr('solo', 200)], target)
    expect(r.dimension.dimension_state).toBe('unknown')
    expect(r.flags).toEqual([])
  })

  it('reads a broad, even group of users as strong', () => {
    const r = scoreGovernance(evenUsers(6), target)
    expect(r.dimension.dimension_state).toBe('strong')
    expect(r.flags).toEqual([])
  })

  it('reads a single dominant contributor (95% of commits) as weak', () => {
    const r = scoreGovernance([usr('boss', 95), usr('a', 3), usr('b', 2)], target)
    expect(r.dimension.dimension_state).toBe('weak')
    expect(r.flags).toEqual([])
  })

  it('reads a small, non-dominated group as mixed', () => {
    const r = scoreGovernance([usr('a', 40), usr('b', 35), usr('c', 25)], target)
    expect(r.dimension.dimension_state).toBe('mixed')
    expect(r.flags).toEqual([])
  })

  it('excludes bots: 6 even users plus bots still scores strong on the users', () => {
    const r = scoreGovernance([...evenUsers(6), bot('dependabot', 500), bot('renovate', 400)], target)
    expect(r.dimension.dimension_state).toBe('strong')
    expect(r.flags).toEqual([])
  })

  it('excludes bots: a lone user among bots is unknown (only one real contributor)', () => {
    const r = scoreGovernance([usr('solo', 50), bot('dependabot', 999)], target)
    expect(r.dimension.dimension_state).toBe('unknown')
    expect(r.flags).toEqual([])
  })
})
