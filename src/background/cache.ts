import type { SupportedRepo } from '../content/parseRepoContext'
import type { AnalysisResult } from '../engine/types'
import { CACHE_TTL_MS, SCORE_VERSION } from '../engine/config'

// Per-repo analysis cache in chrome.storage.local. Keyed by owner/repo AND
// score_version, so a scoring-rules bump (new SCORE_VERSION) naturally
// invalidates every prior entry — old-version keys are simply never read again.
export function cacheKey(target: SupportedRepo): string {
  return `analysis:${target.owner}/${target.repo}:${SCORE_VERSION}`
}

/** A cached result is fresh while it is within the TTL of the reference time. */
export function isFresh(result: AnalysisResult, now: Date): boolean {
  return now.getTime() - new Date(result.analyzed_at).getTime() < CACHE_TTL_MS
}

/** Returns a cached result only if present AND still within TTL; otherwise null
 *  (a stale entry is treated as a miss and will be re-analyzed). */
export async function readCache(target: SupportedRepo, now: Date): Promise<AnalysisResult | null> {
  const key = cacheKey(target)
  const stored = await chrome.storage.local.get(key)
  const result = stored[key] as AnalysisResult | undefined
  if (!result || !isFresh(result, now)) return null
  return result
}

export async function writeCache(target: SupportedRepo, result: AnalysisResult): Promise<void> {
  await chrome.storage.local.set({ [cacheKey(target)]: result })
}
