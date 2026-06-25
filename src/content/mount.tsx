import { render } from 'preact'
import { TrustCard, type CardState } from './card'

const HOST_ID = 'repo-trust-root'

// Styles live inside the Shadow DOM so GitHub's CSS cannot leak in and ours
// cannot leak out (isolation in both directions, per the PRD).
const STYLES = `
  :host { all: initial; }
  .card {
    position: relative;
    font-family: system-ui, -apple-system, sans-serif;
    width: 248px;
    padding: 12px 14px;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    color: #1f2328;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
  }
  .card__head { display: flex; align-items: center; gap: 8px; padding-right: 24px; }
  .card__icon { font-size: 14px; }
  .card__state { font-size: 14px; font-weight: 600; }
  .card__confidence { margin: 4px 0 0; font-size: 12px; color: #57606a; }
  .card__takeaway { margin: 6px 0 0; font-size: 12px; line-height: 1.4; }
  .card__recency { margin: 4px 0 0; font-size: 11px; color: #8b949e; }
  .card__save {
    position: absolute; top: 8px; right: 10px;
    font-size: 18px; line-height: 1; padding: 2px; cursor: pointer;
    border: none; background: transparent; color: inherit;
  }
  .card__save[aria-pressed="true"] { color: #d4a72c; }
  .card__save:disabled { cursor: default; opacity: 0.6; }
  .card__retry {
    margin-top: 8px; font-size: 12px; padding: 4px 10px; cursor: pointer;
    border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit;
  }
  .card__repo { margin: 10px 0 0; font-size: 11px; color: #57606a; word-break: break-all; }
  .card__details {
    margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1);
  }
  .details__title { margin: 0 0 8px; font-size: 13px; }
  .details__dim { margin: 0 0 10px; }
  .details__dim-head { display: flex; align-items: baseline; gap: 6px; font-size: 12px; }
  .details__dim-state { margin-left: auto; color: #57606a; font-size: 11px; }
  .details__dim-rationale { margin: 2px 0 0; font-size: 12px; color: #57606a; }
  .details__links { margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .details__links a { font-size: 11px; color: #0969da; }
  .details__subtitle { margin: 12px 0 4px; font-size: 11px; font-weight: 600; color: #57606a; }
  .details__deferred { margin: 0; padding-left: 16px; font-size: 11px; color: #8b949e; }
  @media (prefers-color-scheme: dark) {
    .card { background: #161b22; border-color: rgba(255,255,255,0.12); color: #e6edf3; }
    .card__confidence, .card__repo, .card__recency,
    .details__dim-state, .details__dim-rationale, .details__subtitle { color: #9198a1; }
    .card__retry { border-color: rgba(255,255,255,0.24); }
    .card__details { border-top-color: rgba(255,255,255,0.12); }
    .details__links a { color: #4493f8; }
    .details__deferred { color: #6e7681; }
  }
`

// Single mounted host for the in-page UI. Tracking the host and its Preact
// render container lets us re-render states in place and tear the stale card
// down before remounting on navigation (full SPA hardening: issue 07).
let host: HTMLDivElement | null = null
let container: HTMLDivElement | null = null

function ensureHost(): HTMLDivElement {
  if (container) return container
  host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText = 'position:fixed;top:72px;right:16px;z-index:2147483646;'
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLES
  container = document.createElement('div')
  shadow.append(style, container)
  document.body.appendChild(host)
  return container
}

export function showCard(state: CardState): void {
  render(<TrustCard state={state} />, ensureHost())
}

export function hideCard(): void {
  if (container) render(null, container) // let Preact clean up before detaching
  host?.remove()
  host = null
  container = null
}
