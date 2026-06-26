import { describe, it, expect } from 'vitest'
import { scoreRelease } from './release'
import type { GithubRelease } from './types'
import type { SupportedRepo } from '../content/parseRepoContext'

const NOW = new Date('2026-06-24T00:00:00Z')
const TARGET: SupportedRepo = { kind: 'repo', owner: 'o', repo: 'r' }

// A stable, recently-published release; override per case.
const rel = (over: Partial<GithubRelease> = {}): GithubRelease => ({
  tag_name: 'v1',
  name: 'v1',
  draft: false,
  prerelease: false,
  created_at: '2026-06-01T00:00:00Z',
  published_at: '2026-06-01T00:00:00Z',
  html_url: 'https://example/x',
  ...over,
})

const score = (releases: GithubRelease[]) => scoreRelease(releases, TARGET, NOW)
const state = (releases: GithubRelease[]) => score(releases).dimension.dimension_state

describe('scoreRelease', () => {
  it('reports no evidence (unknown) when there are no releases', () => {
    const c = score([])
    expect(c.dimension.dimension_state).toBe('unknown')
    expect(c.hasEvidence).toBe(false)
    expect(c.additive).toBe(true)
    expect(c.dimension.evidence_links).toEqual([])
  })

  it('is additive and emits no flags in every branch (never drives caution)', () => {
    expect(score([]).flags).toEqual([])
    expect(score([rel()]).flags).toEqual([])
    expect(score([rel()]).additive).toBe(true)
  })

  it('reads strong for recent releases with cadence (>= 2 stable)', () => {
    expect(state([rel(), rel({ tag_name: 'v0', published_at: '2026-05-01T00:00:00Z' })])).toBe('strong')
  })

  it('reads mixed for a single recent release (no cadence)', () => {
    const c = score([rel()])
    expect(c.dimension.dimension_state).toBe('mixed')
    expect(c.dimension.rationale_summary).toBe('Has a recent release.')
  })

  it('reads mixed when releases exist but the latest is old', () => {
    const old = (tag: string, at: string) => rel({ tag_name: tag, created_at: at, published_at: at })
    const c = score([old('v2', '2020-01-01T00:00:00Z'), old('v1', '2019-01-01T00:00:00Z')])
    expect(c.dimension.dimension_state).toBe('mixed')
    expect(c.dimension.rationale_summary).toBe('Has published releases, but the latest is old.')
  })

  it('ignores prereleases — a prerelease-only repo reads as no evidence', () => {
    expect(score([rel({ prerelease: true }), rel({ prerelease: true })]).hasEvidence).toBe(false)
  })

  it('ignores drafts when judging cadence', () => {
    // one stable + one draft => single stable => mixed, not strong
    expect(state([rel(), rel({ draft: true })])).toBe('mixed')
  })

  it('picks the genuinely latest by publish date, not list order', () => {
    // Head is OLD by publish date; a later element is recent. The list-order head
    // must not decide recency — both are stable, so cadence holds => strong.
    const head = rel({ tag_name: 'v9', created_at: '2026-06-20T00:00:00Z', published_at: '2018-01-01T00:00:00Z' })
    const newer = rel({ tag_name: 'v8', created_at: '2026-06-19T00:00:00Z', published_at: '2026-06-20T00:00:00Z' })
    expect(state([head, newer])).toBe('strong')
  })

  it('degrades to "not recent" (never NaN) when publish dates are unparseable', () => {
    const bad = (tag: string) => rel({ tag_name: tag, created_at: '', published_at: '' })
    // two stable releases (cadence) but no usable date => mixed, not strong
    expect(state([bad('v2'), bad('v1')])).toBe('mixed')
  })
})
