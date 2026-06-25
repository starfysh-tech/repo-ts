import type { SupportedRepo } from '../content/parseRepoContext'
import type { GithubRepo, RepoFetchResult } from './types'

const API = 'https://api.github.com'

/**
 * The live network implementation of the fetch seam, used by the background
 * worker. `fetch` follows redirects by default, which transparently handles
 * renamed/moved repos that 301 on the old path (verified in spike 01) — do not
 * set `redirect: 'manual'`. Status codes map to the analysis outcomes:
 * 404 → private/unsupported, 403 + exhausted budget → rate-limited.
 */
export async function fetchRepoLive(target: SupportedRepo): Promise<RepoFetchResult> {
  let res: Response
  try {
    res = await fetch(`${API}/repos/${target.owner}/${target.repo}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
  } catch {
    return { ok: false, reason: 'transient' }
  }

  if (res.status === 404) return { ok: false, reason: 'not_found' }

  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    return { ok: false, reason: 'rate_limited', resetAt: Number.isFinite(reset) ? reset * 1000 : 0 }
  }

  if (!res.ok) return { ok: false, reason: 'transient' }

  try {
    const repo = (await res.json()) as GithubRepo
    return { ok: true, repo }
  } catch {
    return { ok: false, reason: 'transient' }
  }
}
