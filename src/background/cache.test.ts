import { describe, it, expect } from 'vitest'
import { cacheKey, isFresh } from './cache'
import { DEFAULT_SCORING_CONFIG, hashConfig } from '../engine/config'
import type { AnalysisResult } from '../engine/types'
import type { SupportedRepo } from '../content/parseRepoContext'

const target = (owner: string, repo: string): SupportedRepo => ({ kind: 'repo', owner, repo })
const resultAt = (iso: string) => ({ analyzed_at: iso }) as unknown as AnalysisResult

describe('cache helpers', () => {
  it('keys by owner/repo, score_version, and the config hash', () => {
    const h = hashConfig(DEFAULT_SCORING_CONFIG)
    expect(cacheKey(target('facebook', 'react'), h)).toBe(`analysis:facebook/react:0.6.0:${h}`)
  })

  it('partitions the cache by config: different configs yield different keys', () => {
    const t = target('facebook', 'react')
    const a = hashConfig(DEFAULT_SCORING_CONFIG)
    const b = hashConfig({ ...DEFAULT_SCORING_CONFIG, veryNewDays: 9999 })
    expect(a).not.toBe(b) // value change ⇒ different hash ⇒ stale entries can't be served
    expect(cacheKey(t, a)).not.toBe(cacheKey(t, b))
  })

  it('hashes equal configs equally regardless of key order (stable)', () => {
    // Same values, different object-literal key order → identical hash, so an
    // equivalent config never needlessly invalidates the cache.
    const reordered = {
      additiveDimensions: ['release', 'responsiveness'],
      provenanceGate: true,
      manufacturedGuard: { severity: 'medium', sensitivity: 'all-3' },
      highConfidenceThreshold: 3,
      responsiveActiveMin: 5,
      responsiveRecentDays: 90,
      govDominantShare: 0.85,
      govDistributedMin: 5,
      releaseRecentDays: 365,
      establishedDays: 365,
      dormantDays: 730,
      veryNewDays: 30,
    } as typeof DEFAULT_SCORING_CONFIG
    expect(hashConfig(reordered)).toBe(hashConfig(DEFAULT_SCORING_CONFIG))
  })

  it('treats a result within 24h as fresh', () => {
    const now = new Date('2026-06-24T12:00:00Z')
    expect(isFresh(resultAt('2026-06-24T06:00:00Z'), now)).toBe(true) // 6h old
  })

  it('treats a result older than 24h as stale', () => {
    const now = new Date('2026-06-24T12:00:00Z')
    expect(isFresh(resultAt('2026-06-23T06:00:00Z'), now)).toBe(false) // 30h old
  })
})
