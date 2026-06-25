import type { SupportedRepo } from '../content/parseRepoContext'

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

// ── Qualitative output states (never numeric scores shown to users) ──────────
export type TrustState = 'strong_signals' | 'mixed_signals' | 'caution' | 'insufficient_evidence'
export type ConfidenceState = 'high' | 'medium' | 'low'
export type DimensionState = 'strong' | 'mixed' | 'weak' | 'unknown'
export type DimensionKey = 'provenance' | 'security' | 'transparency'
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

// ── Network boundary (the injected seam) ─────────────────────────────────────
export type RepoFetchResult =
  | { ok: true; repo: GithubRepo }
  | { ok: false; reason: 'not_found' | 'rate_limited' | 'transient'; resetAt?: number }

export interface AnalyzeDeps {
  fetchRepo: (target: SupportedRepo) => Promise<RepoFetchResult>
  /** Injected reference time so age/dormancy and `analyzed_at` are deterministic in tests. */
  now: Date
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
  flags: Flag[]
  positives: PositiveSignal[]
}
