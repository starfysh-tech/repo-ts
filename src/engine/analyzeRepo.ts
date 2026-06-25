import type { SupportedRepo } from '../content/parseRepoContext'
import type {
  AnalysisOutcome,
  AnalysisResult,
  AnalyzeDeps,
  CommunityFiles,
  CommunityProfileRaw,
  ConfidenceState,
  DimensionContribution,
  DimensionResult,
  Flag,
  RepoFetchResult,
  TrustState,
} from './types'
import { PLANNED_DIMENSION_COUNT, SCORE_VERSION } from './config'
import { scoreProvenance } from './provenance'
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

  const contributions: DimensionContribution[] = [
    scoreProvenance(repoRes.repo, target, deps.now),
    scoreSecurity(files, target),
    scoreTransparency(files, repoRes.repo, target),
  ]

  const flags: Flag[] = contributions.flatMap((c) => c.flags)
  const positives = contributions.flatMap((c) => c.positives)
  const evidenced = contributions.filter((c) => c.hasEvidence)
  const confidence = deriveConfidence(evidenced.length)
  const trustState = deriveTrustState(
    evidenced.map((c) => c.dimension),
    flags,
    confidence,
  )

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

/** Confidence = how many of the three dimensions produced affirmative evidence:
 *  3 → high, 2 → medium, ≤1 → low. A sparse repo reads low-confidence (limited
 *  evidence), not low-trust. */
function deriveConfidence(evidencedCount: number): ConfidenceState {
  if (evidencedCount >= PLANNED_DIMENSION_COUNT) return 'high'
  if (evidencedCount === PLANNED_DIMENSION_COUNT - 1) return 'medium'
  return 'low'
}

/** Deterministic top-level rollup (PRD order); `evidenced` is the set of
 *  dimensions that produced evidence:
 *  1. any high-severity flag (archived) → caution
 *  2. low confidence → insufficient_evidence
 *  3. majority of evidenced dimensions strong and no negative flags → strong_signals
 *  4. otherwise → mixed_signals */
function deriveTrustState(
  evidenced: DimensionResult[],
  flags: Flag[],
  confidence: ConfidenceState,
): TrustState {
  if (flags.some((f) => f.severity === 'high')) return 'caution'
  if (confidence === 'low') return 'insufficient_evidence'

  const strong = evidenced.filter((d) => d.dimension_state === 'strong').length
  if (strong > evidenced.length / 2 && flags.length === 0) return 'strong_signals'
  return 'mixed_signals'
}
