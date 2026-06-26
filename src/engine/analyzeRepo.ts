import type { SupportedRepo } from '../content/parseRepoContext'
import type {
  AnalysisOutcome,
  AnalysisResult,
  AnalyzeDeps,
  CommunityFiles,
  CommunityProfileRaw,
  ConfidenceState,
  DimensionContribution,
  Flag,
  RepoFetchResult,
  TrustState,
} from './types'
import { HIGH_CONFIDENCE_THRESHOLD, SCORE_VERSION } from './config'
import { scoreGovernance } from './governance'
import { scoreProvenance } from './provenance'
import { scoreRelease } from './release'
import { scoreSecurity } from './security'
import { scoreTransparency } from './transparency'

/**
 * The primary test seam. Fetches the repository and its community profile
 * through the injected boundary (at most two REST calls; the profile call is
 * skipped on a private repo) and produces the deterministic analysis. Network
 * failure modes map to distinct non-verdict outcomes so a hiccup is never shown
 * as a trust judgement.
 */
export async function analyzeRepo(deps: AnalyzeDeps, target: SupportedRepo): Promise<AnalysisOutcome> {
  const repoRes = await deps.fetchRepo(target)
  if (!repoRes.ok) return errorOutcome(repoRes)

  const profileRes = await deps.fetchCommunityProfile(target)
  let files: CommunityFiles
  if (profileRes.ok) {
    files = normalizeCommunityFiles(profileRes.profile)
  } else if (profileRes.reason === 'rate_limited') {
    return { status: 'rate_limited', resetAt: profileRes.resetAt ?? 0 }
  } else if (profileRes.reason === 'transient') {
    return { status: 'error' }
  } else {
    // A public repo's community profile should not 404; degrade gracefully by
    // treating it as no community evidence rather than failing the analysis.
    files = EMPTY_FILES
  }

  // Release is additive/optional — a failure of this 3rd call degrades to empty
  // rather than turning a successful repo+community fetch into an error/rate-limit
  // screen.
  const releasesRes = await deps.fetchReleases(target)
  const releases = releasesRes.ok ? releasesRes.releases : []

  // Governance is core, but a failed 5th call must not sink an otherwise-good
  // analysis — degrade to empty, which reads as no governance evidence.
  const contributorsRes = await deps.fetchContributors(target)
  const contributors = contributorsRes.ok ? contributorsRes.contributors : []

  const contributions: DimensionContribution[] = [
    scoreProvenance(repoRes.repo, target, deps.now),
    scoreSecurity(files, target),
    scoreTransparency(files, repoRes.repo, target),
    scoreRelease(releases, target, deps.now),
    scoreGovernance(contributors, target),
  ]

  const flags: Flag[] = contributions.flatMap((c) => c.flags)
  const positives = contributions.flatMap((c) => c.positives)
  const evidenced = contributions.filter((c) => c.hasEvidence)
  const confidence = deriveConfidence(evidenced.length)
  const trustState = deriveTrustState(evidenced, flags, confidence)

  const result: AnalysisResult = {
    trust_state: trustState,
    confidence_state: confidence,
    dimension_results: contributions.map((c) => c.dimension),
    flags,
    positive_signals: positives,
    score_version: SCORE_VERSION,
    analyzed_at: deps.now.toISOString(),
  }
  return { status: 'ok', result }
}

const EMPTY_FILES: CommunityFiles = {
  readme: false,
  license: false,
  code_of_conduct: false,
  contributing: false,
  security: false,
}

/** Raw community-profile files are objects-or-null; collapse to presence.
 *  Tolerates a null/undefined payload (e.g. a literal `null` JSON body). */
export function normalizeCommunityFiles(profile: CommunityProfileRaw | null | undefined): CommunityFiles {
  const files = profile?.files ?? {}
  return {
    readme: files.readme != null,
    license: files.license != null,
    code_of_conduct: files.code_of_conduct != null,
    contributing: files.contributing != null,
    security: files.security != null,
  }
}

function errorOutcome(fetched: Extract<RepoFetchResult, { ok: false }>): AnalysisOutcome {
  switch (fetched.reason) {
    case 'not_found':
      return { status: 'private' }
    case 'rate_limited':
      return { status: 'rate_limited', resetAt: fetched.resetAt ?? 0 }
    case 'transient':
      return { status: 'error' }
  }
}

/** Confidence = breadth of evidence across the four dimensions: ≥3 of 4
 *  evidenced → high, 2 → medium, ≤1 → low. A sparse repo reads low-confidence
 *  (limited evidence), not low-trust. */
function deriveConfidence(evidencedCount: number): ConfidenceState {
  if (evidencedCount >= HIGH_CONFIDENCE_THRESHOLD) return 'high'
  if (evidencedCount >= HIGH_CONFIDENCE_THRESHOLD - 1) return 'medium'
  return 'low'
}

/** Deterministic top-level rollup (PRD order); `evidenced` is the set of
 *  dimensions that produced evidence:
 *  1. any high-severity flag (archived) → caution
 *  2. low confidence → insufficient_evidence
 *  3. majority of the evidenced CORE dimensions strong and no negative flags → strong_signals
 *  4. otherwise → mixed_signals
 *
 *  Release is additive: a strong release counts toward the strong tally, but it
 *  is excluded from the majority denominator, so a stale-release `mixed` can never
 *  dilute and demote an otherwise-strong repo (release lifts, never lowers). */
function deriveTrustState(
  evidenced: DimensionContribution[],
  flags: Flag[],
  confidence: ConfidenceState,
): TrustState {
  if (flags.some((f) => f.severity === 'high')) return 'caution'
  if (confidence === 'low') return 'insufficient_evidence'

  // Additive dimensions (release) count toward the strong tally but are excluded
  // from the majority denominator, so they lift the verdict but never demote it.
  const core = evidenced.filter((c) => !c.additive)
  const strongCount = (cs: DimensionContribution[]) =>
    cs.filter((c) => c.dimension.dimension_state === 'strong').length
  const strong = strongCount(core) + strongCount(evidenced.filter((c) => c.additive))
  if (strong > core.length / 2 && flags.length === 0) return 'strong_signals'
  return 'mixed_signals'
}
