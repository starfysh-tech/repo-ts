import { describe, it, expect, vi, afterEach } from 'vitest'
import { getSettings, setPat, clearPat } from './settings'

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
