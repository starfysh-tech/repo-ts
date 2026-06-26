import type { SupportedRepo } from '../content/parseRepoContext'
import type { CommunityFiles, DimensionContribution, DimensionState, PositiveSignal } from './types'

/**
 * Security docs: whether the repo *publishes* a security policy and a code of
 * conduct (both resolved via the community profile, which honors the org-default
 * `.github` fallback). This is a documentation-presence signal — it does NOT
 * assess the code's actual security posture (hence "docs", not "hygiene").
 *
 * Severity posture: a MISSING security policy is low/contextual, not a flag —
 * most public repos lack one, so its absence simply yields no evidence rather
 * than penalizing trust. The only high-severity flag (archived) lives in
 * Provenance, so Security never escalates to caution on its own.
 */
export function scoreSecurity(files: CommunityFiles, target: SupportedRepo): DimensionContribution {
  const positives: PositiveSignal[] = []
  const triggered: string[] = []
  const evidenceLinks = []

  if (files.security) {
    positives.push({ key: 'security-policy', label: 'Security policy' })
    triggered.push('security-policy')
    evidenceLinks.push({ label: 'Security policy', url: `https://github.com/${target.owner}/${target.repo}/security/policy` })
  }
  if (files.code_of_conduct) {
    positives.push({ key: 'code-of-conduct', label: 'Code of conduct' })
    triggered.push('code-of-conduct')
  }

  const hasEvidence = files.security || files.code_of_conduct
  const state: DimensionState = files.security ? 'strong' : files.code_of_conduct ? 'mixed' : 'unknown'

  return {
    dimension: {
      dimension_key: 'security',
      dimension_state: state,
      confidence_state: hasEvidence ? 'high' : 'low',
      triggered_signals: triggered,
      evidence_links: evidenceLinks,
      rationale_summary: files.security
        ? 'Publishes a security policy.'
        : files.code_of_conduct
          ? 'Has a code of conduct; no security policy found.'
          : 'No security policy or code of conduct found.',
    },
    hasEvidence,
    flags: [],
    positives,
  }
}
