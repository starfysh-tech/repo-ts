import type { DimensionContribution, DimensionKey, Flag, GithubRepo } from './types'
import { VERY_NEW_DAYS } from './config'
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
 * adds the explanation. All three maturity dimensions are required (the most
 * conservative trigger) — one or two on a new repo is normal early activity.
 */
export function detectManufacturedCredibility(
  contributions: DimensionContribution[],
  repo: GithubRepo,
  now: Date,
): Flag | null {
  if (daysBetween(now, repo.created_at) >= VERY_NEW_DAYS) return null

  const isStrong = (key: DimensionKey) =>
    contributions.some(
      (c) => c.dimension.dimension_key === key && c.dimension.dimension_state === 'strong',
    )
  if (!(isStrong('release') && isStrong('governance') && isStrong('responsiveness'))) return null

  return {
    key: 'manufactured-credibility',
    severity: 'medium',
    label: 'Newly created yet already highly active — verify independently',
  }
}
