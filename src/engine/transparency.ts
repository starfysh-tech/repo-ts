import type { SupportedRepo } from '../content/parseRepoContext'
import type {
  CommunityFiles,
  DimensionContribution,
  DimensionState,
  GithubRepo,
  PositiveSignal,
} from './types'

/**
 * Transparency: how well the project documents itself — README, a contributing
 * guide, and a description. A README or contributing guide counts as real
 * evidence; a bare description alone is too thin to judge the project by.
 */
export function scoreTransparency(
  files: CommunityFiles,
  repo: GithubRepo,
  target: SupportedRepo,
): DimensionContribution {
  const positives: PositiveSignal[] = []
  const triggered: string[] = []
  const evidenceLinks = []

  const hasReadme = files.readme
  const hasContributing = files.contributing
  const hasDescription = (repo.description ?? '').trim().length > 0

  if (hasReadme) {
    positives.push({ key: 'readme', label: 'README' })
    triggered.push('readme')
    evidenceLinks.push({ label: 'README', url: `https://github.com/${target.owner}/${target.repo}#readme` })
  }
  if (hasContributing) {
    positives.push({ key: 'contributing', label: 'Contributing guide' })
    triggered.push('contributing')
  }
  if (hasDescription) {
    positives.push({ key: 'description', label: 'Has a description' })
    triggered.push('description')
  }

  const hasEvidence = hasReadme || hasContributing
  const state: DimensionState =
    hasReadme && (hasContributing || hasDescription)
      ? 'strong'
      : hasReadme || hasContributing
        ? 'mixed'
        : 'unknown'

  return {
    dimension: {
      dimension_key: 'transparency',
      dimension_state: state,
      confidence_state: hasEvidence ? 'high' : 'low',
      triggered_signals: triggered,
      evidence_links: evidenceLinks,
      rationale_summary: hasReadme
        ? hasContributing
          ? 'Documented with a README and contributing guide.'
          : 'Has a README.'
        : 'Little public documentation found.',
    },
    hasEvidence,
    flags: [],
    positives,
  }
}
