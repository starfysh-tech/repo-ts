import type { SupportedRepo } from '../content/parseRepoContext'
import type { AnalysisResult } from '../engine/types'
import { CACHE_TTL_MS, SCORE_VERSION } from '../engine/config'

// Per-repo analysis cache in chrome.storage.local. Keyed by owner/repo, the
// score_version, AND a hash of the active scoring config — so a scoring-rules bump
// (new SCORE_VERSION) OR a config value change naturally invalidates prior entries:
// old keys are simply never read again. `configHash` comes from `hashConfig(config)`.
export function cacheKey(target: SupportedRepo, configHash: string): string {
  return `analysis:${target.owner}/${target.repo}:${SCORE_VERSION}:${configHash}`
}

/** Separate key for the package-source-augmented result. Once the user runs the
 *  manual check, the merged (possibly escalated) verdict is cached here and
 *  preferred over the base analysis on re-visit, so the result is "remembered". */
export function packageSourceCacheKey(target: SupportedRepo, configHash: string): string {
  return `pkgsrc:${target.owner}/${target.repo}:${SCORE_VERSION}:${configHash}`
}

export async function readPackageSourceCache(
  target: SupportedRepo,
  now: Date,
  configHash: string,
): Promise<AnalysisResult | null> {
  const key = packageSourceCacheKey(target, configHash)
  const stored = await chrome.storage.local.get(key)
  const result = stored[key] as AnalysisResult | undefined
  if (!result || !isFresh(result, now)) return null
  return result
}

export async function writePackageSourceCache(
  target: SupportedRepo,
  result: AnalysisResult,
  configHash: string,
): Promise<void> {
  await chrome.storage.local.set({ [packageSourceCacheKey(target, configHash)]: result })
}

/** A cached result is fresh while it is within the TTL of the reference time. */
export function isFresh(result: AnalysisResult, now: Date): boolean {
  return now.getTime() - new Date(result.analyzed_at).getTime() < CACHE_TTL_MS
}

/** Returns a cached result only if present AND still within TTL; otherwise null
 *  (a stale entry is treated as a miss and will be re-analyzed). */
export async function readCache(
  target: SupportedRepo,
  now: Date,
  configHash: string,
): Promise<AnalysisResult | null> {
  const key = cacheKey(target, configHash)
  const stored = await chrome.storage.local.get(key)
  const result = stored[key] as AnalysisResult | undefined
  if (!result || !isFresh(result, now)) return null
  return result
}

export async function writeCache(
  target: SupportedRepo,
  result: AnalysisResult,
  configHash: string,
): Promise<void> {
  await chrome.storage.local.set({ [cacheKey(target, configHash)]: result })
}
