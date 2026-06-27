import type { SupportedRepo } from '../content/parseRepoContext'
import type { DimensionContribution, DimensionState, GithubRelease, PositiveSignal } from './types'
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from './config'
import { daysBetween } from './time'

/**
 * Release discipline: does the project cut published releases, and recently?
 * Additive and never alarmist — release emits NO flags (only `archived` drives
 * caution). A repo with no releases is low-confidence/unknown here, not bad: a
 * small finished utility may ship via tags or the registry without GitHub releases.
 */
export function scoreRelease(
  releases: GithubRelease[],
  target: SupportedRepo,
  now: Date,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): DimensionContribution {
  // Stable, published releases only: drafts aren't public, and prereleases aren't
  // the project's release-discipline signal (a repo whose only recent activity is
  // prerelease churn shouldn't read as a disciplined releaser).
  const stable = releases.filter((r) => !r.draft && !r.prerelease)

  if (stable.length === 0) {
    return {
      dimension: {
        dimension_key: 'release',
        dimension_state: 'unknown',
        confidence_state: 'low',
        triggered_signals: [],
        evidence_links: [],
        rationale_summary: 'No published releases found.',
      },
      hasEvidence: false,
      flags: [],
      positives: [],
    }
  }

  // The /releases list is ordered by creation, not publish date, so the head is
  // not necessarily the most-recently-published. Take the smallest age across all
  // stable releases; an unparseable date contributes Infinity (ignored), and if
  // every date is unparseable the result degrades to "not recent" rather than NaN.
  const latestAgeDays = stable.reduce((min, r) => {
    const age = daysBetween(now, r.published_at ?? r.created_at)
    return Number.isFinite(age) && age < min ? age : min
  }, Infinity)
  const recent = latestAgeDays <= config.releaseRecentDays
  const cadence = stable.length >= 2
  const state: DimensionState = recent && cadence ? 'strong' : 'mixed'

  const positives: PositiveSignal[] = [{ key: 'releases', label: 'Published releases' }]

  return {
    dimension: {
      dimension_key: 'release',
      dimension_state: state,
      confidence_state: 'high',
      triggered_signals: ['releases', recent ? 'recent-release' : 'stale-release'],
      evidence_links: [
        { label: 'Releases', url: `https://github.com/${target.owner}/${target.repo}/releases` },
      ],
      rationale_summary:
        recent && cadence
          ? 'Regular published releases; the latest is recent.'
          : recent
            ? 'Has a recent release.'
            : 'Has published releases, but the latest is old.',
    },
    hasEvidence: true,
    flags: [],
    positives,
  }
}
