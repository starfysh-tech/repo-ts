import { parseRepoContext, type SupportedRepo } from './parseRepoContext'
import { showCard, hideCard } from './mount'
import { requestAnalysis } from '../shared/messages'

// "Dumb" content script: detect the page and own the card lifecycle. All fetch
// and scoring happens in the background worker.
const DEBOUNCE_MS = 150
const POLL_MS = 400

// owner/repo of the currently mounted card, or null when nothing is mounted.
let mountedKey: string | null = null
// Monotonic token gating which analysis may render. Bumped whenever a new
// analysis starts or the card is torn down, so any in-flight analysis that has
// been superseded (a navigation, a retry, an A->B->A re-entry) is dropped.
let currentToken = 0
let syncTimer: ReturnType<typeof setTimeout> | undefined

const keyOf = (target: SupportedRepo) => `${target.owner}/${target.repo}`

async function analyze(target: SupportedRepo): Promise<void> {
  // Key the staleness check on the token, not owner/repo: two analyses for the
  // SAME repo (a Retry, or an A->B->A re-entry) must not let an older/errored
  // response overwrite a newer one — only the latest analysis renders.
  const token = ++currentToken
  showCard({ kind: 'loading', target })

  const outcome = await requestAnalysis(target).catch(() => undefined)
  if (token !== currentToken) return

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

  if (context.kind !== 'repo') {
    // Reached a non-repo / unsupported page — tear the card down cleanly.
    if (mountedKey !== null) {
      currentToken++ // invalidate any in-flight analysis so it can't paint here
      hideCard()
      mountedKey = null
    }
    return
  }

  const key = keyOf(context)
  if (key === mountedKey) return // same repo (e.g. a subpage) — keep the card

  // Unmount the stale card before remounting for the new repo, so navigating
  // between repos never leaves a duplicate or a wrong-repo card.
  hideCard()
  mountedKey = key
  void analyze(context)
}

function scheduleSync(): void {
  clearTimeout(syncTimer)
  syncTimer = setTimeout(sync, DEBOUNCE_MS)
}

// GitHub transitions between repos/subpages client-side (Turbo) without a full
// reload. The 400ms location poll is the SOURCE OF TRUTH: a content script runs
// in an isolated world and can't observe the page's own pushState, but
// `location` reflects the live URL. popstate + Turbo events are a best-effort
// snappiness optimization (GitHub may rename/remove them) and must not be relied
// on alone — do not remove the poll. All funnel through a debounced sync().
function installNavigationWatch(): void {
  let lastHref = location.href

  window.addEventListener('popstate', scheduleSync)
  for (const event of ['turbo:load', 'turbo:render', 'pjax:end']) {
    document.addEventListener(event, scheduleSync)
  }

  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href
      scheduleSync()
    }
  }, POLL_MS)
}

installNavigationWatch()
sync()
