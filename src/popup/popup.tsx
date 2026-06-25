import { useEffect, useState } from 'preact/hooks'
import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'
import { parseRepoContext, type SupportedRepo } from '../content/parseRepoContext'
import { requestAnalysis } from '../shared/messages'
import { isWatched, removeFromWatchlist, saveToWatchlist } from '../shared/watchlist'
import { TRUST_ACCENT, trustDisplay, verdictSummary } from '../shared/display'
import { ConfidenceMeter } from '../shared/ConfidenceMeter'
import { DimensionRow } from '../shared/DimensionRow'
import { recencyLabel } from '../content/recency'
import type { AnalysisOutcome, AnalysisResult } from '../engine/types'

const STYLES = `
  body { margin: 0; font-family: ${SURFACE_FONT}; color: ${SURFACE_COLOR}; }
  .pp { width: 264px; padding: 13px 15px; border-top: 3px solid var(--accent, #6e7781); }
  .pp__head { display: flex; align-items: center; gap: 8px; }
  .pp__icon { font-size: 16px; color: var(--accent, inherit); }
  .pp__state { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .pp__sub { margin: 4px 0 0; font-size: 12px; color: ${SURFACE_MUTED}; }
  .meter-row { display: flex; align-items: center; gap: 7px; margin: 7px 0 0; font-size: 12px; color: ${SURFACE_MUTED}; }
  .meter { display: inline-flex; gap: 2px; }
  .meter__seg { width: 16px; height: 5px; border-radius: 2px; background: rgba(0,0,0,0.14); }
  .meter__seg--on { background: #57606a; }
  .pp__takeaway { margin: 8px 0 0; font-size: 12px; line-height: 1.45; }
  .pp__recency { margin: 4px 0 0; font-size: 11px; color: #8b949e; }
  .pp__details { margin: 12px 0 0; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1); }
  .pp__details-title { margin: 0 0 8px; font-size: 13px; }
  .dim { margin: 0 0 10px; }
  .dim__head { display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
  .dim__state { margin-left: auto; font-size: 11px; }
  .dim__rationale { margin: 2px 0 0; font-size: 12px; color: ${SURFACE_MUTED}; }
  .dim__links { margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .dim__links a { font-size: 11px; color: #0969da; }
  .pp__repo { margin: 12px 0 0; font-size: 11px; color: ${SURFACE_MUTED}; word-break: break-all; }
  .pp__actions { display: flex; gap: 8px; margin-top: 12px; }
  .pp button { font-size: 12px; padding: 5px 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit; }
  .pp button:disabled { cursor: default; opacity: 0.6; }
  @media (prefers-color-scheme: dark) {
    body { background: #161b22; color: #e6edf3; }
    .pp__sub, .pp__repo, .pp__recency, .meter-row, .dim__rationale { color: #9198a1; }
    .meter__seg { background: rgba(255,255,255,0.16); }
    .meter__seg--on { background: #9198a1; }
    .dim__links a { color: #4493f8; }
    .pp button { border-color: rgba(255,255,255,0.24); }
    .pp__details { border-top-color: rgba(255,255,255,0.12); }
  }
`

const openWatchlist = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL('src/watchlist/index.html') })

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

  const accent =
    view.kind === 'repo' && view.outcome?.status === 'ok'
      ? TRUST_ACCENT[view.outcome.result.trust_state]
      : '#6e7781'

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
      </div>
    </main>
  )
}

function RepoView({ target, outcome }: { target: SupportedRepo; outcome: AnalysisOutcome | undefined }) {
  const head = headlineFor(outcome)
  const result = outcome?.status === 'ok' ? outcome.result : null
  return (
    <div>
      <Headline icon={head.icon} label={head.label} sub={result ? undefined : head.sub} />
      {result && <ConfidenceMeter level={result.confidence_state} />}
      {result && <p class="pp__takeaway">{verdictSummary(result)}</p>}
      {result && <p class="pp__recency">{recencyLabel(result.analyzed_at, new Date())}</p>}
      {result && (
        <div class="pp__details">
          <h2 class="pp__details-title">Trust details</h2>
          {result.dimension_results.map((dim) => (
            <DimensionRow key={dim.dimension_key} dim={dim} />
          ))}
        </div>
      )}
      {result && <SaveButton target={target} result={result} />}
      <p class="pp__repo">
        {target.owner}/{target.repo}
      </p>
    </div>
  )
}

function SaveButton({ target, result }: { target: SupportedRepo; result: AnalysisResult }) {
  const [watched, setWatched] = useState(false)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    let live = true
    isWatched(target)
      .then((w) => live && setWatched(w))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [target])

  // Guard against rapid double-clicks (non-atomic storage writes).
  const toggle = async () => {
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

function Headline({ icon, label, sub }: { icon: string; label: string; sub?: string }) {
  return (
    <div>
      <div class="pp__head">
        <span class="pp__icon" aria-hidden="true">
          {icon}
        </span>
        <span class="pp__state">{label}</span>
      </div>
      {sub && <p class="pp__sub">{sub}</p>}
    </div>
  )
}

mountApp(<Popup />)
