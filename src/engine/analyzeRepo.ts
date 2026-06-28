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
import { DEFAULT_SCORING_CONFIG, SCORE_VERSION, type ScoringConfig } from './config'
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
export async function analyzeRepo(
  deps: AnalyzeDeps,
  target: SupportedRepo,
  // The manual "Package source" check, when the user has run it. It's computed
  // outside this path (a separate fetch lifecycle) and folded in here as a 7th,
  // always-additive contribution so the verdict is derived in one place: a strong
  // (verified) result lifts the majority, and a confirmed-mismatch high-severity
  // flag escalates the rollup to `caution` exactly like `archived`.
  packageSource?: DimensionContribution,
): Promise<AnalysisOutcome> {
  const config = deps.config ?? DEFAULT_SCORING_CONFIG

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

  // Each scorer's `additive` self-declaration is overridden by policy: the active
  // config decides which dimensions lift-but-never-demote (excluded from the
  // trust-majority denominator). At the default config this matches the scorers
  // (release + responsiveness), so behavior is unchanged.
  const additiveSet = new Set(config.additiveDimensions)
  const contributions: DimensionContribution[] = [
    scoreProvenance(repoRes.repo, target, deps.now, config),
    scoreSecurity(files, target),
    scoreTransparency(files, repoRes.repo, target),
    scoreRelease(releases, target, deps.now, config),
    scoreGovernance(contributors, target, config),
    scoreResponsiveness(issues, pulls, target, deps.now, config),
  ].map((c) => ({ ...c, additive: additiveSet.has(c.dimension.dimension_key) }))

  // Fold in the manual package-source check (already additive). Appended after the
  // config-driven additive map so it stays additive regardless of config.
  if (packageSource) contributions.push(packageSource)

  const flags: Flag[] = contributions.flatMap((c) => c.flags)
  // Cross-dimension caveat: a very-new repo already showing every maturity signal
  // (release + governance + responsiveness all strong) is a manufactured-trust tell.
  // Sub-caution (medium) by default — surfaced as a caveat, never escalated to
  // `caution` unless the user raises the guard's severity policy.
  const manufactured = detectManufacturedCredibility(contributions, repoRes.repo, deps.now, config)
  if (manufactured) flags.push(manufactured)

  const positives = contributions.flatMap((c) => c.positives)
  const evidenced = contributions.filter((c) => c.hasEvidence)
  const confidence = deriveConfidence(evidenced.length, config.highConfidenceThreshold)
  const trustState = deriveTrustState(evidenced, flags, confidence, config)

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

/** Confidence = breadth of evidence across the four dimensions: ≥threshold
 *  evidenced → high, one fewer → medium, ≤1 → low. A sparse repo reads
 *  low-confidence (limited evidence), not low-trust. */
function deriveConfidence(evidencedCount: number, highThreshold: number): ConfidenceState {
  if (evidencedCount >= highThreshold) return 'high'
  if (evidencedCount >= highThreshold - 1) return 'medium'
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
  config: ScoringConfig,
): TrustState {
  if (flags.some((f) => f.severity === 'high')) return 'caution'
  if (confidence === 'low') return 'insufficient_evidence'

  // Additive dimensions (release) count toward the strong tally but are excluded
  // from the majority denominator, so they lift the verdict but never demote it.
  const core = evidenced.filter((c) => !c.additive)
  const strongCount = (cs: DimensionContribution[]) =>
    cs.filter((c) => c.dimension.dimension_state === 'strong').length
  const strong = strongCount(core) + strongCount(evidenced.filter((c) => c.additive))

  // Provenance gate (rule 3 above), now a policy toggle: when `provenanceGate` is
  // off the requirement is waived and a repo can earn STRONG on a strong activity
  // majority alone — a weakening of the conservative guarantee the user is warned
  // about. A strong provenance always carries evidence, so it is present in
  // `evidenced` whenever it qualifies.
  const provenanceStrong =
    !config.provenanceGate ||
    evidenced.some(
      (c) => c.dimension.dimension_key === 'provenance' && c.dimension.dimension_state === 'strong',
    )

  if (provenanceStrong && strong > core.length / 2 && flags.length === 0) return 'strong_signals'
  return 'mixed_signals'
}
