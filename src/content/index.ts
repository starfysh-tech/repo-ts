import { parseRepoContext, type SupportedRepo } from './parseRepoContext'
import { showCard, hideCard } from './mount'
import { requestAnalysis } from '../shared/messages'

// "Dumb" content script: detect the page and own the card lifecycle. All fetch
// and scoring happens in the background worker.
const DEBOUNCE_MS = 150
const POLL_MS = 400

// owner/repo of the currently mounted card, or null when nothing is mounted.
let mountedKey: string | null = null
let syncTimer: ReturnType<typeof setTimeout> | undefined

const keyOf = (target: SupportedRepo) => `${target.owner}/${target.repo}`

async function analyze(target: SupportedRepo): Promise<void> {
  const key = keyOf(target)
  showCard({ kind: 'loading', target })

  const outcome = await requestAnalysis(target).catch(() => undefined)
  // A rapid navigation may have moved us on while this was in flight; drop the
  // stale result rather than render it over the new repo's card.
  if (key !== mountedKey) return

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
// reload. Watch nav events for snappiness, plus a location poll as a robust
// fallback — a content script runs in an isolated world and can't observe the
// page's own pushState/replaceState, but `location` reflects the live URL.
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
