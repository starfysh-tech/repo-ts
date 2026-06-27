import type { DimensionContribution, DimensionKey, Flag, GithubRepo } from './types'
import { DEFAULT_SCORING_CONFIG, GUARD_FLAG_SEVERITY, type ScoringConfig } from './config'
import { daysBetween } from './time'

/**
 * Manufactured-credibility guard: a brand-new repo that *already* shows the full
 * set of maturity signals — a release cadence AND distributed contributors AND
 * active issue/PR triage — is temporally implausible for an organic project and is
 * a known supply-chain manufactured-trust tell. We surface it as a sub-caution
 * caveat (medium severity; `archived` stays the only caution trigger) so the user
 * is told *why* to scrutinize, rather than escalating to a verdict that would
 * false-alarm a legitimately viral launch (which is indistinguishable on these
 * signals).
 *
 * Cross-dimensional, so it lives here (called from analyzeRepo) instead of any one
 * scorer. The provenance gate already keeps a very-new repo below STRONG; this only
 * adds the explanation.
 *
 * Sensitivity and severity are config-driven (`config.manufacturedGuard`). The
 * default (`all-3` / `medium`) is the most conservative trigger and reproduces the
 * original behavior exactly: all three maturity dimensions must be strong, emitting
 * a medium caveat. `any-2-of-3` widens the trigger; `off` disables it. Severity maps
 * through `GUARD_FLAG_SEVERITY` (`caution`→`high` is what overrides the archived-only
 * caution rule).
 */
export function detectManufacturedCredibility(
  contributions: DimensionContribution[],
  repo: GithubRepo,
  now: Date,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): Flag | null {
  const { sensitivity, severity } = config.manufacturedGuard
  if (sensitivity === 'off') return null

  const ageDays = daysBetween(now, repo.created_at)
  if (!Number.isFinite(ageDays) || ageDays >= config.veryNewDays) return null

  const isStrong = (key: DimensionKey) =>
    contributions.some(
      (c) => c.dimension.dimension_key === key && c.dimension.dimension_state === 'strong',
    )
  const strongCount = (['release', 'governance', 'responsiveness'] as const).filter(isStrong).length
  const fires = sensitivity === 'all-3' ? strongCount === 3 : strongCount >= 2
  if (!fires) return null

  return {
    key: 'manufactured-credibility',
    severity: GUARD_FLAG_SEVERITY[severity],
    label: 'Newly created yet already highly active — verify independently',
  }
}
