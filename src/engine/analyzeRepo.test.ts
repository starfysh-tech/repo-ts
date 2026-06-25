import { describe, it, expect } from 'vitest'
import { analyzeRepo } from './analyzeRepo'
import type { AnalysisOutcome, GithubRepo, RepoFetchResult } from './types'
import type { SupportedRepo } from '../content/parseRepoContext'

import reactRepo from './__fixtures__/repos/react.json'
import gotRepo from './__fixtures__/repos/got.json'
import isNumberRepo from './__fixtures__/repos/is-number.json'
import draftJsRepo from './__fixtures__/repos/draft-js.json'
import commanderRepo from './__fixtures__/repos/commander.json'
import hexToRgbRepo from './__fixtures__/repos/hex-to-rgb.json'
import testRepoRepo from './__fixtures__/repos/test-repo.json'

// Fixed reference time so age/dormancy and analyzed_at are deterministic.
const NOW = new Date('2026-06-24T00:00:00Z')

const target = (owner: string, repo: string): SupportedRepo => ({ kind: 'repo', owner, repo })

async function analyze(fixture: unknown, t: SupportedRepo): Promise<AnalysisOutcome> {
  const repo = fixture as GithubRepo
  return analyzeRepo({ fetchRepo: async () => ({ ok: true, repo }), now: NOW }, t)
}

function expectOk(outcome: AnalysisOutcome) {
  if (outcome.status !== 'ok') throw new Error(`expected ok, got ${outcome.status}`)
  return outcome.result
}

const provenanceOf = (outcome: AnalysisOutcome) =>
  expectOk(outcome).dimension_results.find((d) => d.dimension_key === 'provenance')!

describe('analyzeRepo — Provenance tracer', () => {
  it('stamps every analysis with the score version and the injected time', async () => {
    const result = expectOk(await analyze(reactRepo, target('facebook', 'react')))
    expect(result.score_version).toBe('0.1.0')
    expect(result.analyzed_at).toBe(NOW.toISOString())
  })

  it('reads a healthy org-owned licensed repo as strong provenance — but not yet a verdict', async () => {
    const outcome = await analyze(reactRepo, target('facebook', 'react'))
    const result = expectOk(outcome)
    expect(provenanceOf(outcome).dimension_state).toBe('strong')
    expect(result.positive_signals.map((p) => p.key)).toEqual(
      expect.arrayContaining(['org-owned', 'license-present', 'established']),
    )
    expect(result.flags).toHaveLength(0)
    // Only Provenance is evaluated this version → low confidence, not a bad score.
    expect(result.confidence_state).toBe('low')
    expect(result.trust_state).toBe('insufficient_evidence')
  })

  it('downgrades a personal-account repo to mixed provenance without flagging it', async () => {
    for (const [fixture, t] of [
      [gotRepo, target('sindresorhus', 'got')],
      [commanderRepo, target('tj', 'commander.js')],
    ] as const) {
      const outcome = await analyze(fixture, t)
      expect(provenanceOf(outcome).dimension_state).toBe('mixed')
      expect(expectOk(outcome).trust_state).not.toBe('caution')
    }
  })

  it('surfaces an archived repo as caution via a high-severity flag', async () => {
    const outcome = await analyze(draftJsRepo, target('facebookarchive', 'draft-js'))
    const result = expectOk(outcome)
    expect(result.trust_state).toBe('caution')
    expect(result.flags).toContainEqual(expect.objectContaining({ key: 'archived', severity: 'high' }))
  })

  // The load-bearing guardrail: a quiet, finished, licensed utility must never
  // be flagged risky merely for being stable. (is-number: last pushed 2022.)
  it('NEVER reads a stable finished utility as caution', async () => {
    const outcome = await analyze(isNumberRepo, target('jonschlinkert', 'is-number'))
    const result = expectOk(outcome)
    expect(result.trust_state).not.toBe('caution')
    expect(result.flags.some((f) => f.severity === 'high')).toBe(false)
    expect(provenanceOf(outcome).dimension_state).toBe('mixed')
  })

  it('reads an unlicensed brand-new repo as weak provenance with a license flag, not caution', async () => {
    const outcome = await analyze(hexToRgbRepo, target('The-Silent-Voyager-coder', 'hex-to-rgb-converter'))
    const result = expectOk(outcome)
    expect(provenanceOf(outcome).dimension_state).toBe('weak')
    expect(result.flags).toContainEqual(expect.objectContaining({ key: 'license-missing', severity: 'medium' }))
    expect(result.trust_state).toBe('insufficient_evidence')
  })

  it('flags a missing license on an unlicensed repo', async () => {
    const outcome = await analyze(testRepoRepo, target('MaxGoodfella', 'test-repo'))
    expect(provenanceOf(outcome).dimension_state).toBe('weak')
    expect(expectOk(outcome).flags.map((f) => f.key)).toContain('license-missing')
  })
})

describe('analyzeRepo — non-verdict outcomes', () => {
  const run = (fetchResult: RepoFetchResult) =>
    analyzeRepo({ fetchRepo: async () => fetchResult, now: NOW }, target('o', 'r'))

  it('maps a 404 to the private/unsupported outcome', async () => {
    expect(await run({ ok: false, reason: 'not_found' })).toEqual({ status: 'private' })
  })

  it('maps a transient failure to the error outcome (retryable, not a verdict)', async () => {
    expect(await run({ ok: false, reason: 'transient' })).toEqual({ status: 'error' })
  })

  it('surfaces the rate-limit recovery time', async () => {
    expect(await run({ ok: false, reason: 'rate_limited', resetAt: 1782358930000 })).toEqual({
      status: 'rate_limited',
      resetAt: 1782358930000,
    })
  })
})
