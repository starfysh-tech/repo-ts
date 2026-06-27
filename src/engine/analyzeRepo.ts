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
import { detectManufacturedCredibility } from './manufacturedCredibility'
import { scoreGovernance } from './governance'
import { scoreProvenance } from './provenance'
import { scoreRelease } from './release'
import { scoreResponsiveness } from './responsiveness'
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

  // Responsiveness is additive/optional — these two calls degrade to empty
  // rather than turning an otherwise-good analysis into an error/rate-limit screen.
  // Independent calls — fetch concurrently (both fire regardless, so this only
  // trims latency, never changes the request count).
  const [issuesRes, pullsRes] = await Promise.all([deps.fetchIssues(target), deps.fetchPulls(target)])
  const issues = issuesRes.ok ? issuesRes.issues : []
  const pulls = pullsRes.ok ? pullsRes.pulls : []

  const contributions: DimensionContribution[] = [
    scoreProvenance(repoRes.repo, target, deps.now),
    scoreSecurity(files, target),
    scoreTransparency(files, repoRes.repo, target),
    scoreRelease(releases, target, deps.now),
    scoreGovernance(contributors, target),
    scoreResponsiveness(issues, pulls, target, deps.now),
  ]

  const flags: Flag[] = contributions.flatMap((c) => c.flags)
  // Cross-dimension caveat: a very-new repo already showing every maturity signal
  // (release + governance + responsiveness all strong) is a manufactured-trust tell.
  // Sub-caution (medium) — surfaced as a caveat, never escalated to `caution`.
  const manufactured = detectManufacturedCredibility(contributions, repoRes.repo, deps.now)
  if (manufactured) flags.push(manufactured)

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
 *  3. provenance strong AND majority of the evidenced CORE dimensions strong AND no
 *     negative flags → strong_signals
 *  4. otherwise → mixed_signals
 *
 *  Release is additive: a strong release counts toward the strong tally, but it
 *  is excluded from the majority denominator, so a stale-release `mixed` can never
 *  dilute and demote an otherwise-strong repo (release lifts, never lowers).
 *
 *  Provenance gate (rule 3): the top verdict requires provenance itself to be
 *  strong, so a repo can't read STRONG on activity alone when its origin/standing
 *  is only caveated (newly created, dormant, unlicensed-but-established, …). */
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

  // Provenance gate: STRONG additionally requires provenance itself to be strong
  // (licensed, established, current, not dormant). A repo can't earn the top verdict
  // on activity alone when its origin/standing is only caveated — this blocks a
  // newly-created or otherwise mixed-provenance repo from reading STRONG even with a
  // strong activity majority. A strong provenance always carries evidence, so it is
  // present in `evidenced` whenever it qualifies.
  const provenanceStrong = evidenced.some(
    (c) => c.dimension.dimension_key === 'provenance' && c.dimension.dimension_state === 'strong',
  )

  if (provenanceStrong && strong > core.length / 2 && flags.length === 0) return 'strong_signals'
  return 'mixed_signals'
}
