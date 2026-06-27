import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getSettings,
  setPat,
  clearPat,
  setScoringPreset,
  setScoringOverrides,
  clearScoringOverride,
  resetScoring,
} from './settings'

// Minimal chrome.storage.local stand-in over an in-memory object, mirroring
// watchlist.test.ts. `remove` is added because clearPat must drop a single key
// while preserving the rest of the settings object.
const stubChromeStorage = (initial: Record<string, unknown> = {}) => {
  const store: Record<string, unknown> = { ...initial }
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
        set: async (obj: Record<string, unknown>) => {
          Object.assign(store, obj)
        },
        remove: async (key: string) => {
          delete store[key]
        },
      },
    },
  })
  return store
}

afterEach(() => vi.unstubAllGlobals())

describe('settings storage (chrome.storage.local)', () => {
  it('round-trips a PAT through setPat → getSettings', async () => {
    stubChromeStorage()
    await setPat('ghp_abc')
    expect(await getSettings()).toEqual({ pat: 'ghp_abc' })
  })

  it('trims surrounding whitespace before storing the PAT', async () => {
    stubChromeStorage()
    await setPat('  ghp_abc  ')
    expect(await getSettings()).toEqual({ pat: 'ghp_abc' })
  })

  it('clearPat removes the PAT so getSettings reports no pat key', async () => {
    stubChromeStorage()
    await setPat('ghp_abc')
    await clearPat()
    const settings = await getSettings()
    expect(settings).toEqual({})
    expect('pat' in settings).toBe(false)
  })

  it('clearPat preserves other settings keys while dropping the PAT', async () => {
    const store = stubChromeStorage({ settings: { pat: 'x', other: 1 } })
    await clearPat()
    expect((store.settings as Record<string, unknown>).other).toBe(1)
    expect((store.settings as Record<string, unknown>).pat).toBeUndefined()
  })

  it('treats setPat with an empty string like clearPat (no pat surfaced)', async () => {
    stubChromeStorage()
    await setPat('ghp_abc')
    await setPat('')
    expect(await getSettings()).toEqual({})
  })

  it('treats setPat with a whitespace-only string like clearPat (no pat surfaced)', async () => {
    stubChromeStorage()
    await setPat('ghp_abc')
    await setPat('   ')
    expect(await getSettings()).toEqual({})
  })

  it('degrades a non-object stored value to empty settings without throwing', async () => {
    stubChromeStorage({ settings: 'corrupt-string' })
    expect(await getSettings()).toEqual({})
  })

  it('degrades a null stored value to empty settings without throwing', async () => {
    stubChromeStorage({ settings: null })
    expect(await getSettings()).toEqual({})
  })

  it('omits a non-string pat from a hardened read', async () => {
    stubChromeStorage({ settings: { pat: 42 } })
    const settings = await getSettings()
    expect('pat' in settings).toBe(false)
  })
})

describe('scoring settings', () => {
  it('round-trips a preset through setScoringPreset → getSettings', async () => {
    stubChromeStorage()
    await setScoringPreset('cautious')
    expect((await getSettings()).scoringPreset).toBe('cautious')
  })

  it('setScoringPreset clears any stored overrides', async () => {
    stubChromeStorage({ settings: { scoringOverrides: { veryNewDays: 5 } } })
    await setScoringPreset('minimal')
    const settings = await getSettings()
    expect(settings.scoringPreset).toBe('minimal')
    expect('scoringOverrides' in settings).toBe(false)
  })

  it('setScoringPreset preserves a sibling PAT', async () => {
    stubChromeStorage({ settings: { pat: 'ghp_x' } })
    await setScoringPreset('cautious')
    expect((await getSettings()).pat).toBe('ghp_x')
  })

  it('setScoringOverrides merges onto existing overrides instead of replacing', async () => {
    stubChromeStorage()
    await setScoringOverrides({ veryNewDays: 1 })
    await setScoringOverrides({ govDistributedMin: 9 })
    const overrides = (await getSettings()).scoringOverrides
    expect(overrides).toEqual({ veryNewDays: 1, govDistributedMin: 9 })
  })

  it('getSettings omits an invalid preset', async () => {
    stubChromeStorage({ settings: { scoringPreset: 'bogus' } })
    expect((await getSettings()).scoringPreset).toBeUndefined()
  })

  it('getSettings omits a non-object scoringOverrides', async () => {
    stubChromeStorage({ settings: { scoringOverrides: 'nope' } })
    expect((await getSettings()).scoringOverrides).toBeUndefined()
  })

  it('resetScoring drops preset + overrides but preserves the PAT', async () => {
    stubChromeStorage({
      settings: { pat: 'ghp_x', scoringPreset: 'cautious', scoringOverrides: { veryNewDays: 1 } },
    })
    await resetScoring()
    expect(await getSettings()).toEqual({ pat: 'ghp_x' })
  })

  it('clearScoringOverride drops one knob, preserving the preset + other overrides', async () => {
    stubChromeStorage({
      settings: {
        scoringPreset: 'cautious',
        scoringOverrides: { veryNewDays: 1, govDistributedMin: 9 },
      },
    })
    await clearScoringOverride('veryNewDays')
    expect(await getSettings()).toEqual({
      scoringPreset: 'cautious',
      scoringOverrides: { govDistributedMin: 9 },
    })
  })

  it('clearScoringOverride removes the overrides object once the last knob is cleared', async () => {
    stubChromeStorage({
      settings: { pat: 'ghp_x', scoringPreset: 'cautious', scoringOverrides: { veryNewDays: 1 } },
    })
    await clearScoringOverride('veryNewDays')
    // The preset and PAT survive; the now-empty overrides object is gone so the
    // stance reads as un-customized.
    expect(await getSettings()).toEqual({ pat: 'ghp_x', scoringPreset: 'cautious' })
  })
})
