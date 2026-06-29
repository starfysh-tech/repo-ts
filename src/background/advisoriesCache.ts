import type { SupportedRepo } from '../content/parseRepoContext'
import type { AdvisoriesResult } from '../engine/advisoriesClient'

// A SEPARATE store from the analysis/verdict cache (cache.ts). Advisories are not
// a dimension and must never touch the maintenance verdict, so they get their own
// keyspace and their own entry per repo. The result carries its own `asOf`, so the
// panel can show the point-in-time it reflects; a manual re-check simply re-fetches
// and overwrites this entry.
//
// We persist ONLY the stable facts — `ok` (a real point-in-time scan) and
// `no_dependency_data` (a structural fact about the repo). `unavailable` is a
// transient "couldn't check" non-event and is NEVER cached: caching it would turn
// a momentary backend blip into a sticky empty state.
export function cacheKey(target: SupportedRepo): string {
  return `advisories:${target.owner.toLowerCase()}/${target.repo.toLowerCase()}`
}

/** Validate untrusted storage at the read seam: an entry from a corrupted write
 *  or an older schema must never reach the UI as a malformed `AdvisoriesResult`
 *  (the panel would deref `.advisories` on it and crash). Only the two persisted
 *  shapes are accepted; anything else is treated as a cache miss. */
function isCachedResult(v: unknown): v is AdvisoriesResult {
  if (!v || typeof v !== 'object') return false
  const r = v as { status?: unknown; advisories?: unknown }
  if (r.status === 'no_dependency_data') return true
  return r.status === 'ok' && Array.isArray(r.advisories)
}

export async function readAdvisoriesCache(target: SupportedRepo): Promise<AdvisoriesResult | null> {
  const key = cacheKey(target)
  const stored = await chrome.storage.local.get(key)
  return isCachedResult(stored[key]) ? (stored[key] as AdvisoriesResult) : null
}

export async function writeAdvisoriesCache(
  target: SupportedRepo,
  result: AdvisoriesResult,
): Promise<void> {
  // Guard the persistence rule here too (not only at the call site) so the cache
  // can't be poisoned with a transient state from any caller.
  if (result.status !== 'ok' && result.status !== 'no_dependency_data') return
  await chrome.storage.local.set({ [cacheKey(target)]: result })
}
