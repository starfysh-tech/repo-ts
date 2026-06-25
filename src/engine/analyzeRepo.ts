import type { SupportedRepo } from '../content/parseRepoContext'
import type {
  AnalysisOutcome,
  AnalysisResult,
  AnalyzeDeps,
  ConfidenceState,
  DimensionResult,
  Flag,
  TrustState,
} from './types'
import { PLANNED_DIMENSION_COUNT, SCORE_VERSION } from './config'
import { scoreProvenance } from './provenance'

/**
 * The primary test seam. Fetches the repository through the injected boundary
 * and produces the deterministic analysis. Network failure modes are mapped to
 * distinct non-verdict outcomes (private / rate-limited / error) so the UI never
 * shows a transient hiccup as a trust judgement.
 *
 * Issue 03 evaluates only the Provenance dimension; Security and Transparency
 * join in issue 04, at which point confidence breadth and the strong/mixed
 * rollup light up fully.
 */
export async function analyzeRepo(deps: AnalyzeDeps, target: SupportedRepo): Promise<AnalysisOutcome> {
  const fetched = await deps.fetchRepo(target)

  if (!fetched.ok) {
    switch (fetched.reason) {
      case 'not_found':
        return { status: 'private' }
      case 'rate_limited':
        return { status: 'rate_limited', resetAt: fetched.resetAt ?? 0 }
      case 'transient':
        return { status: 'error' }
    }
  }

  const provenance = scoreProvenance(fetched.repo, target, deps.now)
  const dimensionResults: DimensionResult[] = [provenance.dimension]
  const flags: Flag[] = [...provenance.flags]
  const positives = [...provenance.positives]

  // Compute the evidenced set once; both confidence and the trust rollup agree
  // on which dimensions count.
  const evidenced = dimensionResults.filter((d) => d.dimension_state !== 'unknown')
  const confidence = deriveConfidence(evidenced.length)
  const trustState = deriveTrustState(evidenced, flags, confidence)

  const result: AnalysisResult = {
    trust_state: trustState,
    confidence_state: confidence,
    dimension_results: dimensionResults,
    flags,
    positive_signals: positives,
    score_version: SCORE_VERSION,
    analyzed_at: deps.now.toISOString(),
  }
  return { status: 'ok', result }
}

/** Confidence = how many of the three planned dimensions produced evidence.
 *  Dimensions not yet evaluated contribute none, so an early version reads as
 *  lower confidence — low evidence, not low trust. */
function deriveConfidence(evidencedCount: number): ConfidenceState {
  if (evidencedCount >= PLANNED_DIMENSION_COUNT) return 'high'
  if (evidencedCount === PLANNED_DIMENSION_COUNT - 1) return 'medium'
  return 'low'
}

/** Deterministic top-level rollup (PRD order); `evidenced` is the set of
 *  dimensions that produced evidence (state !== 'unknown'):
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
