import { analyzeRepo } from '../engine/analyzeRepo'
import {
  fetchCommunityProfileLive,
  fetchContributorsLive,
  fetchIssuesLive,
  fetchPullsLive,
  fetchReleasesLive,
  fetchRepoLive,
} from '../engine/githubClient'
import { readCache, writeCache } from './cache'
import type { AnalyzeRequest } from '../shared/messages'
import type { AnalysisOutcome } from '../engine/types'
import type { SupportedRepo } from '../content/parseRepoContext'

// Background service worker — the single owner of fetch, scoring, caching, and
// rate-limit management.
async function handleAnalyze(target: SupportedRepo, refresh: boolean): Promise<AnalysisOutcome> {
  const now = new Date()

  // Serve a fresh cached analysis with zero API calls (protects the 60/hr
  // budget) — unless this is an explicit per-row refresh, which forces new data.
  if (!refresh) {
    const cached = await readCache(target, now)
    if (cached) return { status: 'ok', result: cached }
  }

  const outcome = await analyzeRepo(
    {
      fetchRepo: fetchRepoLive,
      fetchCommunityProfile: fetchCommunityProfileLive,
      fetchReleases: fetchReleasesLive,
      fetchContributors: fetchContributorsLive,
      fetchIssues: fetchIssuesLive,
      fetchPulls: fetchPullsLive,
      now,
    },
    target,
  )
  if (outcome.status === 'ok') await writeCache(target, outcome.result)
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
