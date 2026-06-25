import { useEffect, useState } from 'preact/hooks'
import type { SupportedRepo } from './parseRepoContext'
import type { AnalysisResult } from '../engine/types'
import { recencyLabel } from './recency'
import { isWatched, removeFromWatchlist, saveToWatchlist } from '../shared/watchlist'
import { ConfidenceMeter } from '../shared/ConfidenceMeter'
import { DimensionRow } from '../shared/DimensionRow'
import { TRUST_ACCENT, TRUST_DISPLAY, verdictSummary } from '../shared/display'

// The states the in-page card can render. The content script drives the
// transitions: loading → result | private | rate_limited | error.
export type CardState =
  | { kind: 'loading'; target: SupportedRepo }
  | { kind: 'result'; target: SupportedRepo; result: AnalysisResult }
  | { kind: 'error'; target: SupportedRepo; onRetry: () => void }
  | { kind: 'private'; target: SupportedRepo }
  | { kind: 'rate_limited'; target: SupportedRepo; resetAt: number }

// The four dimensions deferred from this version (shown as "not evaluated" so the
// user is never misled into thinking they were assessed and passed).
const DEFERRED_DIMENSIONS = ['Release discipline', 'Governance', 'Supply chain', 'Responsiveness']

export function TrustCard({ state }: { state: CardState }) {
  // Trust-colored top accent (neutral for the non-verdict states).
  const accent = state.kind === 'result' ? TRUST_ACCENT[state.result.trust_state] : '#6e7781'
  return (
    <section class="card" role="region" aria-label="Repo Trust summary" style={`--accent:${accent}`}>
      {renderBody(state)}
      <p class="card__repo">
        {state.target.owner}/{state.target.repo}
      </p>
    </section>
  )
}

function renderBody(state: CardState) {
  switch (state.kind) {
    case 'loading':
      return <Headline icon="◌" label="Analyzing…" />
    case 'private':
      return <Headline icon="⊘" label="Can't analyze this repo" sub="Private or unsupported" />
    case 'rate_limited':
      return (
        <Headline
          icon="⏱"
          label="Rate limit reached"
          sub={`Try again after ${formatTime(state.resetAt)}`}
        />
      )
    case 'error':
      return (
        <div>
          <Headline icon="!" label="Analysis unavailable" sub="A temporary problem — not a verdict." />
          <button type="button" class="card__retry" onClick={state.onRetry}>
            Retry
          </button>
        </div>
      )
    case 'result':
      return <Result result={state.result} target={state.target} />
  }
}

function Result({ result, target }: { result: AnalysisResult; target: SupportedRepo }) {
  const display = TRUST_DISPLAY[result.trust_state]

  // Saved state — reflected by a corner icon, reversible.
  const [watched, setWatched] = useState(false)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    let live = true
    isWatched(target)
      .then((w) => {
        if (live) setWatched(w)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [target])

  // Guard against rapid double-clicks: storage writes are non-atomic, so one
  // toggle must finish before the next can start.
  const toggleWatch = async () => {
    if (pending) return
    setPending(true)
    try {
      if (watched) {
        await removeFromWatchlist(target.owner, target.repo)
        setWatched(false)
      } else {
        await saveToWatchlist(target, result)
        setWatched(true)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      {/* Save toggle as a corner icon. The glyph (☆ outline vs ★ filled) plus
          aria-pressed/title convey saved state — not color alone. */}
      <button
        type="button"
        class="card__save"
        aria-pressed={watched}
        disabled={pending}
        title={watched ? 'Saved to watchlist' : 'Save to watchlist'}
        aria-label={watched ? 'Saved to watchlist' : 'Save to watchlist'}
        onClick={toggleWatch}
      >
        {watched ? '★' : '☆'}
      </button>
      <Headline icon={display.icon} label={display.label} />
      <ConfidenceMeter level={result.confidence_state} />
      <p class="card__takeaway">{verdictSummary(result)}</p>
      <p class="card__recency">{recencyLabel(result.analyzed_at, new Date())}</p>
      <Details result={result} />
    </div>
  )
}

// The per-dimension breakdown, shown directly on the card (no expand): each
// evaluated dimension's state + evidence-first rationale + evidence links, plus
// the deferred dimensions marked "not evaluated".
function Details({ result }: { result: AnalysisResult }) {
  return (
    <section class="card__details" aria-label="Trust details">
      <h2 class="details__title">Trust details</h2>
      {result.dimension_results.map((dim) => (
        <DimensionRow key={dim.dimension_key} dim={dim} />
      ))}
      <h3 class="details__subtitle">Not evaluated in this version</h3>
      <ul class="details__deferred">
        {DEFERRED_DIMENSIONS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </section>
  )
}

function Headline({ icon, label, sub }: { icon: string; label: string; sub?: string }) {
  return (
    <div>
      <header class="card__head">
        <span class="card__icon" aria-hidden="true">
          {icon}
        </span>
        <span class="card__state">{label}</span>
      </header>
      {sub && <p class="card__confidence">{sub}</p>}
    </div>
  )
}

function formatTime(epochMs: number): string {
  if (!epochMs) return 'a while'
  return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
