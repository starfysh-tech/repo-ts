import { useEffect, useState } from 'preact/hooks'
import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'
import { parseRepoContext, type SupportedRepo } from '../content/parseRepoContext'
import { requestAnalysis } from '../shared/messages'
import { isWatched, removeFromWatchlist, saveToWatchlist } from '../shared/watchlist'
import { CONFIDENCE_LABEL, trustDisplay } from '../shared/display'
import type { AnalysisOutcome, AnalysisResult } from '../engine/types'

const STYLES = `
  body { margin: 0; font-family: ${SURFACE_FONT}; color: ${SURFACE_COLOR}; }
  .pp { width: 260px; padding: 14px; }
  .pp__head { display: flex; align-items: center; gap: 8px; }
  .pp__icon { font-size: 14px; }
  .pp__state { font-size: 14px; font-weight: 600; }
  .pp__sub { margin: 4px 0 0; font-size: 12px; color: ${SURFACE_MUTED}; }
  .pp__repo { margin: 6px 0 0; font-size: 11px; color: ${SURFACE_MUTED}; word-break: break-all; }
  .pp__actions { display: flex; gap: 8px; margin-top: 12px; }
  .pp button { font-size: 12px; padding: 5px 10px; cursor: pointer; border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit; }
`

const openWatchlist = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL('src/watchlist/index.html') })

type View = { kind: 'loading' } | { kind: 'unsupported' } | { kind: 'repo'; target: SupportedRepo; outcome: AnalysisOutcome | undefined }

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

  return (
    <main class="pp">
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
      <Headline icon={head.icon} label={head.label} sub={head.sub} />
      <p class="pp__repo">
        {target.owner}/{target.repo}
      </p>
      {result && <SaveButton target={target} result={result} />}
    </div>
  )
}

function SaveButton({ target, result }: { target: SupportedRepo; result: AnalysisResult }) {
  const [watched, setWatched] = useState(false)
  useEffect(() => {
    let live = true
    isWatched(target).then((w) => live && setWatched(w))
    return () => {
      live = false
    }
  }, [target])

  const toggle = async () => {
    if (watched) {
      await removeFromWatchlist(target.owner, target.repo)
      setWatched(false)
    } else {
      await saveToWatchlist(target, result)
      setWatched(true)
    }
  }

  return (
    <div class="pp__actions">
      <button type="button" aria-pressed={watched} onClick={toggle}>
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
      return { icon: d.icon, label: d.label, sub: CONFIDENCE_LABEL[outcome.result.confidence_state] }
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
