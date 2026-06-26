import { describe, it, expect } from 'vitest'
import { scoreResponsiveness } from './responsiveness'
import type { GithubIssue, GithubPull } from './types'
import type { SupportedRepo } from '../content/parseRepoContext'

// Fixed reference time; the 90-day recency window is measured back from here.
const now = new Date('2026-06-24T00:00:00Z')
const target: SupportedRepo = { kind: 'repo', owner: 'o', repo: 'r' }

// A recent close (within the 90-day window) and an old one (outside it).
const RECENT = '2026-06-01T00:00:00Z'
const OLD = '2020-01-01T00:00:00Z'

// pull_request distinguishes issues ({} ⇒ PR row, null ⇒ real issue) the way the
// GitHub issues endpoint does; the PR source of truth is the pulls array.
const iss = (closed_at: string | null, isPr = false): GithubIssue => ({
  closed_at,
  pull_request: isPr ? {} : null,
})
const pr = (closed_at: string | null): GithubPull => ({ closed_at, merged_at: closed_at })

describe('scoreResponsiveness — additive recent-close signal', () => {
  it('reads no issues and no pulls as unknown (no evidence), additive', () => {
    const c = scoreResponsiveness([], [], target, now)
    expect(c.dimension.dimension_state).toBe('unknown')
    expect(c.hasEvidence).toBe(false)
    expect(c.additive).toBe(true)
    expect(c.flags).toEqual([])
  })

  it('reads many recent PR closes alone (no issues) as strong — PRs count on their own', () => {
    const pulls = Array.from({ length: 6 }, () => pr(RECENT))
    const c = scoreResponsiveness([], pulls, target, now)
    expect(c.dimension.dimension_state).toBe('strong')
    expect(c.flags).toEqual([])
  })

  it('reads a few recent closes total as mixed', () => {
    const c = scoreResponsiveness([iss(RECENT)], [pr(RECENT)], target, now)
    expect(c.dimension.dimension_state).toBe('mixed')
    expect(c.flags).toEqual([])
  })

  it('reads only-old closes as unknown — nothing falls in the recent window', () => {
    const issues = Array.from({ length: 6 }, () => iss(OLD))
    const pulls = Array.from({ length: 6 }, () => pr(OLD))
    const c = scoreResponsiveness(issues, pulls, target, now)
    expect(c.dimension.dimension_state).toBe('unknown')
    expect(c.flags).toEqual([])
  })

  it('does NOT double-count PR rows in the issues array (pulls is the PR source)', () => {
    // 6 recent PR-marked rows in `issues`, empty `pulls` ⇒ they are excluded from
    // the issue count, so nothing recent remains ⇒ unknown.
    const issues = Array.from({ length: 6 }, () => iss(RECENT, true))
    const c = scoreResponsiveness(issues, [], target, now)
    expect(c.dimension.dimension_state).toBe('unknown')
    expect(c.flags).toEqual([])
  })

  it('links evidence where the activity is: PR-responsive repo links Pull requests, not Issues', () => {
    const pulls = Array.from({ length: 6 }, () => pr(RECENT))
    const c = scoreResponsiveness([], pulls, target, now)
    const labels = c.dimension.evidence_links.map((l) => l.label)
    expect(labels).toContain('Pull requests')
    expect(labels).not.toContain('Issues')
  })

  it('skips unparseable close dates without counting them (no NaN leak)', () => {
    // 5 valid recent issue closes (=strong) plus a malformed date that must be
    // ignored rather than poisoning the recency check.
    const issues = [...Array.from({ length: 5 }, () => iss(RECENT)), iss('not-a-date')]
    const c = scoreResponsiveness(issues, [], target, now)
    expect(c.dimension.dimension_state).toBe('strong')
  })
})
