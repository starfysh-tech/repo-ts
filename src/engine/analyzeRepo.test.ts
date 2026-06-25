import { describe, it, expect } from 'vitest'
import { analyzeRepo } from './analyzeRepo'
import type {
  AnalysisOutcome,
  CommunityFetchResult,
  CommunityProfileRaw,
  ConfidenceState,
  DimensionKey,
  DimensionState,
  GithubRepo,
  RepoFetchResult,
  TrustState,
} from './types'
import type { SupportedRepo } from '../content/parseRepoContext'

import reactRepo from './__fixtures__/repos/react.json'
import gotRepo from './__fixtures__/repos/got.json'
import isNumberRepo from './__fixtures__/repos/is-number.json'
import draftJsRepo from './__fixtures__/repos/draft-js.json'
import commanderRepo from './__fixtures__/repos/commander.json'
import hexToRgbRepo from './__fixtures__/repos/hex-to-rgb.json'
import testRepoRepo from './__fixtures__/repos/test-repo.json'

import reactCp from './__fixtures__/community/react.json'
import gotCp from './__fixtures__/community/got.json'
import isNumberCp from './__fixtures__/community/is-number.json'
import draftJsCp from './__fixtures__/community/draft-js.json'
import commanderCp from './__fixtures__/community/commander.json'
import hexToRgbCp from './__fixtures__/community/hex-to-rgb.json'
import testRepoCp from './__fixtures__/community/test-repo.json'

// Fixed reference time so age/dormancy and analyzed_at are deterministic.
const NOW = new Date('2026-06-24T00:00:00Z')

const target = (owner: string, repo: string): SupportedRepo => ({ kind: 'repo', owner, repo })

interface Archetype {
  name: string
  repo: unknown
  community: unknown
  target: SupportedRepo
  trust: TrustState
  confidence: ConfidenceState
  provenance: DimensionState
  security: DimensionState
  transparency: DimensionState
}

// Expectations finalized against the committed real-API fixtures (issue 04).
const ARCHETYPES: Archetype[] = [
  { name: 'react', repo: reactRepo, community: reactCp, target: target('facebook', 'react'),
    trust: 'strong_signals', confidence: 'high', provenance: 'strong', security: 'mixed', transparency: 'strong' },
  { name: 'got', repo: gotRepo, community: gotCp, target: target('sindresorhus', 'got'),
    trust: 'strong_signals', confidence: 'high', provenance: 'strong', security: 'mixed', transparency: 'strong' },
  { name: 'commander', repo: commanderRepo, community: commanderCp, target: target('tj', 'commander.js'),
    trust: 'strong_signals', confidence: 'medium', provenance: 'strong', security: 'unknown', transparency: 'strong' },
  { name: 'is-number', repo: isNumberRepo, community: isNumberCp, target: target('jonschlinkert', 'is-number'),
    trust: 'mixed_signals', confidence: 'medium', provenance: 'mixed', security: 'unknown', transparency: 'strong' },
  { name: 'draft-js', repo: draftJsRepo, community: draftJsCp, target: target('facebookarchive', 'draft-js'),
    trust: 'caution', confidence: 'high', provenance: 'mixed', security: 'mixed', transparency: 'strong' },
  { name: 'hex-to-rgb', repo: hexToRgbRepo, community: hexToRgbCp, target: target('The-Silent-Voyager-coder', 'hex-to-rgb-converter'),
    trust: 'insufficient_evidence', confidence: 'low', provenance: 'weak', security: 'unknown', transparency: 'mixed' },
  { name: 'test-repo', repo: testRepoRepo, community: testRepoCp, target: target('MaxGoodfella', 'test-repo'),
    trust: 'insufficient_evidence', confidence: 'low', provenance: 'weak', security: 'unknown', transparency: 'unknown' },
]

async function analyze(a: Archetype): Promise<AnalysisOutcome> {
  return analyzeRepo(
    {
      fetchRepo: async () => ({ ok: true, repo: a.repo as GithubRepo }),
      fetchCommunityProfile: async () => ({ ok: true, profile: a.community as CommunityProfileRaw }),
      now: NOW,
    },
    a.target,
  )
}

function expectOk(outcome: AnalysisOutcome) {
  if (outcome.status !== 'ok') throw new Error(`expected ok, got ${outcome.status}`)
  return outcome.result
}

const dimState = (outcome: AnalysisOutcome, key: DimensionKey): DimensionState =>
  expectOk(outcome).dimension_results.find((d) => d.dimension_key === key)!.dimension_state

describe('analyzeRepo — full three-dimension engine', () => {
  it('stamps every analysis with the score version and the injected time', async () => {
    const result = expectOk(await analyze(ARCHETYPES[0]))
    expect(result.score_version).toBe('0.1.0')
    expect(result.analyzed_at).toBe(NOW.toISOString())
    expect(result.dimension_results.map((d) => d.dimension_key)).toEqual(['provenance', 'security', 'transparency'])
  })

  for (const a of ARCHETYPES) {
    it(`${a.name}: ${a.trust} / ${a.confidence}`, async () => {
      const outcome = await analyze(a)
      const result = expectOk(outcome)
      expect(result.trust_state).toBe(a.trust)
      expect(result.confidence_state).toBe(a.confidence)
      expect(dimState(outcome, 'provenance')).toBe(a.provenance)
      expect(dimState(outcome, 'security')).toBe(a.security)
      expect(dimState(outcome, 'transparency')).toBe(a.transparency)
    })
  }

  // The load-bearing guardrail: a quiet, finished, licensed utility must never
  // be flagged risky merely for being stable. (is-number: last pushed 2022.)
  it('NEVER reads a stable finished utility (is-number) as caution', async () => {
    const a = ARCHETYPES.find((x) => x.name === 'is-number')!
    const result = expectOk(await analyze(a))
    expect(result.trust_state).not.toBe('caution')
    expect(result.flags.some((f) => f.severity === 'high')).toBe(false)
  })

  it('surfaces an archived repo as caution via a high-severity flag', async () => {
    const a = ARCHETYPES.find((x) => x.name === 'draft-js')!
    const result = expectOk(await analyze(a))
    expect(result.trust_state).toBe('caution')
    expect(result.flags).toContainEqual(expect.objectContaining({ key: 'archived', severity: 'high' }))
  })

  it('does NOT penalize an org-default .github fallback (got keeps its CoC/contributing)', async () => {
    const a = ARCHETYPES.find((x) => x.name === 'got')!
    const result = expectOk(await analyze(a))
    expect(result.positive_signals.map((p) => p.key)).toEqual(
      expect.arrayContaining(['code-of-conduct', 'contributing']),
    )
  })

  it('flags a missing license as medium severity, never caution', async () => {
    const a = ARCHETYPES.find((x) => x.name === 'hex-to-rgb')!
    const result = expectOk(await analyze(a))
    expect(result.flags).toContainEqual(expect.objectContaining({ key: 'license-missing', severity: 'medium' }))
    expect(result.trust_state).not.toBe('caution')
  })
})

describe('analyzeRepo — non-verdict outcomes', () => {
  const okRepo = reactRepo as GithubRepo
  const run = (repo: RepoFetchResult, community: CommunityFetchResult) =>
    analyzeRepo(
      { fetchRepo: async () => repo, fetchCommunityProfile: async () => community, now: NOW },
      target('o', 'r'),
    )

  it('maps a repo 404 to private and never makes the second call', async () => {
    let communityCalled = false
    const outcome = await analyzeRepo(
      {
        fetchRepo: async () => ({ ok: false, reason: 'not_found' }),
        fetchCommunityProfile: async () => {
          communityCalled = true
          return { ok: true, profile: {} }
        },
        now: NOW,
      },
      target('o', 'r'),
    )
    expect(outcome).toEqual({ status: 'private' })
    expect(communityCalled).toBe(false)
  })

  it('maps a transient repo failure to the retryable error outcome', async () => {
    expect(await run({ ok: false, reason: 'transient' }, { ok: true, profile: {} })).toEqual({ status: 'error' })
  })

  it('surfaces the rate-limit recovery time from either call', async () => {
    expect(await run({ ok: true, repo: okRepo }, { ok: false, reason: 'rate_limited', resetAt: 1782358930000 })).toEqual({
      status: 'rate_limited',
      resetAt: 1782358930000,
    })
  })

  it('degrades gracefully when the community profile 404s (scores provenance only)', async () => {
    const outcome = await run({ ok: true, repo: okRepo }, { ok: false, reason: 'not_found' })
    expect(outcome.status).toBe('ok')
  })
})

describe('evidence links — only for observed signals (never a 404)', () => {
  const links = (outcome: AnalysisOutcome, key: DimensionKey) =>
    expectOk(outcome).dimension_results.find((d) => d.dimension_key === key)!.evidence_links

  const analyzeWith = (repo: unknown, profile: CommunityProfileRaw) =>
    analyzeRepo(
      {
        fetchRepo: async () => ({ ok: true, repo: repo as GithubRepo }),
        fetchCommunityProfile: async () => ({ ok: true, profile }),
        now: NOW,
      },
      target('o', 'r'),
    )

  it('omits the security-policy link when no security file is present', async () => {
    // react's fixture has no security file.
    const outcome = await analyze(ARCHETYPES.find((a) => a.name === 'react')!)
    expect(links(outcome, 'security').some((l) => l.url.endsWith('/security/policy'))).toBe(false)
  })

  it('includes the security-policy link only when a security file is observed', async () => {
    const outcome = await analyzeWith(reactRepo, { files: { security: { url: 'x' } } })
    expect(links(outcome, 'security').some((l) => l.url.endsWith('/security/policy'))).toBe(true)
  })

  it('includes a README link when a README is observed', async () => {
    const outcome = await analyze(ARCHETYPES.find((a) => a.name === 'react')!)
    expect(links(outcome, 'transparency').some((l) => l.url.includes('#readme'))).toBe(true)
  })
})
