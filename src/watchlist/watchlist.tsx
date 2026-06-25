import { useEffect, useState } from 'preact/hooks'
import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'
import {
  getWatchlist,
  removeFromWatchlist,
  updateWatchlistSnapshot,
  type WatchlistEntry,
} from '../shared/watchlist'
import { requestAnalysis } from '../shared/messages'
import { recencyLabel } from '../content/recency'
import { trustAccent, trustDisplay, verdictSummary } from '../shared/display'
import { Headline, headlineStyles } from '../shared/Headline'
import { ConfidenceMeter, confidenceMeterStyles } from '../shared/ConfidenceMeter'
import type { SupportedRepo } from '../content/parseRepoContext'

// Page-specific rules only; the shared components inject their own co-located
// styles (so the watchlist can't drift from the card and popup).
const STYLES = `
  body { margin: 0; font-family: ${SURFACE_FONT}; color: ${SURFACE_COLOR}; background: #f6f8fa; }
  .wl { max-width: 680px; margin: 40px auto; padding: 0 16px; }
  .wl__header { display: flex; align-items: baseline; gap: 10px; }
  .wl h1 { font-size: 20px; margin: 0; }
  .wl__count { font-size: 12px; color: ${SURFACE_MUTED}; }
  .wl__intro { margin: 6px 0 18px; font-size: 12px; color: ${SURFACE_MUTED}; }
  .wl__empty { font-size: 13px; color: ${SURFACE_MUTED}; }
  .wl__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .wl__row {
    padding: 12px 14px; background: #fff;
    border: 1px solid rgba(0,0,0,0.1); border-left: 3px solid var(--accent, ${SURFACE_MUTED});
    border-radius: 8px;
  }
  .wl__top { display: flex; align-items: center; gap: 8px; }
  .wl__repo { font-weight: 600; font-size: 13px; color: inherit; text-decoration: none; }
  .wl__repo:hover { text-decoration: underline; }
  .wl__actions { margin-left: auto; display: flex; gap: 6px; }
  .wl__row button {
    font-size: 12px; padding: 4px 10px; cursor: pointer;
    border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit;
  }
  .wl__row button:disabled { cursor: default; opacity: 0.6; }
  .wl__head { margin-top: 8px; }
  .wl__takeaway { margin: 6px 0 0; font-size: 12px; line-height: 1.45; }
  .wl__recency { margin: 4px 0 0; font-size: 11px; color: ${SURFACE_MUTED}; }
  .wl__note { margin: 6px 0 0; font-size: 11px; color: #9a6700; }
  @media (prefers-color-scheme: dark) {
    body { background: #0d1117; color: #e6edf3; }
    .wl__count, .wl__intro, .wl__empty, .wl__recency { color: #9198a1; }
    .wl__row { background: #161b22; border-color: rgba(255,255,255,0.1); }
    .wl__row button { border-color: rgba(255,255,255,0.24); }
  }
  ${headlineStyles}
  ${confidenceMeterStyles}
`

const targetOf = (entry: WatchlistEntry): SupportedRepo => ({
  kind: 'repo',
  owner: entry.owner,
  repo: entry.repo,
})

function Watchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[] | null>(null)
  const reload = () => getWatchlist().then(setEntries).catch(() => setEntries([]))
  useEffect(() => {
    reload()
  }, [])

  return (
    <main class="wl">
      <style>{STYLES}</style>
      <div class="wl__header">
        <h1>Watchlist</h1>
        {entries && entries.length > 0 && <span class="wl__count">{entries.length} saved</span>}
      </div>
      {entries === null ? null : entries.length === 0 ? (
        <p class="wl__empty">
          No repositories saved yet. Open a public GitHub repo and choose “Save” to track it here.
        </p>
      ) : (
        <>
          <p class="wl__intro">Saved snapshots — refresh a row to re-check it.</p>
          <ul class="wl__list">
            {entries.map((entry) => (
              <Row key={`${entry.owner}/${entry.repo}`} entry={entry} onChange={reload} />
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

function Row({ entry, onChange }: { entry: WatchlistEntry; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  // Stored snapshots are untrusted at read time (could be corrupted or from an
  // older schema), so every derived render degrades rather than crashing.
  const result = entry.result
  const display = trustDisplay(result?.trust_state)
  const accent = trustAccent(result?.trust_state)

  // Per-row, on demand only — no bulk or background refresh (rate-limit budget).
  const refresh = async () => {
    setBusy(true)
    setNote('')
    const outcome = await requestAnalysis(targetOf(entry), true).catch(() => undefined)
    if (outcome?.status === 'ok') {
      // updateWatchlistSnapshot won't re-add the row if it was removed mid-refresh.
      await updateWatchlistSnapshot(targetOf(entry), outcome.result)
      onChange()
    } else if (outcome?.status === 'rate_limited') {
      setNote('Rate limit reached — try again later.')
    } else {
      setNote("Couldn't refresh just now.")
    }
    setBusy(false)
  }

  const remove = async () => {
    await removeFromWatchlist(entry.owner, entry.repo)
    onChange()
  }

  return (
    <li class="wl__row" style={`--accent:${accent}`}>
      <div class="wl__top">
        <a
          class="wl__repo"
          href={`https://github.com/${entry.owner}/${entry.repo}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {entry.owner}/{entry.repo}
        </a>
        <div class="wl__actions">
          <button type="button" onClick={refresh} disabled={busy}>
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" onClick={remove}>
            Remove
          </button>
        </div>
      </div>
      <div class="wl__head">
        <Headline icon={display.icon} label={display.label} />
      </div>
      {result && <ConfidenceMeter level={result.confidence_state} />}
      {result && <p class="wl__takeaway">{verdictSummary(result)}</p>}
      <p class="wl__recency">
        {result?.analyzed_at ? recencyLabel(result.analyzed_at, new Date()) : 'Unknown'}
      </p>
      {note && <p class="wl__note">{note}</p>}
    </li>
  )
}

mountApp(<Watchlist />)
