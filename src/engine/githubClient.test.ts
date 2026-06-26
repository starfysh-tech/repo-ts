import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchReleasesLive } from './githubClient'
import type { SupportedRepo } from '../content/parseRepoContext'

const target: SupportedRepo = { kind: 'repo', owner: 'o', repo: 'r' }

// Minimal Response stand-in for the one global `fetch` getJson calls.
const mockFetch = (status: number, body: unknown) =>
  vi.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    json: async () => body,
  }))

afterEach(() => vi.unstubAllGlobals())

describe('fetchReleasesLive', () => {
  it('returns the releases array on a normal 200', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [{ tag_name: 'v1' }]))
    expect(await fetchReleasesLive(target)).toEqual({ ok: true, releases: [{ tag_name: 'v1' }] })
  })

  it('degrades a 200 with a non-array body to empty releases (so the scorer never sees a non-array)', async () => {
    // GitHub can answer 200 with an error/object body via proxies or edge cases;
    // an unguarded cast would make releases.filter() throw and sink the analysis.
    vi.stubGlobal('fetch', mockFetch(200, { message: 'something', documentation_url: 'x' }))
    expect(await fetchReleasesLive(target)).toEqual({ ok: true, releases: [] })
  })

  it('passes a 404 through as a not_found failure', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await fetchReleasesLive(target)).toEqual({ ok: false, reason: 'not_found' })
  })
})
