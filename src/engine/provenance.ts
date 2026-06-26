import type { SupportedRepo } from '../content/parseRepoContext'
import type { DimensionContribution, DimensionState, Flag, GithubRepo, PositiveSignal } from './types'
import { DORMANT_DAYS, ESTABLISHED_DAYS, VERY_NEW_DAYS } from './config'
import { daysBetween } from './time'

/**
 * Provenance: who published this and how established it is. License presence,
 * owner type, repository age, dormancy, and the archived flag.
 *
 * Severity posture (anti-false-alarm): `archived` is the only high-severity flag
 * — it alone escalates the top-level state to `caution`. A personal-account owner
 * is a missing positive (not a flag, not a state cap — a disciplined solo repo can
 * still be strong). Dormancy is contextual and NEVER caution, so a quiet-but-
 * finished utility is not punished for being stable.
 */
export function scoreProvenance(
  repo: GithubRepo,
  target: SupportedRepo,
  now: Date,
): DimensionContribution {
  const flags: Flag[] = []
  const positives: PositiveSignal[] = []
  const keyless: string[] = []

  const license = repo.license
  const hasLicense = license != null
  const isOrg = repo.owner.type === 'Organization'
  const ageDays = daysBetween(now, repo.created_at)
  const idleDays = daysBetween(now, repo.pushed_at)
  const veryNew = ageDays < VERY_NEW_DAYS
  const established = ageDays > ESTABLISHED_DAYS
  const dormant = idleDays > DORMANT_DAYS && !repo.archived

  if (repo.archived) {
    flags.push({ key: 'archived', severity: 'high', label: 'Repository is archived' })
  }
  if (license != null) {
    positives.push({ key: 'license-present', label: `Licensed (${license.spdx_id ?? license.key})` })
  } else {
    flags.push({ key: 'license-missing', severity: 'medium', label: 'No license detected' })
  }
  if (isOrg) {
    positives.push({ key: 'org-owned', label: 'Organization-owned' })
  } else {
    keyless.push('personal-account')
  }
  if (established) {
    positives.push({ key: 'established', label: 'Established history' })
  }
  if (veryNew) keyless.push('very-new')
  if (dormant) keyless.push('dormant')

  const triggered = [...flags.map((f) => f.key), ...positives.map((p) => p.key), ...keyless]

  return {
    dimension: {
      dimension_key: 'provenance',
      dimension_state: provenanceState({ archived: repo.archived, hasLicense, established, veryNew, dormant }),
      confidence_state: hasLicense || isOrg || established ? 'high' : 'low',
      triggered_signals: triggered,
      evidence_links: [
        { label: 'Repository', url: `https://github.com/${target.owner}/${target.repo}` },
        { label: `@${repo.owner.login}`, url: `https://github.com/${repo.owner.login}` },
      ],
      rationale_summary: rationale({ hasLicense, isOrg, established, dormant, archived: repo.archived, veryNew }),
    },
    // Affirmative provenance facts: a license, an org owner, or an established
    // history. A brand-new unlicensed personal repo offers none → low confidence.
    hasEvidence: hasLicense || isOrg || established,
    flags,
    positives,
  }
}

function provenanceState(p: {
  archived: boolean
  hasLicense: boolean
  established: boolean
  veryNew: boolean
  dormant: boolean
}): DimensionState {
  // Archived keeps its underlying provenance but reads `mixed`; the high-severity
  // flag is what drives the top-level `caution`.
  if (p.archived) return 'mixed'
  if (!p.hasLicense && (p.veryNew || !p.established)) return 'weak'
  if (p.hasLicense && p.established && !p.veryNew && !p.dormant) return 'strong'
  // Licensed but dormant, young, or unlicensed-yet-established: solid but caveated.
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
