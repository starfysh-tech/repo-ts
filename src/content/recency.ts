import { CACHE_TTL_MS } from '../engine/config'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

// Live-computed relative freshness of an analysis (not a frozen timestamp). Past
// the cache TTL it reads as "stale", nudging a refresh. The absolute analyzed_at
// is stored only for this computation and the TTL check.
export function recencyLabel(analyzedAt: string, now: Date): string {
  const ms = now.getTime() - new Date(analyzedAt).getTime()
  if (ms >= CACHE_TTL_MS) return 'Stale — refresh recommended'
  if (ms < 5 * MINUTE) return 'Just now'
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`
  return `${Math.floor(ms / HOUR)}h ago`
}
