import { describe, it, expect, vi, afterEach } from 'vitest'
import { createGithubClient } from './githubClient'
import type { SupportedRepo } from '../content/parseRepoContext'

const target: SupportedRepo = { kind: 'repo', owner: 'o', repo: 'r' }

// Minimal Response stand-in for the one global `fetch` getJson calls. Typed
// args so `mock.calls[i]` is `[string, RequestInit]` for the header assertions.
const mockFetch = (status: number, body: unknown) =>
  vi.fn(async (_url: string, _init: RequestInit) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    json: async () => body,
  }))

afterEach(() => vi.unstubAllGlobals())

describe('createGithubClient().fetchReleases', () => {
  it('returns the releases array on a normal 200', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [{ tag_name: 'v1' }]))
    expect(await createGithubClient().fetchReleases(target)).toEqual({
      ok: true,
      releases: [{ tag_name: 'v1' }],
    })
  })

  it('degrades a 200 with a non-array body to empty releases (so the scorer never sees a non-array)', async () => {
    // GitHub can answer 200 with an error/object body via proxies or edge cases;
    // an unguarded cast would make releases.filter() throw and sink the analysis.
    vi.stubGlobal('fetch', mockFetch(200, { message: 'something', documentation_url: 'x' }))
    expect(await createGithubClient().fetchReleases(target)).toEqual({ ok: true, releases: [] })
  })

  it('drops null/non-object elements from the array (so the scorer never derefs a non-object)', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [null, { tag_name: 'v1' }, 'oops', 42]))
    expect(await createGithubClient().fetchReleases(target)).toEqual({
      ok: true,
      releases: [{ tag_name: 'v1' }],
    })
  })

  it('passes a 404 through as a not_found failure', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}))
    expect(await createGithubClient().fetchReleases(target)).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('createGithubClient().fetchContributors', () => {
  it('keeps only well-formed contributor objects, dropping malformed elements', async () => {
    // Only the first is a valid GithubContributor; the rest must be filtered so a
    // string `contributions` can't skew the governance share math.
    vi.stubGlobal(
      'fetch',
      mockFetch(200, [
        { login: 'a', type: 'User', contributions: 50 },
        { login: 'b', type: 'User', contributions: '5' }, // wrong-typed
        { login: 'c' }, // missing fields
        null,
      ]),
    )
    expect(await createGithubClient().fetchContributors(target)).toEqual({
      ok: true,
      contributors: [{ login: 'a', type: 'User', contributions: 50 }],
    })
  })

  it('degrades a non-array 200 body to empty contributors (e.g. a 202 "computing" object)', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { message: 'computing' }))
    expect(await createGithubClient().fetchContributors(target)).toEqual({ ok: true, contributors: [] })
  })
})

describe('createGithubClient() rate-limit / transient mapping', () => {
  it('maps a 403 with x-ratelimit-remaining: 0 to a rate_limited failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        status: 403,
        ok: false,
        headers: {
          get: (h: string) =>
            h === 'x-ratelimit-remaining' ? '0' : h === 'x-ratelimit-reset' ? '1700' : null,
        },
        json: async () => ({}),
      })),
    )
    const res = await createGithubClient().fetchRepo(target)
    expect(res).toMatchObject({ ok: false, reason: 'rate_limited', resetAt: 1700 * 1000 })
  })

  it('maps a non-404/non-rate-limit error status to a transient failure', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}))
    expect(await createGithubClient().fetchRepo(target)).toEqual({ ok: false, reason: 'transient' })
  })

  it('maps a thrown fetch (network/abort) to a transient failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    expect(await createGithubClient().fetchRepo(target)).toEqual({ ok: false, reason: 'transient' })
  })
})

describe('createGithubClient authorization header (security guard)', () => {
  it('attaches Authorization: Bearer <token> when constructed with a token', async () => {
    const fetchMock = mockFetch(200, { full_name: 'o/r' })
    vi.stubGlobal('fetch', fetchMock)

    await createGithubClient('ghp_token').fetchRepo(target)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer ghp_token')
  })

  it('sends NO Authorization header when constructed without a token', async () => {
    const fetchMock = mockFetch(200, { full_name: 'o/r' })
    vi.stubGlobal('fetch', fetchMock)

    await createGithubClient().fetchRepo(target)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect('Authorization' in headers).toBe(false)
  })

  it('sends NO Authorization header for a whitespace-only token (no malformed Bearer)', async () => {
    const fetchMock = mockFetch(200, { full_name: 'o/r' })
    vi.stubGlobal('fetch', fetchMock)

    await createGithubClient('   ').fetchRepo(target)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect('Authorization' in headers).toBe(false)
  })

  it('trims a padded token so the Bearer credential is well-formed', async () => {
    const fetchMock = mockFetch(200, { full_name: 'o/r' })
    vi.stubGlobal('fetch', fetchMock)

    await createGithubClient('  ghp_token\n').fetchRepo(target)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer ghp_token')
  })

  it('only ever sends the token to the https://api.github.com host', async () => {
    const fetchMock = mockFetch(200, { full_name: 'o/r' })
    vi.stubGlobal('fetch', fetchMock)

    await createGithubClient('ghp_token').fetchRepo(target)

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url.startsWith('https://api.github.com')).toBe(true)
  })

  it('keeps the GitHub Accept header on every request', async () => {
    const fetchMock = mockFetch(200, { full_name: 'o/r' })
    vi.stubGlobal('fetch', fetchMock)

    await createGithubClient('ghp_token').fetchRepo(target)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Accept).toBe('application/vnd.github+json')
  })
})
