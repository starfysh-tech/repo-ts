import { useEffect, useState } from 'preact/hooks'
import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'
import {
  getWatchlist,
  removeFromWatchlist,
  saveToWatchlist,
  type WatchlistEntry,
} from '../shared/watchlist'
import { requestAnalysis } from '../shared/messages'
import { recencyLabel } from '../content/recency'
import { TRUST_DISPLAY } from '../shared/display'
import type { SupportedRepo } from '../content/parseRepoContext'

const STYLES = `
  body { margin: 0; font-family: ${SURFACE_FONT}; color: ${SURFACE_COLOR}; }
  .wl { max-width: 680px; margin: 40px auto; padding: 0 16px; }
  .wl h1 { font-size: 18px; }
  .wl__empty { font-size: 13px; color: ${SURFACE_MUTED}; }
  .wl__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .wl__row {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 10px 12px; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
  }
  .wl__repo { font-weight: 600; font-size: 13px; }
  .wl__state { font-size: 12px; }
  .wl__recency { font-size: 11px; color: ${SURFACE_MUTED}; }
  .wl__spacer { margin-left: auto; }
  .wl__row button { font-size: 12px; padding: 4px 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; }
  .wl__note { font-size: 11px; color: #9a6700; width: 100%; }
`

const targetOf = (entry: WatchlistEntry): SupportedRepo => ({
  kind: 'repo',
  owner: entry.owner,
  repo: entry.repo,
})

function Watchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[] | null>(null)
  const reload = () => getWatchlist().then(setEntries)
  useEffect(() => {
    reload()
  }, [])

  return (
    <main class="wl">
      <style>{STYLES}</style>
      <h1>Watchlist</h1>
      {entries === null ? null : entries.length === 0 ? (
        <p class="wl__empty">
          No repositories saved yet. Open a public GitHub repo and choose “Save” to track it here.
        </p>
      ) : (
        <ul class="wl__list">
          {entries.map((entry) => (
            <Row key={`${entry.owner}/${entry.repo}`} entry={entry} onChange={reload} />
          ))}
        </ul>
      )}
    </main>
  )
}

function Row({ entry, onChange }: { entry: WatchlistEntry; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const display = TRUST_DISPLAY[entry.result.trust_state]

  // Per-row, on demand only — no bulk or background refresh (rate-limit budget).
  const refresh = async () => {
    setBusy(true)
    setNote('')
    const outcome = await requestAnalysis(targetOf(entry), true)
    if (outcome?.status === 'ok') {
      await saveToWatchlist(targetOf(entry), outcome.result)
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
    <li class="wl__row">
      <a class="wl__repo" href={`https://github.com/${entry.owner}/${entry.repo}`} target="_blank" rel="noopener noreferrer">
        {entry.owner}/{entry.repo}
      </a>
      <span class="wl__state">
        <span aria-hidden="true">{display.icon}</span> {display.label}
      </span>
      <span class="wl__recency">{recencyLabel(entry.result.analyzed_at, new Date())}</span>
      <span class="wl__spacer" />
      <button type="button" onClick={refresh} disabled={busy}>
        {busy ? 'Refreshing…' : 'Refresh'}
      </button>
      <button type="button" onClick={remove}>
        Remove
      </button>
      {note && <span class="wl__note">{note}</span>}
    </li>
  )
}

mountApp(<Watchlist />)
