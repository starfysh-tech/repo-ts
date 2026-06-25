import type { SupportedRepo } from '../content/parseRepoContext'
import type { CommunityFetchResult, CommunityProfileRaw, GithubRepo, RepoFetchResult } from './types'

const API = 'https://api.github.com'
const TIMEOUT_MS = 10_000

type FetchFailure = { reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }
type JsonResult = { ok: true; data: unknown } | ({ ok: false } & FetchFailure)

/**
 * Shared GitHub GET. `fetch` follows redirects by default, which transparently
 * handles renamed/moved repos that 301 on the old path (verified in spike 01) —
 * do not set `redirect: 'manual'`. The request is bounded by a timeout so a
 * stalled connection surfaces as a retryable transient state.
 */
async function getJson(path: string): Promise<JsonResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      headers: { Accept: 'application/vnd.github+json' },
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

export async function fetchRepoLive(target: SupportedRepo): Promise<RepoFetchResult> {
  const res = await getJson(`/repos/${target.owner}/${target.repo}`)
  return res.ok ? { ok: true, repo: res.data as GithubRepo } : res
}

export async function fetchCommunityProfileLive(target: SupportedRepo): Promise<CommunityFetchResult> {
  const res = await getJson(`/repos/${target.owner}/${target.repo}/community/profile`)
  return res.ok ? { ok: true, profile: res.data as CommunityProfileRaw } : res
}
