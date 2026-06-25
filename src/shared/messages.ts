import type { SupportedRepo } from '../content/parseRepoContext'
import type { AnalysisOutcome } from '../engine/types'

// Typed content-script ↔ background-worker contract. The worker owns all fetch,
// scoring, and caching; the content script only asks for an analysis.
export interface AnalyzeRequest {
  type: 'analyze'
  target: SupportedRepo
}

/** Sent from the content script; the worker replies with an AnalysisOutcome.
 *  Resolves `undefined` if the worker never responds (e.g. the service worker is
 *  torn down mid-flight), so callers must guard. */
export function requestAnalysis(target: SupportedRepo): Promise<AnalysisOutcome | undefined> {
  const message: AnalyzeRequest = { type: 'analyze', target }
  return chrome.runtime.sendMessage(message) as Promise<AnalysisOutcome | undefined>
}
