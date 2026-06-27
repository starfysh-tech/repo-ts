import { describe, it, expect } from 'vitest'
import { analyzeRepo } from './analyzeRepo'
import { DEFAULT_SCORING_CONFIG, SCORING_PRESETS, type ScoringConfig } from './config'
import type {
  AnalysisOutcome,
  CommunityFetchResult,
  CommunityProfileRaw,
  ConfidenceState,
  DimensionKey,
  DimensionState,
  GithubContributor,
  GithubIssue,
  GithubPull,
  GithubRelease,
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

import reactRel from './__fixtures__/releases/react.json'
import gotRel from './__fixtures__/releases/got.json'
import isNumberRel from './__fixtures__/releases/is-number.json'
import draftJsRel from './__fixtures__/releases/draft-js.json'
import commanderRel from './__fixtures__/releases/commander.json'
import hexToRgbRel from './__fixtures__/releases/hex-to-rgb.json'
import testRepoRel from './__fixtures__/releases/test-repo.json'

import reactCon from './__fixtures__/contributors/react.json'
import gotCon from './__fixtures__/contributors/got.json'
import isNumberCon from './__fixtures__/contributors/is-number.json'
import draftJsCon from './__fixtures__/contributors/draft-js.json'
import commanderCon from './__fixtures__/contributors/commander.json'
import hexToRgbCon from './__fixtures__/contributors/hex-to-rgb.json'
import testRepoCon from './__fixtures__/contributors/test-repo.json'

import reactIss from './__fixtures__/issues/react.json'
import gotIss from './__fixtures__/issues/got.json'
import isNumberIss from './__fixtures__/issues/is-number.json'
import draftJsIss from './__fixtures__/issues/draft-js.json'
import commanderIss from './__fixtures__/issues/commander.json'
import hexToRgbIss from './__fixtures__/issues/hex-to-rgb.json'
import testRepoIss from './__fixtures__/issues/test-repo.json'

import reactPr from './__fixtures__/pulls/react.json'
import gotPr from './__fixtures__/pulls/got.json'
import isNumberPr from './__fixtures__/pulls/is-number.json'
import draftJsPr from './__fixtures__/pulls/draft-js.json'
import commanderPr from './__fixtures__/pulls/commander.json'
import hexToRgbPr from './__fixtures__/pulls/hex-to-rgb.json'
import testRepoPr from './__fixtures__/pulls/test-repo.json'

// A synthetic manufactured-credibility archetype: created 14 days before NOW
// (very-new), licensed personal repo, yet already strong on release + governance +
// responsiveness. Locks both the provenance gate (capped at mixed) and the guard.
import ponytailRepo from './__fixtures__/repos/ponytail.json'
import ponytailCp from './__fixtures__/community/ponytail.json'
import ponytailRel from './__fixtures__/releases/ponytail.json'
import ponytailCon from './__fixtures__/contributors/ponytail.json'
import ponytailIss from './__fixtures__/issues/ponytail.json'
import ponytailPr from './__fixtures__/pulls/ponytail.json'

// Fixed reference time so age/dormancy and analyzed_at are deterministic.
const NOW = new Date('2026-06-24T00:00:00Z')

const target = (owner: string, repo: string): SupportedRepo => ({ kind: 'repo', owner, repo })

interface Archetype {
  name: string
  repo: unknown
  community: unknown
  releases: unknown
  contributors: unknown
  issues: unknown
  pulls: unknown
  target: SupportedRepo
  trust: TrustState
  confidence: ConfidenceState
  provenance: DimensionState
  security: DimensionState
  transparency: DimensionState
  release: DimensionState
  governance: DimensionState
  responsiveness: DimensionState
}

// Expectations finalized against the committed real-API fixtures (issue 04).
const ARCHETYPES: Archetype[] = [
  { name: 'react', repo: reactRepo, community: reactCp, releases: reactRel, contributors: reactCon, issues: reactIss, pulls: reactPr, target: target('facebook', 'react'),
    trust: 'strong_signals', confidence: 'high', provenance: 'strong', security: 'mixed', transparency: 'strong', release: 'strong', governance: 'strong', responsiveness: 'strong' },
  { name: 'got', repo: gotRepo, community: gotCp, releases: gotRel, contributors: gotCon, issues: gotIss, pulls: gotPr, target: target('sindresorhus', 'got'),
    trust: 'strong_signals', confidence: 'high', provenance: 'strong', security: 'mixed', transparency: 'strong', release: 'strong', governance: 'strong', responsiveness: 'strong' },
  { name: 'commander', repo: commanderRepo, community: commanderCp, releases: commanderRel, contributors: commanderCon, issues: commanderIss, pulls: commanderPr, target: target('tj', 'commander.js'),
    trust: 'strong_signals', confidence: 'high', provenance: 'strong', security: 'unknown', transparency: 'strong', release: 'strong', governance: 'strong', responsiveness: 'strong' },
  { name: 'is-number', repo: isNumberRepo, community: isNumberCp, releases: isNumberRel, contributors: isNumberCon, issues: isNumberIss, pulls: isNumberPr, target: target('jonschlinkert', 'is-number'),
    trust: 'mixed_signals', confidence: 'high', provenance: 'mixed', security: 'unknown', transparency: 'strong', release: 'unknown', governance: 'weak', responsiveness: 'unknown' },
  { name: 'draft-js', repo: draftJsRepo, community: draftJsCp, releases: draftJsRel, contributors: draftJsCon, issues: draftJsIss, pulls: draftJsPr, target: target('facebookarchive', 'draft-js'),
    trust: 'caution', confidence: 'high', provenance: 'mixed', security: 'mixed', transparency: 'strong', release: 'mixed', governance: 'strong', responsiveness: 'unknown' },
  { name: 'hex-to-rgb', repo: hexToRgbRepo, community: hexToRgbCp, releases: hexToRgbRel, contributors: hexToRgbCon, issues: hexToRgbIss, pulls: hexToRgbPr, target: target('The-Silent-Voyager-coder', 'hex-to-rgb-converter'),
    trust: 'insufficient_evidence', confidence: 'low', provenance: 'weak', security: 'unknown', transparency: 'mixed', release: 'unknown', governance: 'unknown', responsiveness: 'unknown' },
  { name: 'test-repo', repo: testRepoRepo, community: testRepoCp, releases: testRepoRel, contributors: testRepoCon, issues: testRepoIss, pulls: testRepoPr, target: target('MaxGoodfella', 'test-repo'),
    trust: 'insufficient_evidence', confidence: 'low', provenance: 'weak', security: 'unknown', transparency: 'unknown', release: 'unknown', governance: 'unknown', responsiveness: 'unknown' },
  // Very-new + all-maturity-strong: provenance is `mixed` (licensed but newly
  // created), so the gate caps it at mixed_signals despite the strong activity
  // majority — and the manufactured-credibility guard fires (asserted separately).
  { name: 'ponytail', repo: ponytailRepo, community: ponytailCp, releases: ponytailRel, contributors: ponytailCon, issues: ponytailIss, pulls: ponytailPr, target: target('DietrichGebert', 'ponytail'),
    trust: 'mixed_signals', confidence: 'high', provenance: 'mixed', security: 'unknown', transparency: 'strong', release: 'strong', governance: 'strong', responsiveness: 'strong' },
]

async function analyze(a: Archetype): Promise<AnalysisOutcome> {
  return analyzeRepo(
    {
      fetchRepo: async () => ({ ok: true, repo: a.repo as GithubRepo }),
      fetchCommunityProfile: async () => ({ ok: true, profile: a.community as CommunityProfileRaw }),
      fetchReleases: async () => ({ ok: true, releases: a.releases as GithubRelease[] }),
      fetchContributors: async () => ({ ok: true, contributors: a.contributors as GithubContributor[] }),
      fetchIssues: async () => ({ ok: true, issues: a.issues as GithubIssue[] }),
      fetchPulls: async () => ({ ok: true, pulls: a.pulls as GithubPull[] }),
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
    expect(result.score_version).toBe('0.7.0')
    expect(result.analyzed_at).toBe(NOW.toISOString())
    expect(result.dimension_results.map((d) => d.dimension_key)).toEqual(['provenance', 'security', 'transparency', 'release', 'governance', 'responsiveness'])
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
      expect(dimState(outcome, 'release')).toBe(a.release)
      expect(dimState(outcome, 'governance')).toBe(a.governance)
      expect(dimState(outcome, 'responsiveness')).toBe(a.responsiveness)
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

  // Release is additive: it must lift, never demote. A repo strong on its core
  // dimensions with only STALE releases (release => mixed) must stay
  // strong_signals — the mixed release must not dilute the core majority.
  it('a stale-release (mixed) dimension never demotes an otherwise-strong repo', async () => {
    const staleReleases: GithubRelease[] = [
      { tag_name: 'v2.0.0', name: 'v2.0.0', draft: false, prerelease: false,
        created_at: '2019-01-01T00:00:00Z', published_at: '2019-01-01T00:00:00Z', html_url: 'x' },
      { tag_name: 'v1.0.0', name: 'v1.0.0', draft: false, prerelease: false,
        created_at: '2018-01-01T00:00:00Z', published_at: '2018-01-01T00:00:00Z', html_url: 'x' },
    ]
    const outcome = await analyzeRepo(
      {
        fetchRepo: async () => ({ ok: true, repo: reactRepo as GithubRepo }),
        fetchCommunityProfile: async () => ({ ok: true, profile: reactCp as CommunityProfileRaw }),
        fetchReleases: async () => ({ ok: true, releases: staleReleases }),
        fetchContributors: async () => ({ ok: true, contributors: [] }),
        fetchIssues: async () => ({ ok: true, issues: [] }),
        fetchPulls: async () => ({ ok: true, pulls: [] }),
        now: NOW,
      },
      target('facebook', 'react'),
    )
    const result = expectOk(outcome)
    expect(dimState(outcome, 'release')).toBe('mixed')
    expect(result.trust_state).toBe('strong_signals')
  })

  it('gates STRONG on provenance: a mixed-provenance repo caps at mixed despite a strong-majority', async () => {
    // React's deps are strong across the board, but force the repo dormant so its
    // provenance reads `mixed` (licensed + established yet stale). Transparency and
    // governance stay strong, so a strong CORE majority survives — pre-gate this was
    // `strong_signals`. The provenance gate must now cap it at `mixed_signals`,
    // because the top verdict requires provenance itself to be strong.
    const dormantRepo = { ...reactRepo, pushed_at: '2023-01-01T00:00:00Z' } as GithubRepo
    const outcome = await analyzeRepo(
      {
        fetchRepo: async () => ({ ok: true, repo: dormantRepo }),
        fetchCommunityProfile: async () => ({ ok: true, profile: reactCp as CommunityProfileRaw }),
        fetchReleases: async () => ({ ok: true, releases: reactRel as GithubRelease[] }),
        fetchContributors: async () => ({ ok: true, contributors: reactCon as GithubContributor[] }),
        fetchIssues: async () => ({ ok: true, issues: reactIss as GithubIssue[] }),
        fetchPulls: async () => ({ ok: true, pulls: reactPr as GithubPull[] }),
        now: NOW,
      },
      target('facebook', 'react'),
    )
    const result = expectOk(outcome)
    expect(dimState(outcome, 'provenance')).toBe('mixed')
    expect(dimState(outcome, 'transparency')).toBe('strong')
    expect(dimState(outcome, 'governance')).toBe('strong')
    expect(result.flags).toEqual([]) // no flag is doing the capping — the gate is
    expect(result.trust_state).toBe('mixed_signals')
  })

  // Slice A proof: the injected config actually reaches the scorers and the
  // rollup. Same react fixtures, only the config differs — raising establishedDays
  // beyond any real age strips react of "established", dropping provenance
  // strong→mixed, which the gate then caps at mixed_signals. A shift here can only
  // come from config threading end-to-end (scorer + gate).
  it('threads a non-default config into the engine (config seam)', async () => {
    const a = ARCHETYPES.find((x) => x.name === 'react')!
    const baselineOutcome = await analyze(a)
    expect(expectOk(baselineOutcome).trust_state).toBe('strong_signals') // default config
    expect(dimState(baselineOutcome, 'provenance')).toBe('strong')

    const strict: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, establishedDays: 100_000_000 }
    const outcome = await analyzeRepo(
      {
        fetchRepo: async () => ({ ok: true, repo: a.repo as GithubRepo }),
        fetchCommunityProfile: async () => ({ ok: true, profile: a.community as CommunityProfileRaw }),
        fetchReleases: async () => ({ ok: true, releases: a.releases as GithubRelease[] }),
        fetchContributors: async () => ({ ok: true, contributors: a.contributors as GithubContributor[] }),
        fetchIssues: async () => ({ ok: true, issues: a.issues as GithubIssue[] }),
        fetchPulls: async () => ({ ok: true, pulls: a.pulls as GithubPull[] }),
        now: NOW,
        config: strict,
      },
      a.target,
    )
    expect(dimState(outcome, 'provenance')).toBe('mixed')
    expect(expectOk(outcome).trust_state).toBe('mixed_signals')
  })

  it('caveats a manufactured-credibility repo (very-new + all maturity strong), never caution', async () => {
    const a = ARCHETYPES.find((x) => x.name === 'ponytail')!
    const result = expectOk(await analyze(a))
    expect(result.flags).toContainEqual(
      expect.objectContaining({ key: 'manufactured-credibility', severity: 'medium' }),
    )
    // The gate caps it at mixed; the guard adds the explanation but never escalates.
    expect(result.trust_state).toBe('mixed_signals')
    expect(result.trust_state).not.toBe('caution')
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

describe('scoring presets', () => {
  // Guardrail under EVERY preset: is-number (a quiet, finished, licensed utility)
  // must never be caution and never carry a high-severity flag, regardless of how
  // the preset tunes guard sensitivity / thresholds.
  for (const preset of ['balanced', 'cautious', 'minimal'] as const) {
    it(`${preset}: is-number is never caution and carries no high-severity flag`, async () => {
      const outcome = await analyzeRepo(
        {
          fetchRepo: async () => ({ ok: true, repo: isNumberRepo as GithubRepo }),
          fetchCommunityProfile: async () => ({ ok: true, profile: isNumberCp as CommunityProfileRaw }),
          fetchReleases: async () => ({ ok: true, releases: isNumberRel as GithubRelease[] }),
          fetchContributors: async () => ({ ok: true, contributors: isNumberCon as GithubContributor[] }),
          fetchIssues: async () => ({ ok: true, issues: isNumberIss as GithubIssue[] }),
          fetchPulls: async () => ({ ok: true, pulls: isNumberPr as GithubPull[] }),
          now: NOW,
          config: SCORING_PRESETS[preset],
        },
        target('jonschlinkert', 'is-number'),
      )
      const result = expectOk(outcome)
      expect(result.trust_state).not.toBe('caution')
      expect(result.flags.every((f) => f.severity !== 'high')).toBe(true)
    })
  }

  const analyzePonytailWith = (config: ScoringConfig) =>
    analyzeRepo(
      {
        fetchRepo: async () => ({ ok: true, repo: ponytailRepo as GithubRepo }),
        fetchCommunityProfile: async () => ({ ok: true, profile: ponytailCp as CommunityProfileRaw }),
        fetchReleases: async () => ({ ok: true, releases: ponytailRel as GithubRelease[] }),
        fetchContributors: async () => ({ ok: true, contributors: ponytailCon as GithubContributor[] }),
        fetchIssues: async () => ({ ok: true, issues: ponytailIss as GithubIssue[] }),
        fetchPulls: async () => ({ ok: true, pulls: ponytailPr as GithubPull[] }),
        now: NOW,
        config,
      },
      target('DietrichGebert', 'ponytail'),
    )

  const hasManufacturedCredibility = (result: ReturnType<typeof expectOk>) =>
    result.flags.some((f) => f.key === 'manufactured-credibility')

  it('balanced keeps the manufactured-credibility caveat (still capped at mixed)', async () => {
    const result = expectOk(await analyzePonytailWith(SCORING_PRESETS.balanced))
    expect(hasManufacturedCredibility(result)).toBe(true)
    expect(result.trust_state).toBe('mixed_signals')
  })

  it('minimal drops the manufactured-credibility caveat (guard off, still capped at mixed)', async () => {
    const result = expectOk(await analyzePonytailWith(SCORING_PRESETS.minimal))
    expect(hasManufacturedCredibility(result)).toBe(false)
    expect(result.trust_state).toBe('mixed_signals')
  })

  it('cautious keeps the manufactured-credibility caveat (any-2-of-3 fires on an all-3 repo)', async () => {
    const result = expectOk(await analyzePonytailWith(SCORING_PRESETS.cautious))
    expect(hasManufacturedCredibility(result)).toBe(true)
  })
})

describe('analyzeRepo — non-verdict outcomes', () => {
  const okRepo = reactRepo as GithubRepo
  const run = (repo: RepoFetchResult, community: CommunityFetchResult) =>
    analyzeRepo(
      {
        fetchRepo: async () => repo,
        fetchCommunityProfile: async () => community,
        fetchReleases: async () => ({ ok: true, releases: [] }),
        fetchContributors: async () => ({ ok: true, contributors: [] }),
        fetchIssues: async () => ({ ok: true, issues: [] }),
        fetchPulls: async () => ({ ok: true, pulls: [] }),
        now: NOW,
      },
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
        fetchReleases: async () => ({ ok: true, releases: [] }),
        fetchContributors: async () => ({ ok: true, contributors: [] }),
        fetchIssues: async () => ({ ok: true, issues: [] }),
        fetchPulls: async () => ({ ok: true, pulls: [] }),
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
        fetchReleases: async () => ({ ok: true, releases: [] }),
        fetchContributors: async () => ({ ok: true, contributors: [] }),
        fetchIssues: async () => ({ ok: true, issues: [] }),
        fetchPulls: async () => ({ ok: true, pulls: [] }),
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
