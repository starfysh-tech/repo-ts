import { analyzeRepo } from '../engine/analyzeRepo'
import { fetchCommunityProfileLive, fetchRepoLive } from '../engine/githubClient'
import type { AnalyzeRequest } from '../shared/messages'
import type { AnalysisOutcome } from '../engine/types'

// Background service worker — the single owner of fetch, scoring, and (from
// issue 04) caching and rate-limit management.
chrome.runtime.onMessage.addListener(
  (message: AnalyzeRequest, _sender, sendResponse: (outcome: AnalysisOutcome) => void) => {
    if (message?.type !== 'analyze') return undefined

    analyzeRepo(
      { fetchRepo: fetchRepoLive, fetchCommunityProfile: fetchCommunityProfileLive, now: new Date() },
      message.target,
    )
      .then(sendResponse)
      .catch(() => sendResponse({ status: 'error' }))

    return true // keep the message channel open for the async response
  },
)
