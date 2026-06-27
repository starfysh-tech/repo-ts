import { analyzeRepo } from '../engine/analyzeRepo'
import { createGithubClient } from '../engine/githubClient'
import { DEFAULT_SCORING_CONFIG, hashConfig } from '../engine/config'
import { getSettings } from '../shared/settings'
import { readCache, writeCache } from './cache'
import type { AnalyzeRequest } from '../shared/messages'
import type { AnalysisOutcome } from '../engine/types'
import type { SupportedRepo } from '../content/parseRepoContext'

// Background service worker — the single owner of fetch, scoring, caching, and
// rate-limit management.
async function handleAnalyze(target: SupportedRepo, refresh: boolean): Promise<AnalysisOutcome> {
  const now = new Date()

  // Active scoring config. Slice A always uses the defaults; presets/overrides
  // (slice B) will resolve it per analysis here. Its hash partitions the cache so
  // a config change can never serve a verdict scored under different settings.
  const config = DEFAULT_SCORING_CONFIG
  const configHash = hashConfig(config)

  // Serve a fresh cached analysis with zero API calls (protects the 60/hr
  // budget) — unless this is an explicit per-row refresh, which forces new data.
  if (!refresh) {
    const cached = await readCache(target, now, configHash)
    if (cached) return { status: 'ok', result: cached }
  }

  // Read the optional PAT per analysis so a token saved/cleared mid-session
  // takes effect on the next request (no worker restart needed). The token only
  // raises the rate limit; it never changes scoring, so it stays out of the
  // cache key.
  const { pat } = await getSettings()
  const client = createGithubClient(pat)

  const outcome = await analyzeRepo({ ...client, now, config }, target)
  if (outcome.status === 'ok') await writeCache(target, outcome.result, configHash)
  return outcome
}

chrome.runtime.onMessage.addListener(
  (message: AnalyzeRequest, _sender, sendResponse: (outcome: AnalysisOutcome) => void) => {
    if (message?.type !== 'analyze') return undefined

    handleAnalyze(message.target, message.refresh ?? false)
      .then(sendResponse)
      .catch(() => sendResponse({ status: 'error' }))

    return true // keep the message channel open for the async response
  },
)
