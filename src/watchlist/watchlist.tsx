import { render } from 'preact'

// Skeleton watchlist: empty state only. Saved snapshots, recency, and per-row
// manual refresh land in issue 06.
function Watchlist() {
  return (
    <main style="max-width:640px;margin:40px auto;padding:0 16px;font-family:system-ui,-apple-system,sans-serif;color:#1f2328">
      <h1 style="font-size:18px">Watchlist</h1>
      <p style="font-size:13px;color:#57606a">No repositories saved yet.</p>
    </main>
  )
}

const root = document.getElementById('app')
if (root) render(<Watchlist />, root)
