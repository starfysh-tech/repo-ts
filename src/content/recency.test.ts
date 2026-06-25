import { describe, it, expect } from 'vitest'
import { recencyLabel } from './recency'

const now = new Date('2026-06-24T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const MIN = 60_000
const HOUR = 60 * MIN

describe('recencyLabel', () => {
  it('reads as "Just now" under 5 minutes', () => {
    expect(recencyLabel(ago(2 * MIN), now)).toBe('Just now')
  })

  it('reads minutes within the hour', () => {
    expect(recencyLabel(ago(20 * MIN), now)).toBe('20m ago')
  })

  it('reads hours within the day', () => {
    expect(recencyLabel(ago(3 * HOUR), now)).toBe('3h ago')
  })

  it('reaches the stale state past the 24h TTL', () => {
    expect(recencyLabel(ago(25 * HOUR), now)).toBe('Stale — refresh recommended')
  })

  it('falls back to "Unknown" for an invalid timestamp', () => {
    expect(recencyLabel('not-a-date', now)).toBe('Unknown')
  })
})
