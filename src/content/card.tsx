import type { SupportedRepo } from './parseRepoContext'
import type { AnalysisResult, ConfidenceState, TrustState } from '../engine/types'
import { recencyLabel } from './recency'

// The states the in-page card can render. The content script drives the
// transitions: loading → result | private | rate_limited | error.
export type CardState =
  | { kind: 'loading'; target: SupportedRepo }
  | { kind: 'result'; target: SupportedRepo; result: AnalysisResult }
  | { kind: 'error'; target: SupportedRepo; onRetry: () => void }
  | { kind: 'private'; target: SupportedRepo }
  | { kind: 'rate_limited'; target: SupportedRepo; resetAt: number }

// Conservative vocabulary only (per CLAUDE.md product rules): never
// "safe"/"trusted"/"dangerous". Every state carries an icon AND a text label,
// so it is never conveyed by color alone.
const TRUST_DISPLAY: Record<TrustState, { icon: string; label: string }> = {
  strong_signals: { icon: '✓', label: 'Strong signals' },
  mixed_signals: { icon: '◐', label: 'Mixed signals' },
  caution: { icon: '▲', label: 'Caution' },
  insufficient_evidence: { icon: '?', label: 'Limited evidence' },
}

const CONFIDENCE_LABEL: Record<ConfidenceState, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

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
      return <Result result={state.result} />
  }
}

function Result({ result }: { result: AnalysisResult }) {
  const display = TRUST_DISPLAY[result.trust_state]
  const reasons = topReasons(result)
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
