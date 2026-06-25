import { parseRepoContext, type SupportedRepo } from './parseRepoContext'
import { showCard, hideCard } from './mount'
import { requestAnalysis } from '../shared/messages'

// "Dumb" content script: detect the page and own the card lifecycle. All fetch
// and scoring happens in the background worker. Robust SPA (Turbo) navigation
// handling is issue 07; the skeleton syncs once at document_idle.
async function analyze(target: SupportedRepo): Promise<void> {
  showCard({ kind: 'loading', target })

  let outcome
  try {
    outcome = await requestAnalysis(target)
  } catch {
    outcome = { status: 'error' as const }
  }

  // A nullish outcome means the worker never replied — treat it like a transient
  // error (retryable), not a verdict.
  if (!outcome || outcome.status === 'error') {
    showCard({ kind: 'error', target, onRetry: () => void analyze(target) })
    return
  }

  switch (outcome.status) {
    case 'ok':
      showCard({ kind: 'result', target, result: outcome.result })
      break
    case 'private':
      showCard({ kind: 'private', target })
      break
    case 'rate_limited':
      showCard({ kind: 'rate_limited', target, resetAt: outcome.resetAt })
      break
  }
}

function sync(): void {
  const context = parseRepoContext(location.href)
  if (context.kind === 'repo') {
    void analyze(context)
  } else {
    hideCard()
  }
}

sync()
