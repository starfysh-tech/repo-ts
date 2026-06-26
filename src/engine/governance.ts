import type { SupportedRepo } from '../content/parseRepoContext'
import type { DimensionContribution, DimensionState, GithubContributor, PositiveSignal } from './types'
import { GOV_DISTRIBUTED_MIN, GOV_DOMINANT_SHARE } from './config'

/**
 * Governance: is maintenance distributed across several people, or concentrated
 * in one (bus-factor-1)? A CORE dimension, but never alarmist — governance emits
 * NO flags (only `archived` drives caution). Concentration reads as `weak`, not a
 * risk flag: a small, finished utility maintained by one person isn't dangerous.
 * A 0–1-contributor repo is no governance evidence, not a negative signal.
 */
export function scoreGovernance(
  contributors: GithubContributor[],
  target: SupportedRepo,
): DimensionContribution {
  // Humans only: bot/anonymous accounts aren't maintenance evidence.
  const users = contributors.filter((c) => c.type === 'User')

  if (users.length <= 1) {
    return {
      dimension: {
        dimension_key: 'governance',
        dimension_state: 'unknown',
        confidence_state: 'low',
        triggered_signals: [],
        evidence_links: [],
        rationale_summary: 'Not enough contributor data.',
      },
      hasEvidence: false,
      flags: [],
      positives: [],
    }
  }

  // The /contributors list is ordered by contribution count, so users[0] is the
  // top contributor. topShare measures how concentrated maintenance is.
  const total = users.reduce((s, u) => s + (u.contributions || 0), 0)
  const topShare = total > 0 ? (users[0].contributions || 0) / total : 1
  const distributed = users.length >= GOV_DISTRIBUTED_MIN && topShare < GOV_DOMINANT_SHARE
  const dominated = topShare >= GOV_DOMINANT_SHARE
  const state: DimensionState = distributed ? 'strong' : dominated ? 'weak' : 'mixed'

  const positives: PositiveSignal[] = distributed
    ? [{ key: 'multiple-maintainers', label: 'Multiple active maintainers' }]
    : []

  return {
    dimension: {
      dimension_key: 'governance',
      dimension_state: state,
      confidence_state: 'high',
      triggered_signals: ['contributors', state],
      evidence_links: [
        {
          label: 'Contributors',
          url: `https://github.com/${target.owner}/${target.repo}/graphs/contributors`,
        },
      ],
      rationale_summary: distributed
        ? 'Maintained by multiple contributors.'
        : dominated
          ? 'Maintenance is concentrated in one contributor.'
          : 'A small group of contributors.',
    },
    hasEvidence: true,
    flags: [],
    positives,
  }
}
