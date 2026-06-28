import type { SupportedRepo } from '../content/parseRepoContext'
import type {
  CommunityFetchResult,
  CommunityProfileRaw,
  ContributorsFetchResult,
  GithubContributor,
  GithubIssue,
  GithubPull,
  GithubRelease,
  GithubRepo,
  IssuesFetchResult,
  PullsFetchResult,
  ReleasesFetchResult,
  RepoFetchResult,
} from './types'

const API = 'https://api.github.com'
const TIMEOUT_MS = 10_000

type FetchFailure = { reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }
type JsonResult = { ok: true; data: unknown } | ({ ok: false } & FetchFailure)

/**
 * Token-aware GitHub client factory. The optional `token` is captured in a
 * single closure (`getJson`) so every fetcher is forced to route through the
 * one token-aware request path — there is no way to call a fetcher that bypasses
 * the Authorization header wiring, which keeps the credential-handling surface
 * to exactly one function.
 *
 * SECURITY: the token is sent only via this `getJson`, which only ever fetches
 * `${API}${path}` where `API` is the hardcoded `https://api.github.com` base
 * over HTTPS. It is never logged (no `console.*` touches it).
 */
export function createGithubClient(token?: string) {
  /**
   * Shared GitHub GET. `fetch` follows redirects by default, which transparently
   * handles renamed/moved repos that 301 on the old path (verified in spike 01) —
   * do not set `redirect: 'manual'`. The request is bounded by a timeout so a
   * stalled connection surfaces as a retryable transient state.
   */
  async function getJson(path: string): Promise<JsonResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
    // Attach the bearer credential only here, only for the hardcoded GitHub API
    // base over HTTPS. Never logged. Trim defensively: this is the public seam,
    // so a direct caller (or a future one) passing a whitespace/newline-padded
    // token must not produce a malformed `Bearer ` header that 401s and then
    // silently degrades to `transient` instead of unauthenticated access.
    const trimmedToken = token?.trim()
    if (trimmedToken) {
      headers.Authorization = `Bearer ${trimmedToken}`
    }

    let res: Response
    try {
      res = await fetch(`${API}${path}`, {
        headers,
        signal: controller.signal,
      })
    } catch {
      return { ok: false, reason: 'transient' }
    } finally {
      clearTimeout(timeout)
    }

    if (res.status === 404) return { ok: false, reason: 'not_found' }
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = Number(res.headers.get('x-ratelimit-reset'))
      return { ok: false, reason: 'rate_limited', resetAt: Number.isFinite(reset) ? reset * 1000 : 0 }
    }
    if (!res.ok) return { ok: false, reason: 'transient' }

    try {
      return { ok: true, data: await res.json() }
    } catch {
      return { ok: false, reason: 'transient' }
    }
  }

  async function fetchRepo(target: SupportedRepo): Promise<RepoFetchResult> {
    const res = await getJson(`/repos/${target.owner}/${target.repo}`)
    return res.ok ? { ok: true, repo: res.data as GithubRepo } : res
  }

  async function fetchCommunityProfile(target: SupportedRepo): Promise<CommunityFetchResult> {
    const res = await getJson(`/repos/${target.owner}/${target.repo}/community/profile`)
    return res.ok ? { ok: true, profile: res.data as CommunityProfileRaw } : res
  }

  async function fetchReleases(target: SupportedRepo): Promise<ReleasesFetchResult> {
    const res = await getJson(`/repos/${target.owner}/${target.repo}/releases?per_page=10`)
    if (!res.ok) return res
    // A 200 with a non-array body (an error object, a proxy's HTML) — or an array
    // carrying null/non-object elements — must not reach scoreRelease, where
    // releases.filter() would throw and sink the whole analysis. Keep only object
    // elements; degrade anything else to no release evidence.
    const raw = Array.isArray(res.data) ? res.data : []
    const releases = raw.filter((r): r is GithubRelease => r != null && typeof r === 'object')
    return { ok: true, releases }
  }

  async function fetchContributors(target: SupportedRepo): Promise<ContributorsFetchResult> {
    const res = await getJson(`/repos/${target.owner}/${target.repo}/contributors?per_page=10`)
    if (!res.ok) return res
    const raw = Array.isArray(res.data) ? res.data : []
    // Field-validate at the read seam: a malformed element (e.g. a string
    // `contributions`) would otherwise skew the governance share math. Only
    // well-formed contributors reach the scorer.
    const contributors = raw.filter(
      (c): c is GithubContributor =>
        c != null &&
        typeof c === 'object' &&
        typeof (c as GithubContributor).login === 'string' &&
        typeof (c as GithubContributor).type === 'string' &&
        typeof (c as GithubContributor).contributions === 'number',
    )
    return { ok: true, contributors }
  }

  async function fetchIssues(target: SupportedRepo): Promise<IssuesFetchResult> {
    const res = await getJson(
      `/repos/${target.owner}/${target.repo}/issues?state=closed&sort=updated&direction=desc&per_page=10`,
    )
    if (!res.ok) return res
    const raw = Array.isArray(res.data) ? res.data : []
    const issues = raw.filter((i): i is GithubIssue => i != null && typeof i === 'object')
    return { ok: true, issues }
  }

  async function fetchPulls(target: SupportedRepo): Promise<PullsFetchResult> {
    const res = await getJson(
      `/repos/${target.owner}/${target.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=10`,
    )
    if (!res.ok) return res
    const raw = Array.isArray(res.data) ? res.data : []
    const pulls = raw.filter((p): p is GithubPull => p != null && typeof p === 'object')
    return { ok: true, pulls }
  }

  /**
   * Root `package.json` for the manual package-source check. Returns the parsed
   * manifest, or null when absent/unreadable (a missing manifest is "no package",
   * never an error). The contents API returns base64 with embedded newlines, so
   * strip whitespace before decoding.
   */
  async function fetchPackageJson(target: SupportedRepo): Promise<unknown | null> {
    const res = await getJson(`/repos/${target.owner}/${target.repo}/contents/package.json`)
    if (!res.ok) return null
    const body = res.data as { content?: unknown; encoding?: unknown }
    if (typeof body?.content !== 'string') return null
    try {
      // Decode base64 → bytes → UTF-8 (not `atob` directly, which is Latin-1 and
      // would mojibake any non-ASCII field in the manifest).
      const bytes = Uint8Array.from(atob(body.content.replace(/\s/g, '')), (c) => c.charCodeAt(0))
      return JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      return null
    }
  }

  return {
    fetchRepo,
    fetchCommunityProfile,
    fetchReleases,
    fetchContributors,
    fetchIssues,
    fetchPulls,
    fetchPackageJson,
  }
}
