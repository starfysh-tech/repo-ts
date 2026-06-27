import type { SupportedRepo } from '../content/parseRepoContext'
import type { ScoringConfig } from './config'

// ── GitHub data (the subset of `GET /repos/{owner}/{repo}` we read) ──────────
export interface GithubRepo {
  full_name: string
  private: boolean
  archived: boolean
  disabled: boolean
  fork: boolean
  license: { key: string; spdx_id: string | null } | null
  owner: { type: 'User' | 'Organization'; login: string }
  created_at: string
  pushed_at: string
  homepage: string | null
  topics: string[]
  description: string | null
}

export interface GithubRelease {
  tag_name: string
  name: string | null
  draft: boolean
  prerelease: boolean
  created_at: string
  published_at: string | null
  html_url: string
}

export interface GithubContributor {
  login: string
  type: string
  contributions: number
}

export interface GithubIssue {
  closed_at: string | null
  pull_request?: object | null
}

export interface GithubPull {
  closed_at: string | null
  merged_at: string | null
}

// ── Qualitative output states (never numeric scores shown to users) ──────────
export type TrustState = 'strong_signals' | 'mixed_signals' | 'caution' | 'insufficient_evidence'
export type ConfidenceState = 'high' | 'medium' | 'low'
export type DimensionState = 'strong' | 'mixed' | 'weak' | 'unknown'
export type DimensionKey =
  | 'provenance'
  | 'security'
  | 'transparency'
  | 'release'
  | 'governance'
  | 'responsiveness'
export type Severity = 'high' | 'medium' | 'low' | 'very_low'

export interface EvidenceLink {
  label: string
  url: string
}

export interface Flag {
  key: string
  severity: Severity
  label: string
}

export interface PositiveSignal {
  key: string
  label: string
}

export interface DimensionResult {
  dimension_key: DimensionKey
  dimension_state: DimensionState
  confidence_state: ConfidenceState
  triggered_signals: string[]
  evidence_links: EvidenceLink[]
  rationale_summary: string
}

export interface AnalysisResult {
  trust_state: TrustState
  confidence_state: ConfidenceState
  dimension_results: DimensionResult[]
  flags: Flag[]
  positive_signals: PositiveSignal[]
  score_version: string
  analyzed_at: string
}

// ── GitHub community profile (`GET /repos/{owner}/{repo}/community/profile`) ──
// Load-bearing: resolves community-health files the way GitHub does, including
// the org-default `.github` fallback (verified unauthenticated in spike 01).
// Raw shape — files are objects-or-null; we only read presence.
export interface CommunityProfileRaw {
  health_percentage?: number | null
  files?: {
    readme?: unknown
    license?: unknown
    code_of_conduct?: unknown
    contributing?: unknown
    security?: unknown
  } | null
}

/** Normalized file presence used by the scorers. */
export interface CommunityFiles {
  readme: boolean
  license: boolean
  code_of_conduct: boolean
  contributing: boolean
  security: boolean
}

// ── Network boundary (the injected seam) ─────────────────────────────────────
export type RepoFetchResult =
  | { ok: true; repo: GithubRepo }
  | { ok: false; reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }

export type CommunityFetchResult =
  | { ok: true; profile: CommunityProfileRaw }
  | { ok: false; reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }

export type ReleasesFetchResult =
  | { ok: true; releases: GithubRelease[] }
  | { ok: false; reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }

export type ContributorsFetchResult =
  | { ok: true; contributors: GithubContributor[] }
  | { ok: false; reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }

export type IssuesFetchResult =
  | { ok: true; issues: GithubIssue[] }
  | { ok: false; reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }

export type PullsFetchResult =
  | { ok: true; pulls: GithubPull[] }
  | { ok: false; reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }

export interface AnalyzeDeps {
  fetchRepo: (target: SupportedRepo) => Promise<RepoFetchResult>
  fetchCommunityProfile: (target: SupportedRepo) => Promise<CommunityFetchResult>
  fetchReleases: (target: SupportedRepo) => Promise<ReleasesFetchResult>
  fetchContributors: (target: SupportedRepo) => Promise<ContributorsFetchResult>
  fetchIssues: (target: SupportedRepo) => Promise<IssuesFetchResult>
  fetchPulls: (target: SupportedRepo) => Promise<PullsFetchResult>
  /** Injected reference time so age/dormancy and `analyzed_at` are deterministic in tests. */
  now: Date
  /** Active scoring configuration. Omitted → `DEFAULT_SCORING_CONFIG` (the original
   *  hardcoded behavior), so existing callers/tests need no change. */
  config?: ScoringConfig
}

/**
 * The result the content script renders. `private` covers the unauthenticated
 * 404 (private/non-existent repo); `rate_limited` and `error` are distinct,
 * non-alarmist states — never a trust verdict.
 */
export type AnalysisOutcome =
  | { status: 'ok'; result: AnalysisResult }
  | { status: 'private' }
  | { status: 'rate_limited'; resetAt: number }
  | { status: 'error' }

/** A dimension scorer's contribution to the overall analysis. */
export interface DimensionContribution {
  dimension: DimensionResult
  /** Did this dimension observe affirmative evidence? Drives confidence breadth
   *  (a sparse repo reads low-confidence, not bad). */
  hasEvidence: boolean
  /** Additive dimension: it can lift the top-level verdict toward strong but must
   *  never demote it — excluded from the trust-majority denominator. (Release.) */
  additive?: boolean
  flags: Flag[]
  positives: PositiveSignal[]
}
