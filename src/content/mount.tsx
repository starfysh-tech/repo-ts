import { render } from 'preact'
import { TrustCard } from './card'
import type { RepoContext } from './parseRepoContext'

type RepoCtx = Extract<RepoContext, { kind: 'repo' }>

const HOST_ID = 'repo-trust-root'

// Styles live inside the Shadow DOM so GitHub's CSS cannot leak in and ours
// cannot leak out (isolation in both directions, per the PRD).
const STYLES = `
  :host { all: initial; }
  .card {
    font-family: system-ui, -apple-system, sans-serif;
    width: 240px;
    padding: 12px 14px;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    color: #1f2328;
  }
  .card__head { display: flex; align-items: center; gap: 8px; }
  .card__icon { font-size: 14px; }
  .card__state { font-size: 13px; font-weight: 600; }
  .card__repo { margin: 8px 0 0; font-size: 12px; color: #57606a; word-break: break-all; }
  @media (prefers-color-scheme: dark) {
    .card { background: #161b22; border-color: rgba(255,255,255,0.12); color: #e6edf3; }
    .card__repo { color: #9198a1; }
  }
`

// The single mounted host for the in-page UI. Tracking it lets us tear the
// stale card down before remounting on navigation (full SPA hardening: issue 07).
let host: HTMLDivElement | null = null

export function mountCard(context: RepoCtx): void {
  unmountCard()

  host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText = 'position:fixed;top:72px;right:16px;z-index:2147483646;'

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLES
  const container = document.createElement('div')
  shadow.append(style, container)
  document.body.appendChild(host)

  render(<TrustCard context={context} />, container)
}

export function unmountCard(): void {
  if (!host) return
  const container = host.shadowRoot?.querySelector('div')
  if (container) render(null, container) // let Preact clean up before detaching
  host.remove()
  host = null
}
