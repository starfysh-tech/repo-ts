import { useEffect, useState } from 'preact/hooks'
import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'
import { parseRepoContext, type SupportedRepo } from '../content/parseRepoContext'
import { requestAnalysis } from '../shared/messages'
import { useWatchToggle } from '../shared/useWatchToggle'
import { trustAccent, trustDisplay, verdictSummary } from '../shared/display'
import { ConfidenceMeter, confidenceMeterStyles } from '../shared/ConfidenceMeter'
import { TrustDetails, trustDetailsStyles } from '../shared/TrustDetails'
import { ScopeNote, scopeNoteStyles } from '../shared/ScopeNote'
import { Caveats, caveatsStyles } from '../shared/Caveats'
import { dimensionRowStyles } from '../shared/DimensionRow'
import { Headline, headlineStyles } from '../shared/Headline'
import { recencyLabel } from '../content/recency'
import type { AnalysisOutcome, AnalysisResult } from '../engine/types'

// Popup-specific rules here; the shared components inject their own co-located
// styles (so the card and popup can't drift).
const STYLES = `
  body { margin: 0; font-family: ${SURFACE_FONT}; color: ${SURFACE_COLOR}; }
  .pp { width: 264px; padding: 13px 15px; border-top: 3px solid var(--accent, #6e7781); }
  .pp__takeaway { margin: 8px 0 0; font-size: 12px; line-height: 1.45; }
  .pp__recency { margin: 4px 0 0; font-size: 11px; color: #8b949e; }
  .pp__repo { margin: 12px 0 0; font-size: 11px; color: ${SURFACE_MUTED}; word-break: break-all; }
  .pp__actions { display: flex; gap: 8px; margin-top: 12px; }
  .pp button { font-size: 12px; padding: 5px 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit; }
  .pp button:disabled { cursor: default; opacity: 0.6; }
  @media (prefers-color-scheme: dark) {
    body { background: #161b22; color: #e6edf3; }
    .pp__repo, .pp__recency { color: #9198a1; }
    .pp button { border-color: rgba(255,255,255,0.24); }
  }
  ${headlineStyles}
  ${confidenceMeterStyles}
  ${dimensionRowStyles}
  ${trustDetailsStyles}
  ${scopeNoteStyles}
  ${caveatsStyles}
`

const openWatchlist = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL('src/watchlist/index.html') })

const openSettings = () => chrome.runtime.openOptionsPage()

type View =
  | { kind: 'loading' }
  | { kind: 'unsupported' }
  | { kind: 'repo'; target: SupportedRepo; outcome: AnalysisOutcome | undefined }

function Popup() {
  const [view, setView] = useState<View>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        const context = tab?.url ? parseRepoContext(tab.url) : { kind: 'unsupported' as const }
        if (context.kind !== 'repo') {
          if (live) setView({ kind: 'unsupported' })
          return
        }
        // requestAnalysis (sendMessage) can reject if the worker isn't reachable;
        // collapse that to undefined so the view shows "Analysis unavailable",
        // never an indefinite "Checking…" hang.
        const outcome = await requestAnalysis(context).catch(() => undefined)
        if (live) setView({ kind: 'repo', target: context, outcome })
      } catch {
        if (live) setView({ kind: 'unsupported' })
      }
    })()
    return () => {
      live = false
    }
  }, [])

  const accent = trustAccent(
    view.kind === 'repo' && view.outcome?.status === 'ok' ? view.outcome.result.trust_state : undefined,
  )

  return (
    <main class="pp" style={`--accent:${accent}`}>
      <style>{STYLES}</style>
      {view.kind === 'loading' && <Headline icon="◌" label="Checking this page…" />}
      {view.kind === 'unsupported' && (
        <Headline icon="–" label="No supported repository detected" sub="Open a public GitHub repo to see trust signals." />
      )}
      {view.kind === 'repo' && <RepoView target={view.target} outcome={view.outcome} />}
      <div class="pp__actions">
        <button type="button" onClick={openWatchlist}>
          Open watchlist
        </button>
        <button type="button" onClick={openSettings}>
          Settings
        </button>
      </div>
    </main>
  )
}

function RepoView({ target, outcome }: { target: SupportedRepo; outcome: AnalysisOutcome | undefined }) {
  const head = headlineFor(outcome)
  const repo = (
    <p class="pp__repo">
      {target.owner}/{target.repo}
    </p>
  )
  const result = outcome?.status === 'ok' ? outcome.result : null

  if (!result) {
    return (
      <div>
        <Headline icon={head.icon} label={head.label} sub={head.sub} />
        {repo}
      </div>
    )
  }

  return (
    <div>
      <Headline icon={head.icon} label={head.label} />
      <ConfidenceMeter level={result.confidence_state} />
      <p class="pp__takeaway">{verdictSummary(result)}</p>
      <Caveats flags={result.flags} />
      <ScopeNote />
      <p class="pp__recency">{recencyLabel(result.analyzed_at, new Date())}</p>
      <TrustDetails result={result} />
      <SaveButton target={target} result={result} />
      {repo}
    </div>
  )
}

function SaveButton({ target, result }: { target: SupportedRepo; result: AnalysisResult }) {
  const { watched, pending, toggle } = useWatchToggle(target, result)
  return (
    <div class="pp__actions">
      <button type="button" aria-pressed={watched} disabled={pending} onClick={toggle}>
        {watched ? 'Saved ✓' : 'Save to watchlist'}
      </button>
    </div>
  )
}

function headlineFor(outcome: AnalysisOutcome | undefined): { icon: string; label: string; sub?: string } {
  if (!outcome) return { icon: '!', label: 'Analysis unavailable' }
  switch (outcome.status) {
    case 'ok': {
      const d = trustDisplay(outcome.result.trust_state)
      return { icon: d.icon, label: d.label }
    }
    case 'private':
      return { icon: '⊘', label: "Can't analyze this repo", sub: 'Private or unsupported' }
    case 'rate_limited':
      return { icon: '⏱', label: 'Rate limit reached', sub: 'Try again later.' }
    case 'error':
      return { icon: '!', label: 'Analysis unavailable', sub: 'A temporary problem — not a verdict.' }
  }
}

mountApp(<Popup />)
