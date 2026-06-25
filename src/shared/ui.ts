import { render, type ComponentChild } from 'preact'

// Shared tokens + mount for the extension's standalone pages (popup, watchlist).
export const SURFACE_FONT = 'system-ui, -apple-system, sans-serif'
export const SURFACE_COLOR = '#1f2328'
export const SURFACE_MUTED = '#57606a'

/** Render an app into the conventional `#app` root of an extension page. */
export function mountApp(app: ComponentChild): void {
  const root = document.getElementById('app')
  if (root) render(app, root)
}
