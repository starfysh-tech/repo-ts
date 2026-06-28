import { useEffect, useState } from 'preact/hooks'
import type { SupportedRepo } from './parseRepoContext'
import type { AnalysisResult } from '../engine/types'
import { recencyLabel } from './recency'
import { useWatchToggle } from '../shared/useWatchToggle'
import { ConfidenceMeter } from '../shared/ConfidenceMeter'
import { PackageSourceAction } from '../shared/PackageSourceAction'
import { TrustDetails } from '../shared/TrustDetails'
import { ScopeNote } from '../shared/ScopeNote'
import { Caveats } from '../shared/Caveats'
import { Headline } from '../shared/Headline'
import { TRUST_DISPLAY, trustAccent, verdictSummary } from '../shared/display'

// The states the in-page card can render. The content script drives the
// transitions: loading → result | private | rate_limited | error.
export type CardState =
  | { kind: 'loading'; target: SupportedRepo }
  | { kind: 'result'; target: SupportedRepo; result: AnalysisResult }
  | { kind: 'error'; target: SupportedRepo; onRetry: () => void }
  | { kind: 'private'; target: SupportedRepo }
  | { kind: 'rate_limited'; target: SupportedRepo; resetAt: number }

export function TrustCard({ state }: { state: CardState }) {
  // Trust-colored top accent (neutral for the non-verdict states).
  const accent = trustAccent(state.kind === 'result' ? state.result.trust_state : undefined)
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

function Result({ result: initial, target }: { result: AnalysisResult; target: SupportedRepo }) {
  // Hold the displayed result locally so the manual package-source check can swap
  // in the merged (possibly caution-escalated) verdict. Re-sync if the underlying
  // analysis changes (SPA nav to another repo reuses this component).
  const [result, setResult] = useState(initial)
  useEffect(() => setResult(initial), [initial])
  const display = TRUST_DISPLAY[result.trust_state]
  const { watched, pending, toggle: toggleWatch } = useWatchToggle(target, result)

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
      <Caveats flags={result.flags} />
      <ScopeNote />
      <p class="card__recency">{recencyLabel(result.analyzed_at, new Date())}</p>
      <PackageSourceAction target={target} result={result} onResult={setResult} />
      <TrustDetails result={result} />
    </div>
  )
}

function formatTime(epochMs: number): string {
  if (!epochMs) return 'a while'
  return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
