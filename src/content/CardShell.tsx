import { useEffect, useRef, useState } from 'preact/hooks'
import { TrustCard, type CardState } from './card'
import { trustAccent } from '../shared/display'

// Chrome around the in-page card: a drag handle to reposition the floating host,
// and a collapse-to-edge tab. Both the collapsed state and the dragged position
// persist so the choice survives navigation. This component owns the *host*
// (the fixed <div> outside the Shadow DOM) — it reaches it via the shadow root's
// `.host`, so no element has to be threaded down from mount.

const CHROME_KEY = 'repo-trust:card-chrome'

interface StoredChrome {
  collapsed?: boolean
  x?: number
  y?: number
  /** Vertical offset of the collapsed tab along the right edge (null = centered). */
  tabY?: number
}

// Keep at least this much of the card on-screen after a drag or a viewport
// resize, so the handle can always be grabbed again.
const MIN_VISIBLE = 48

export const cardShellStyles = `
  .rt-shell { position: relative; }
  .rt-bar {
    display: flex; align-items: center; gap: 6px;
    margin: -2px 0 6px; padding: 2px 0;
    cursor: grab; touch-action: none; user-select: none;
  }
  .rt-bar:active { cursor: grabbing; }
  .rt-bar__collapse {
    border: none; background: transparent; cursor: pointer;
    font-size: 15px; line-height: 1; padding: 2px 6px; border-radius: 6px;
    color: #57606a;
  }
  .rt-bar__collapse:hover { background: rgba(0,0,0,0.06); }
  .rt-bar__grip {
    margin: 0 auto; font-size: 13px; line-height: 1; letter-spacing: -2px;
    color: #8b949e; pointer-events: none;
  }
  /* The docked tab — hidden until collapsed. A distinct indicator (accent dot +
     double-chevron) so it reads as Repo Trust, not a generic edge handle. */
  .rt-tab {
    display: none; align-items: center; gap: 5px;
    border: 1px solid rgba(0,0,0,0.12); border-right: none; cursor: pointer;
    padding: 11px 7px; border-radius: 9px 0 0 9px;
    background: #fff; color: #57606a;
    box-shadow: -4px 4px 14px rgba(0,0,0,0.16);
    cursor: grab; touch-action: none; user-select: none;
  }
  .rt-tab:active { cursor: grabbing; }
  .rt-tab:hover { color: #1f2328; }
  .rt-tab__dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent, #6e7781); display: block; }
  .rt-tab__chev { font-size: 13px; line-height: 1; }
  .rt-shell--collapsed .card { display: none; }
  .rt-shell--collapsed .rt-tab { display: inline-flex; }
  @media (prefers-color-scheme: dark) {
    .rt-bar__collapse { color: #9198a1; }
    .rt-bar__collapse:hover { background: rgba(255,255,255,0.08); }
    .rt-tab { background: #161b22; border-color: rgba(255,255,255,0.12); color: #9198a1; }
    .rt-tab:hover { color: #e6edf3; }
  }
`

export function CardShell({ state }: { state: CardState }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [tabY, setTabY] = useState<number | null>(null)
  const accent = trustAccent(state.kind === 'result' ? state.result.trust_state : undefined)

  // The fixed host div that owns our position (shadow root → .host).
  const hostEl = (): HTMLElement | undefined =>
    (rootRef.current?.getRootNode() as ShadowRoot | null)?.host as HTMLElement | undefined

  const persist = (patch: StoredChrome): void => {
    void chrome.storage.local
      .get(CHROME_KEY)
      .then((s) => {
        const cur = (s[CHROME_KEY] as StoredChrome | undefined) ?? {}
        return chrome.storage.local.set({ [CHROME_KEY]: { ...cur, ...patch } })
      })
      .catch(() => {})
  }

  // Load the persisted chrome once on mount.
  useEffect(() => {
    let live = true
    void chrome.storage.local
      .get(CHROME_KEY)
      .then((s) => {
        if (!live) return
        const v = s[CHROME_KEY] as StoredChrome | undefined
        if (!v) return
        setCollapsed(!!v.collapsed)
        if (typeof v.x === 'number' && typeof v.y === 'number') setPos({ x: v.x, y: v.y })
        if (typeof v.tabY === 'number') setTabY(v.tabY)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  // Apply collapsed/position to the host. Clamp a saved position into the current
  // viewport so a resize can't strand the card off-screen.
  useEffect(() => {
    const host = hostEl()
    if (!host) return
    const s = host.style
    if (collapsed) {
      s.left = 'auto'
      s.right = '0px'
      if (tabY != null) {
        // Clamp the saved edge offset so a resize can't push the tab off-screen.
        const h = host.getBoundingClientRect().height || 44
        s.top = `${Math.max(0, Math.min(tabY, window.innerHeight - Math.min(h, MIN_VISIBLE)))}px`
        s.transform = 'none'
      } else {
        s.top = '50%'
        s.transform = 'translateY(-50%)'
      }
      return
    }
    s.transform = 'none'
    if (pos) {
      const w = host.getBoundingClientRect().width || 260
      const x = Math.max(0, Math.min(pos.x, window.innerWidth - MIN_VISIBLE))
      const y = Math.max(0, Math.min(pos.y, window.innerHeight - MIN_VISIBLE))
      s.left = `${Math.min(x, window.innerWidth - Math.min(w, MIN_VISIBLE))}px`
      s.top = `${y}px`
      s.right = 'auto'
    } else {
      s.left = 'auto'
      s.right = '16px'
      s.top = '72px'
    }
  }, [collapsed, pos, tabY])

  const collapse = (): void => {
    setCollapsed(true)
    persist({ collapsed: true })
  }
  const expand = (): void => {
    setCollapsed(false)
    persist({ collapsed: false })
  }

  // Pointer-drag the host. We mutate host.style live during the drag (no React
  // churn) and commit the final position to state + storage on release.
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const onPointerDown = (e: PointerEvent): void => {
    const host = hostEl()
    if (!host) return
    const r = host.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const onPointerMove = (e: PointerEvent): void => {
    const d = drag.current
    const host = hostEl()
    if (!d || !host) return
    const r = host.getBoundingClientRect()
    const x = Math.max(0, Math.min(d.ox + (e.clientX - d.sx), window.innerWidth - r.width))
    const y = Math.max(0, Math.min(d.oy + (e.clientY - d.sy), window.innerHeight - r.height))
    host.style.left = `${x}px`
    host.style.top = `${y}px`
    host.style.right = 'auto'
    host.style.transform = 'none'
  }
  const onPointerUp = (): void => {
    const d = drag.current
    const host = hostEl()
    drag.current = null
    if (!d || !host) return
    const r = host.getBoundingClientRect()
    const next = { x: r.left, y: r.top }
    setPos(next)
    persist(next)
  }

  // The collapsed tab is draggable vertically along the right edge. A small
  // movement threshold distinguishes a reposition from a tap: a tap (no real
  // movement) still expands; a drag commits a new edge offset and suppresses the
  // expand-on-click that would otherwise fire.
  const tabDrag = useRef<{ sy: number; oy: number } | null>(null)
  // Survives past onTabUp (which clears tabDrag) so the trailing onClick can tell
  // a completed drag from a tap. Reset on the next pointerdown.
  const tabMoved = useRef(false)
  const onTabDown = (e: PointerEvent): void => {
    const host = hostEl()
    if (!host) return
    tabMoved.current = false
    tabDrag.current = { sy: e.clientY, oy: host.getBoundingClientRect().top }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onTabMove = (e: PointerEvent): void => {
    const d = tabDrag.current
    const host = hostEl()
    if (!d || !host) return
    const dy = e.clientY - d.sy
    if (Math.abs(dy) > 4) tabMoved.current = true
    if (!tabMoved.current) return
    const h = host.getBoundingClientRect().height
    const y = Math.max(0, Math.min(d.oy + dy, window.innerHeight - h))
    host.style.top = `${y}px`
    host.style.right = '0px'
    host.style.left = 'auto'
    host.style.transform = 'none'
  }
  const onTabUp = (): void => {
    const d = tabDrag.current
    const host = hostEl()
    tabDrag.current = null
    if (!d || !host || !tabMoved.current) return // a tap falls through to onClick → expand
    const y = host.getBoundingClientRect().top
    setTabY(y)
    persist({ tabY: y })
  }
  // `onClick` fires after the pointer sequence (and on keyboard Enter/Space, so the
  // tab stays operable without a pointer); skip it when that sequence was a drag.
  const onTabClick = (): void => {
    if (tabMoved.current) {
      tabMoved.current = false
      return
    }
    expand()
  }

  const bar = (
    <div
      class="rt-bar"
      title="Drag to move"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <button
        type="button"
        class="rt-bar__collapse"
        title="Collapse to edge"
        aria-label="Collapse panel to the edge"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={collapse}
      >
        ›
      </button>
      <span class="rt-bar__grip" aria-hidden="true">
        ⠿⠿
      </span>
    </div>
  )

  return (
    <div ref={rootRef} class={`rt-shell${collapsed ? ' rt-shell--collapsed' : ''}`}>
      <button
        type="button"
        class="rt-tab"
        style={`--accent:${accent}`}
        title="Drag to move · click to expand"
        aria-label="Expand Repo Trust panel (drag to reposition)"
        onPointerDown={onTabDown}
        onPointerMove={onTabMove}
        onPointerUp={onTabUp}
        onPointerCancel={onTabUp}
        onClick={onTabClick}
      >
        <span class="rt-tab__dot" aria-hidden="true" />
        <span class="rt-tab__chev" aria-hidden="true">
          «
        </span>
      </button>
      <TrustCard state={state} header={bar} />
    </div>
  )
}
