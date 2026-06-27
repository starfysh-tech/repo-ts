import { describe, it, expect } from 'vitest'
import { cacheKey, isFresh } from './cache'
import type { AnalysisResult } from '../engine/types'
import type { SupportedRepo } from '../content/parseRepoContext'

const target = (owner: string, repo: string): SupportedRepo => ({ kind: 'repo', owner, repo })
const resultAt = (iso: string) => ({ analyzed_at: iso }) as unknown as AnalysisResult

describe('cache helpers', () => {
  it('keys by owner/repo and score_version', () => {
    expect(cacheKey(target('facebook', 'react'))).toBe('analysis:facebook/react:0.6.0')
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
