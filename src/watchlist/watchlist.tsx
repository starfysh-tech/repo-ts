import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'

// Skeleton watchlist: empty state only. Saved snapshots, recency, and per-row
// manual refresh land in issue 06.
function Watchlist() {
  return (
    <main style={`max-width:640px;margin:40px auto;padding:0 16px;font-family:${SURFACE_FONT};color:${SURFACE_COLOR}`}>
      <h1 style="font-size:18px">Watchlist</h1>
      <p style={`font-size:13px;color:${SURFACE_MUTED}`}>No repositories saved yet.</p>
    </main>
  )
}

mountApp(<Watchlist />)
