import { render } from 'preact'

// Skeleton popup: a watchlist shortcut and a neutral message. The current-page
// trust state and quick actions land in issue 06.
function Popup() {
  const openWatchlist = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/watchlist/index.html') })
  }
  return (
    <main style="width:260px;padding:14px;font-family:system-ui,-apple-system,sans-serif;color:#1f2328">
      <h1 style="font-size:14px;margin:0 0 6px">Repo Trust</h1>
      <p style="font-size:12px;color:#57606a;margin:0 0 12px">
        Open a public GitHub repository to see its trust signals.
      </p>
      <button type="button" onClick={openWatchlist} style="font-size:12px;padding:6px 10px;cursor:pointer">
        Open watchlist
      </button>
    </main>
  )
}

const root = document.getElementById('app')
if (root) render(<Popup />, root)
