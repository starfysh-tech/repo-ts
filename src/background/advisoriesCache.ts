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

export async function readAdvisoriesCache(target: SupportedRepo): Promise<AdvisoriesResult | null> {
  const key = cacheKey(target)
  const stored = await chrome.storage.local.get(key)
  const result = stored[key] as AdvisoriesResult | undefined
  return result ?? null
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
