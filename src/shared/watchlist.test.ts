import { describe, it, expect } from 'vitest'
import { hasEntry, removeEntry, upsertEntry, type WatchlistEntry } from './watchlist'
import type { AnalysisResult } from '../engine/types'

const entry = (owner: string, repo: string, trust = 'mixed_signals'): WatchlistEntry => ({
  owner,
  repo,
  result: { trust_state: trust } as unknown as AnalysisResult,
})

describe('watchlist list operations', () => {
  it('adds a new entry', () => {
    const list = upsertEntry([], entry('facebook', 'react'))
    expect(list).toHaveLength(1)
    expect(hasEntry(list, 'facebook', 'react')).toBe(true)
  })

  it('replaces an existing entry in place rather than duplicating', () => {
    const list = upsertEntry([entry('tj', 'commander.js', 'mixed_signals')], entry('tj', 'commander.js', 'strong_signals'))
    expect(list).toHaveLength(1)
    expect((list[0].result as { trust_state: string }).trust_state).toBe('strong_signals')
  })

  it('removes an entry', () => {
    const list = removeEntry([entry('a', 'b'), entry('c', 'd')], 'a', 'b')
    expect(list).toHaveLength(1)
    expect(hasEntry(list, 'a', 'b')).toBe(false)
    expect(hasEntry(list, 'c', 'd')).toBe(true)
  })

  it('hasEntry is owner+repo specific', () => {
    const list = [entry('a', 'b')]
    expect(hasEntry(list, 'a', 'b')).toBe(true)
    expect(hasEntry(list, 'a', 'x')).toBe(false)
  })
})
