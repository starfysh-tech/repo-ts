import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getWatchlist,
  hasEntry,
  isWatched,
  removeEntry,
  removeFromWatchlist,
  saveToWatchlist,
  updateIfPresent,
  upsertEntry,
  type WatchlistEntry,
} from './watchlist'
import type { AnalysisResult } from '../engine/types'
import type { SupportedRepo } from '../content/parseRepoContext'

const entry = (owner: string, repo: string, trust = 'mixed_signals'): WatchlistEntry => ({
  owner,
  repo,
  result: { trust_state: trust } as unknown as AnalysisResult,
})

// Minimal chrome.storage.local stand-in over an in-memory object, matching the
// promise-returning API surface the wrappers use.
const stubChromeStorage = (initial: Record<string, unknown> = {}) => {
  const store: Record<string, unknown> = { ...initial }
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (obj: Record<string, unknown>) => {
          Object.assign(store, obj)
        },
      },
    },
  })
  return store
}

const target = (owner: string, repo: string): SupportedRepo => ({ kind: 'repo', owner, repo })

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

  it('updateIfPresent refreshes an existing entry but never resurrects a removed one', () => {
    const present = updateIfPresent([entry('a', 'b', 'mixed_signals')], entry('a', 'b', 'strong_signals'))
    expect((present[0].result as { trust_state: string }).trust_state).toBe('strong_signals')

    const absent = updateIfPresent([entry('c', 'd')], entry('a', 'b', 'strong_signals'))
    expect(hasEntry(absent, 'a', 'b')).toBe(false)
    expect(absent).toHaveLength(1)
  })
})

describe('watchlist storage (chrome.storage.local)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns an empty list when nothing is stored', async () => {
    stubChromeStorage()
    expect(await getWatchlist()).toEqual([])
  })

  it('degrades a corrupt non-array stored value to an empty list (never throws)', async () => {
    // A corrupted/older-schema value could be an object; getWatchlist must not
    // hand a non-array to the page, where .map/.length would break.
    stubChromeStorage({ watchlist: { not: 'an array' } })
    expect(await getWatchlist()).toEqual([])
  })

  it('filters out entries missing owner or repo before returning', async () => {
    stubChromeStorage({
      watchlist: [entry('facebook', 'react'), { repo: 'orphan' }, { owner: 'orphan' }, null],
    })
    const list = await getWatchlist()
    expect(list).toHaveLength(1)
    expect(hasEntry(list, 'facebook', 'react')).toBe(true)
  })

  it('round-trips save → isWatched → remove through storage', async () => {
    stubChromeStorage()
    const t = target('tj', 'commander.js')
    expect(await isWatched(t)).toBe(false)

    await saveToWatchlist(t, { trust_state: 'strong_signals' } as unknown as AnalysisResult)
    expect(await isWatched(t)).toBe(true)
    expect(await getWatchlist()).toHaveLength(1)

    await removeFromWatchlist('tj', 'commander.js')
    expect(await isWatched(t)).toBe(false)
  })
})
