import type { SupportedRepo } from '../content/parseRepoContext'
import type { DimensionContribution, GithubIssue, GithubPull } from './types'
import { RESPONSIVE_ACTIVE_MIN, RESPONSIVE_RECENT_DAYS } from './config'
import { daysBetween } from './time'

/**
 * Responsiveness: are issues and pull requests actually being handled lately?
 * Additive and never alarmist — responsiveness emits NO flags (only `archived`
 * drives caution). A quiet repo with no recent closes is low-confidence/unknown
 * here, not bad: a small finished utility may have nothing to triage by design.
 */
export function scoreResponsiveness(
  issues: GithubIssue[],
  pulls: GithubPull[],
  target: SupportedRepo,
  now: Date,
): DimensionContribution {
  const recent = (at: string | null) => at != null && daysBetween(now, at) <= RESPONSIVE_RECENT_DAYS

  // GitHub's /issues endpoint includes PRs; drop them here and count PRs
  // separately via `pulls` so a PR-heavy repo isn't double-counted.
  const issueCloses = issues.filter((i) => i.pull_request == null && recent(i.closed_at)).length
  const prCloses = pulls.filter((p) => recent(p.closed_at)).length
  const recentTotal = issueCloses + prCloses

  if (recentTotal === 0) {
    return {
      dimension: {
        dimension_key: 'responsiveness',
        dimension_state: 'unknown',
        confidence_state: 'low',
        triggered_signals: [],
        evidence_links: [],
        rationale_summary: 'No recent issue or pull-request activity.',
      },
      hasEvidence: false,
      additive: true,
      flags: [],
      positives: [],
    }
  }

  const state = recentTotal >= RESPONSIVE_ACTIVE_MIN ? 'strong' : 'mixed'

  return {
    dimension: {
      dimension_key: 'responsiveness',
      dimension_state: state,
      confidence_state: 'high',
      triggered_signals: ['recent-activity', state],
      evidence_links: [
        { label: 'Issues', url: `https://github.com/${target.owner}/${target.repo}/issues` },
      ],
      rationale_summary:
        state === 'strong'
          ? 'Issues and pull requests are actively handled.'
          : 'Some recent issue or pull-request activity.',
    },
    hasEvidence: true,
    additive: true,
    flags: [],
    positives: state === 'strong' ? [{ key: 'active-triage', label: 'Actively triaged' }] : [],
  }
}
