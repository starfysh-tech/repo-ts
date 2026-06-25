import type { SupportedRepo } from '../content/parseRepoContext'
import type { AnalysisOutcome } from '../engine/types'

// Typed content-script ↔ background-worker contract. The worker owns all fetch,
// scoring, and caching; the content script only asks for an analysis.
export interface AnalyzeRequest {
  type: 'analyze'
  target: SupportedRepo
  /** Bypass the cache and force a fresh analysis (the watchlist's per-row refresh). */
  refresh?: boolean
}

/** Sent from the content script / popup / watchlist; the worker replies with an
 *  AnalysisOutcome. Resolves `undefined` if the worker never responds (e.g. the
 *  service worker is torn down mid-flight), so callers must guard. */
export function requestAnalysis(
  target: SupportedRepo,
  refresh = false,
): Promise<AnalysisOutcome | undefined> {
  const message: AnalyzeRequest = { type: 'analyze', target, refresh }
  return chrome.runtime.sendMessage(message) as Promise<AnalysisOutcome | undefined>
}
