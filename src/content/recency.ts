import { CACHE_TTL_MS } from '../engine/config'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

// Live-computed relative freshness of an analysis (not a frozen timestamp). Past
// the cache TTL it reads as "stale", nudging a refresh. The absolute analyzed_at
// is stored only for this computation and the TTL check.
//
// On the in-page card a rendered result is always within TTL (the worker
// re-analyzes a stale entry), so the "stale" branch mainly serves aged watchlist
// snapshots, which are saved point-in-time and not auto-refreshed (issue 06).
export function recencyLabel(analyzedAt: string, now: Date): string {
  const analyzedTime = new Date(analyzedAt).getTime()
  if (Number.isNaN(analyzedTime)) return 'Unknown' // corrupted/missing timestamp
  const ms = now.getTime() - analyzedTime
  if (ms >= CACHE_TTL_MS) return 'Stale — refresh recommended'
  if (ms < 5 * MINUTE) return 'Just now'
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`
  return `${Math.floor(ms / HOUR)}h ago`
}
