import { useEffect, useRef, useState } from 'preact/hooks'
import { TrustCard, type CardState } from './card'
import { trustAccent } from '../shared/display'

// Chrome around the in-page card: a drag handle to reposition the floating host,
// and a collapse-to-edge tab that is itself draggable along the edge. Collapsed
// state, card position, and tab offset all persist so the choice survives
// navigation. This component owns the *host* (the fixed <div> outside the Shadow
// DOM) — it reaches it via the shadow root's `.host`, so no element has to be
// threaded down from mount.

const CHROME_KEY = 'repo-trust:card-chrome'

interface StoredChrome {
  collapsed?: boolean
  x?: number
  y?: number
  /** Vertical offset of the collapsed tab along the right edge (null = centered). */
  tabY?: number
}

// Fallback dimensions, used only when getBoundingClientRect reads 0 (host not yet
// laid out); the real measured size is preferred whenever it is available.
const CARD_W = 260
const TAB_H = 44
// A drag must exceed this many px before it counts as a move (vs a click/tap).
const DRAG_THRESHOLD = 4

/** Clamp a coordinate so the element stays fully within [0, max]. `max` is floored
 *  at 0 so an element larger than the viewport pins to the top/left edge rather
 *  than going negative. One definition of "on-screen", shared by every drag and
 *  the apply effect, so they can't drift apart. */
const clamp = (v: number, max: number): number => Math.max(0, Math.min(v, Math.max(0, max)))

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
  const [loaded, setLoaded] = useState(false)
  const accent = trustAccent(state.kind === 'result' ? state.result.trust_state : undefined)

  // The fixed host div that owns our position (shadow root → .host).
  const hostEl = (): HTMLElement | undefined =>
    (rootRef.current?.getRootNode() as ShadowRoot | null)?.host as HTMLElement | undefined

  // Serialize the read-modify-write through a queue so rapid interactions (drag
  // commit + collapse toggle firing close together) can't interleave get→set and
  // drop a field — mirrors the `mutateSettings` write queue in settings.ts.
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  const persist = (patch: StoredChrome): void => {
    writeQueue.current = writeQueue.current
      .then(() => chrome.storage.local.get(CHROME_KEY))
      .then((s) => {
        const cur = (s[CHROME_KEY] as StoredChrome | undefined) ?? {}
        return chrome.storage.local.set({ [CHROME_KEY]: { ...cur, ...patch } })
      })
      .catch(() => {})
  }

  // Load the persisted chrome once. `loaded` gates first paint (the host starts
  // visibility:hidden in mount.tsx) so the card reveals at its saved position
  // instead of flashing at the default spot first. `finally` flips `loaded` even
  // when there's nothing stored or the read fails, so the card can never stay
  // hidden.
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
      .finally(() => {
        if (live) setLoaded(true)
      })
    return () => {
      live = false
    }
  }, [])

  // Apply collapsed/position to the host, keeping the whole element on-screen.
  useEffect(() => {
    const host = hostEl()
    if (!host) return
    const s = host.style
    if (!loaded) {
      s.visibility = 'hidden'
      return
    }
    s.visibility = 'visible'
    if (collapsed) {
      s.left = 'auto'
      s.right = '0px'
      if (tabY != null) {
        const h = host.getBoundingClientRect().height || TAB_H
        s.top = `${clamp(tabY, window.innerHeight - h)}px`
        s.transform = 'none'
      } else {
        s.top = '50%'
        s.transform = 'translateY(-50%)'
      }
      return
    }
    s.transform = 'none'
    if (pos) {
      const r = host.getBoundingClientRect()
      s.left = `${clamp(pos.x, window.innerWidth - (r.width || CARD_W))}px`
      s.top = `${clamp(pos.y, window.innerHeight - (r.height || TAB_H))}px`
      s.right = 'auto'
    } else {
      s.left = 'auto'
      s.right = '16px'
      s.top = '72px'
    }
  }, [collapsed, pos, tabY, loaded])

  const collapse = (): void => {
    setCollapsed(true)
    persist({ collapsed: true })
  }
  const expand = (): void => {
    setCollapsed(false)
    persist({ collapsed: false })
  }

  // Pointer-drag the host. We mutate host.style live during the drag (no re-render)
  // and commit on release — but only once the pointer has actually moved, so a
  // plain click on the handle never converts the responsive right-anchor into an
  // absolute position.
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(
    null,
  )
  const onPointerDown = (e: PointerEvent): void => {
    const host = hostEl()
    if (!host) return
    const r = host.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }
  const onPointerMove = (e: PointerEvent): void => {
    const d = drag.current
    const host = hostEl()
    if (!d || !host) return
    if (Math.abs(e.clientX - d.sx) > DRAG_THRESHOLD || Math.abs(e.clientY - d.sy) > DRAG_THRESHOLD) {
      d.moved = true
    }
    if (!d.moved) return
    const r = host.getBoundingClientRect()
    host.style.left = `${clamp(d.ox + (e.clientX - d.sx), window.innerWidth - (r.width || CARD_W))}px`
    host.style.top = `${clamp(d.oy + (e.clientY - d.sy), window.innerHeight - (r.height || TAB_H))}px`
    host.style.right = 'auto'
    host.style.transform = 'none'
  }
  const onPointerUp = (): void => {
    const d = drag.current
    const host = hostEl()
    drag.current = null
    if (!d || !host || !d.moved) return
    const r = host.getBoundingClientRect()
    const next = { x: r.left, y: r.top }
    setPos(next)
    persist(next)
  }

  // The collapsed tab drags vertically along the right edge; a tap (no real
  // movement) expands. Expansion fires on pointer-up / keyboard — not a trailing
  // synthetic click — so a pointercancel can't strand a flag that swallows the
  // next keyboard activation.
  const tabDrag = useRef<{ sy: number; oy: number; moved: boolean } | null>(null)
  const onTabDown = (e: PointerEvent): void => {
    const host = hostEl()
    if (!host) return
    tabDrag.current = { sy: e.clientY, oy: host.getBoundingClientRect().top, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onTabMove = (e: PointerEvent): void => {
    const d = tabDrag.current
    const host = hostEl()
    if (!d || !host) return
    if (Math.abs(e.clientY - d.sy) > DRAG_THRESHOLD) d.moved = true
    if (!d.moved) return
    const h = host.getBoundingClientRect().height || TAB_H
    host.style.top = `${clamp(d.oy + (e.clientY - d.sy), window.innerHeight - h)}px`
    host.style.right = '0px'
    host.style.left = 'auto'
    host.style.transform = 'none'
  }
  // pointerup expands a tap; pointercancel just ends the gesture (no expand).
  const finishTab = (expandOnTap: boolean): void => {
    const d = tabDrag.current
    const host = hostEl()
    tabDrag.current = null
    if (!d || !host) return
    if (d.moved) {
      const y = host.getBoundingClientRect().top
      setTabY(y)
      persist({ tabY: y })
    } else if (expandOnTap) {
      expand()
    }
  }
  const onTabKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      expand()
    }
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
        onPointerUp={() => finishTab(true)}
        onPointerCancel={() => finishTab(false)}
        onKeyDown={onTabKeyDown}
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
