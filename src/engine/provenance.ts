import type { SupportedRepo } from '../content/parseRepoContext'
import type { DimensionContribution, Flag, GithubRepo, PositiveSignal } from './types'
import { DORMANT_DAYS, ESTABLISHED_DAYS, VERY_NEW_DAYS } from './config'

const DAY_MS = 24 * 60 * 60 * 1000
const daysBetween = (later: Date, earlier: string) =>
  (later.getTime() - new Date(earlier).getTime()) / DAY_MS

/**
 * Provenance: who published this and how established it is. Owner type, license
 * presence, repository age, dormancy, and the archived flag.
 *
 * Severity posture (anti-false-alarm): `archived` is the only high-severity
 * flag — it alone escalates the top-level state to `caution`. A personal-account
 * owner is a downgrade, not a flag. Dormancy is contextual and NEVER caution, so
 * a quiet-but-finished utility is not punished for being stable.
 */
export function scoreProvenance(
  repo: GithubRepo,
  target: SupportedRepo,
  now: Date,
): DimensionContribution {
  const flags: Flag[] = []
  const positives: PositiveSignal[] = []
  const triggered: string[] = []

  const hasLicense = repo.license != null
  const isOrg = repo.owner.type === 'Organization'
  const ageDays = daysBetween(now, repo.created_at)
  const idleDays = daysBetween(now, repo.pushed_at)
  const veryNew = ageDays < VERY_NEW_DAYS
  const established = ageDays > ESTABLISHED_DAYS
  const dormant = idleDays > DORMANT_DAYS && !repo.archived

  if (repo.archived) {
    flags.push({ key: 'archived', severity: 'high', label: 'Repository is archived' })
    triggered.push('archived')
  }
  if (hasLicense) {
    positives.push({ key: 'license-present', label: `Licensed (${repo.license!.spdx_id ?? repo.license!.key})` })
    triggered.push('license-present')
  } else {
    flags.push({ key: 'license-missing', severity: 'medium', label: 'No license detected' })
    triggered.push('license-missing')
  }
  if (isOrg) {
    positives.push({ key: 'org-owned', label: 'Organization-owned' })
    triggered.push('org-owned')
  } else {
    triggered.push('personal-account')
  }
  if (established) {
    positives.push({ key: 'established', label: 'Established history' })
    triggered.push('established')
  }
  if (veryNew) triggered.push('very-new')
  if (dormant) triggered.push('dormant')

  const evidenceLinks = [
    { label: 'Repository', url: `https://github.com/${target.owner}/${target.repo}` },
    { label: `@${repo.owner.login}`, url: `https://github.com/${repo.owner.login}` },
  ]

  return {
    dimension: {
      dimension_key: 'provenance',
      dimension_state: deriveProvenanceState({ repo, hasLicense, isOrg, veryNew }),
      // Provenance evidence comes from the always-present /repos object, so for a
      // reachable repo this dimension is well-evidenced on its own terms.
      confidence_state: 'high',
      triggered_signals: triggered,
      evidence_links: evidenceLinks,
      rationale_summary: rationale({ hasLicense, isOrg, established, dormant, archived: repo.archived, veryNew }),
    },
    flags,
    positives,
  }
}

function deriveProvenanceState(p: {
  repo: GithubRepo
  hasLicense: boolean
  isOrg: boolean
  veryNew: boolean
}): DimensionContribution['dimension']['dimension_state'] {
  // Archived repos keep their underlying provenance but read as `mixed`; the
  // high-severity flag is what drives the top-level `caution`.
  if (p.repo.archived) return 'mixed'
  if (!p.hasLicense) return 'weak'
  if (p.isOrg && !p.veryNew) return 'strong'
  // Licensed but personal-account-owned (or very new): solid but downgraded.
  return 'mixed'
}

function rationale(p: {
  hasLicense: boolean
  isOrg: boolean
  established: boolean
  dormant: boolean
  archived: boolean
  veryNew: boolean
}): string {
  if (p.archived) return 'Archived by its owner (read-only).'
  const parts: string[] = []
  parts.push(p.hasLicense ? 'Licensed' : 'no license detected')
  parts.push(p.isOrg ? 'organization-owned' : 'personal-account-owned')
  if (p.veryNew) parts.push('newly created')
  else if (p.established) parts.push('with an established history')
  if (p.dormant) parts.push('quiet recently')
  return capitalize(parts.join(', ')) + '.'
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
