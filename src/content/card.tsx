import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { SupportedRepo } from './parseRepoContext'
import type { AnalysisResult, DimensionKey, DimensionResult, DimensionState } from '../engine/types'
import { recencyLabel } from './recency'
import { isWatched, removeFromWatchlist, saveToWatchlist } from '../shared/watchlist'
import { CONFIDENCE_LABEL, TRUST_DISPLAY } from '../shared/display'

// The states the in-page card can render. The content script drives the
// transitions: loading → result | private | rate_limited | error.
export type CardState =
  | { kind: 'loading'; target: SupportedRepo }
  | { kind: 'result'; target: SupportedRepo; result: AnalysisResult }
  | { kind: 'error'; target: SupportedRepo; onRetry: () => void }
  | { kind: 'private'; target: SupportedRepo }
  | { kind: 'rate_limited'; target: SupportedRepo; resetAt: number }

// Per-dimension state, conveyed with icon AND text (never color alone).
const DIM_DISPLAY: Record<DimensionState, { icon: string; label: string }> = {
  strong: { icon: '✓', label: 'Strong' },
  mixed: { icon: '◐', label: 'Mixed' },
  weak: { icon: '△', label: 'Weak' },
  unknown: { icon: '–', label: 'Not enough evidence' },
}

const DIM_TITLE: Record<DimensionKey, string> = {
  provenance: 'Provenance',
  security: 'Security hygiene',
  transparency: 'Transparency',
}

// The four dimensions deferred from this version (shown as "not evaluated" so the
// user is never misled into thinking they were assessed and passed).
const DEFERRED_DIMENSIONS = ['Release discipline', 'Governance', 'Supply chain', 'Responsiveness']

export function TrustCard({ state }: { state: CardState }) {
  return (
    <section class="card" role="region" aria-label="Repo Trust summary">
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
  const reasons = topReasons(result)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Reflect the saved state, and keep the toggle obvious and reversible.
  const [watched, setWatched] = useState(false)
  useEffect(() => {
    let live = true
    isWatched(target).then((w) => {
      if (live) setWatched(w)
    })
    return () => {
      live = false
    }
  }, [target])

  const toggleWatch = async () => {
    if (watched) {
      await removeFromWatchlist(target.owner, target.repo)
      setWatched(false)
    } else {
      await saveToWatchlist(target, result)
      setWatched(true)
    }
  }

  // Closing always returns focus to the trigger, so a keyboard user never loses
  // their place (drawer Escape and Close both route through here). Memoized so
  // its identity is stable — the drawer's Escape effect then runs once, not on
  // every parent re-render.
  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  return (
    <div>
      <Headline icon={display.icon} label={display.label} sub={CONFIDENCE_LABEL[result.confidence_state]} />
      <p class="card__recency">{recencyLabel(result.analyzed_at, new Date())}</p>
      {reasons.length > 0 && (
        <ul class="card__reasons">
          {reasons.map((r) => (
            <li class="card__reason" key={r.text}>
              <span class="card__reason-icon" aria-hidden="true">
                {r.icon}
              </span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div class="card__actions">
        <button
          type="button"
          class="card__details-btn"
          ref={triggerRef}
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
        >
          {open ? 'Hide details' : 'View details'}
        </button>
        <button type="button" class="card__details-btn" aria-pressed={watched} onClick={toggleWatch}>
          {watched ? 'Saved ✓' : 'Save'}
        </button>
      </div>
      {open && <Drawer result={result} onClose={close} />}
    </div>
  )
}

// In-page drawer mounted in the same Shadow DOM (no navigation away). Per-
// dimension breakdown with evidence links, plus the deferred dimensions marked
// "not evaluated". Keyboard-operable: focus moves in on open, Escape closes.
function Drawer({ result, onClose }: { result: AnalysisResult; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus into the drawer once, on open (not on every re-render).
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // Escape closes the drawer — but only while focus is within our shadow root,
  // so we never hijack the host page's Escape (e.g. a GitHub comment box). The
  // listener is at the document level because keydown is composed and bubbles
  // out of the shadow root.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const root = headingRef.current?.getRootNode() as ShadowRoot | null
      if (root?.activeElement) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <section class="drawer" role="region" aria-label="Trust details">
      <h2 class="drawer__title" tabIndex={-1} ref={headingRef}>
        Trust details
      </h2>
      {result.dimension_results.map((dim) => (
        <DimensionRow key={dim.dimension_key} dim={dim} />
      ))}
      <h3 class="drawer__subtitle">Not evaluated in this version</h3>
      <ul class="drawer__deferred">
        {DEFERRED_DIMENSIONS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <button type="button" class="card__details-btn" onClick={onClose}>
        Close
      </button>
    </section>
  )
}

function DimensionRow({ dim }: { dim: DimensionResult }) {
  const s = DIM_DISPLAY[dim.dimension_state]
  return (
    <div class="drawer__dim">
      <div class="drawer__dim-head">
        <span aria-hidden="true">{s.icon}</span>
        <strong>{DIM_TITLE[dim.dimension_key]}</strong>
        <span class="drawer__dim-state">{s.label}</span>
      </div>
      <p class="drawer__dim-rationale">{dim.rationale_summary}</p>
      {dim.evidence_links.length > 0 && (
        <ul class="drawer__links">
          {dim.evidence_links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
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

/** Top three reasons, cautions (flags) before positives, each with its own icon. */
function topReasons(result: AnalysisResult): { icon: string; text: string }[] {
  return [
    ...result.flags.map((f) => ({ icon: f.severity === 'high' ? '▲' : '!', text: f.label })),
    ...result.positive_signals.map((p) => ({ icon: '✓', text: p.label })),
  ].slice(0, 3)
}

function formatTime(epochMs: number): string {
  if (!epochMs) return 'a while'
  return new Date(epochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
