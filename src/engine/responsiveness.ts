import type { SupportedRepo } from '../content/parseRepoContext'
import type { DimensionContribution, GithubIssue, GithubPull } from './types'
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from './config'
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
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): DimensionContribution {
  const recent = (at: string | null) => {
    if (at == null) return false
    const days = daysBetween(now, at)
    return Number.isFinite(days) && days <= config.responsiveRecentDays
  }

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

  const state = recentTotal >= config.responsiveActiveMin ? 'strong' : 'mixed'

  // Point the evidence where the activity actually is — a repo can be responsive
  // mostly through PRs (e.g. commander), so an Issues-only link would mislead.
  const base = `https://github.com/${target.owner}/${target.repo}`
  const evidence_links = []
  if (issueCloses > 0) evidence_links.push({ label: 'Issues', url: `${base}/issues` })
  if (prCloses > 0) evidence_links.push({ label: 'Pull requests', url: `${base}/pulls` })

  return {
    dimension: {
      dimension_key: 'responsiveness',
      dimension_state: state,
      confidence_state: 'high',
      triggered_signals: ['recent-activity', state],
      evidence_links,
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
