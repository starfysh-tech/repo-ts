import { parseRepoContext } from './parseRepoContext'
import { mountCard, unmountCard } from './mount'

// "Dumb" content script: detect the page, own mount/unmount. No network or
// scoring here — that belongs to the background worker (issue 03). Robust SPA
// (Turbo) navigation handling is issue 07; the skeleton syncs once at idle.
function sync(): void {
  const context = parseRepoContext(location.href)
  if (context.kind === 'repo') {
    mountCard(context)
  } else {
    unmountCard()
  }
}

sync()
