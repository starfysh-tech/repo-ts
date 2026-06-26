import type { SupportedRepo } from '../content/parseRepoContext'
import type { DimensionContribution, DimensionState, GithubRelease, PositiveSignal } from './types'
import { RELEASE_RECENT_DAYS } from './config'

const DAY_MS = 24 * 60 * 60 * 1000

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
): DimensionContribution {
  // Unauth API never returns drafts, but guard anyway.
  const published = releases.filter((r) => !r.draft)

  if (published.length === 0) {
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

  const latest = published[0] // GitHub returns newest first.
  const latestAt = latest.published_at ?? latest.created_at
  const recencyDays = (now.getTime() - new Date(latestAt).getTime()) / DAY_MS
  const recent = recencyDays <= RELEASE_RECENT_DAYS
  const cadence = published.length >= 2
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
        state === 'strong'
          ? 'Regular published releases; the latest is recent.'
          : !recent
            ? 'Has published releases, but the latest is old.'
            : 'Has a recent release.',
    },
    hasEvidence: true,
    flags: [],
    positives,
  }
}
