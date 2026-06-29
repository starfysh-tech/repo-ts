// The injected-fetch seam for the manual "Known advisories" check. Mirrors the
// engine's other client seams (githubClient / registryNpm): all network egress
// lives behind an injected `fetch`, so normalization is testable offline against
// committed fixtures.
//
// This is the FIRST signal that ever leaves the device, and it talks to OUR
// backend (not GitHub), so it lives in its own file and is NEVER folded into
// analyzeRepo. The maintenance verdict stays pure and client-side: advisories are
// a separate, point-in-time security-DATA axis, not a dimension and not a flag.

export type AdvisorySeverity = 'critical' | 'high' | 'medium' | 'low'

export interface Advisory {
  id: string
  source: 'GHSA' | 'OSV'
  severity: AdvisorySeverity
  package: string
  version: string
  summary: string
  url: string
}

/** The normalized result the panel renders — a discriminated union so the UI can
 *  switch on `status` without guessing. `unavailable` is the catch-all "couldn't
 *  check": a transient backend/network failure must read as a non-event, never an
 *  alarm or a verdict (PRD user story 7). */
export type AdvisoriesResult =
  | { status: 'ok'; scanned: number; advisories: Advisory[]; asOf: string }
  | { status: 'no_dependency_data' }
  | { status: 'unavailable' }

/** Injected backend call (owner/repo in, raw decoded JSON out). Mirrors
 *  `RegistryFetch`: returns the body on a 2xx, or a status code on any failure —
 *  the normalizer turns both into an `AdvisoriesResult` and never throws here. */
export type AdvisoriesFetch = (
  owner: string,
  repo: string,
) => Promise<{ ok: true; data: unknown } | { ok: false; status: number }>

export interface AdvisoriesDeps {
  fetch: AdvisoriesFetch
}

export interface AdvisoriesTarget {
  owner: string
  repo: string
}

const SEVERITIES: readonly AdvisorySeverity[] = ['critical', 'high', 'medium', 'low']

const asString = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Coerce one untrusted backend row into a typed `Advisory`, or `null` to drop
 *  it. The only hard requirement is a non-empty `id`; everything else falls back
 *  to a safe default so a single malformed field never sinks the row. */
function normalizeAdvisory(raw: unknown): Advisory | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id === '') return null
  return {
    id: r.id,
    source: r.source === 'GHSA' ? 'GHSA' : 'OSV',
    severity: SEVERITIES.includes(r.severity as AdvisorySeverity) ? (r.severity as AdvisorySeverity) : 'low',
    package: asString(r.package),
    version: asString(r.version),
    summary: asString(r.summary),
    url: asString(r.url),
  }
}

/** Resolve known advisories for a repo via the backend, normalizing the v1 API
 *  contract (or any failure) into an `AdvisoriesResult`. Pure but for the
 *  injected `deps.fetch`; never touches the maintenance verdict.
 *
 *  Never throws: any non-2xx, network error, or unrecognized body shape collapses
 *  to `{status:'unavailable'}` — the "couldn't check" non-event (PRD user story 7). */
export async function fetchAdvisories(deps: AdvisoriesDeps, target: AdvisoriesTarget): Promise<AdvisoriesResult> {
  let res: Awaited<ReturnType<AdvisoriesFetch>>
  try {
    res = await deps.fetch(target.owner, target.repo)
  } catch {
    return { status: 'unavailable' }
  }

  if (!res.ok) return { status: 'unavailable' }

  const data = res.data
  if (!data || typeof data !== 'object') return { status: 'unavailable' }
  const body = data as Record<string, unknown>

  if (body.error === 'no_dependency_data') return { status: 'no_dependency_data' }

  if (!Array.isArray(body.advisories)) return { status: 'unavailable' }

  const advisories = body.advisories
    .map(normalizeAdvisory)
    .filter((a): a is Advisory => a !== null)

  const scanned = typeof body.scanned === 'number' && Number.isFinite(body.scanned) ? body.scanned : advisories.length
  const asOf = typeof body.as_of === 'string' && body.as_of !== '' ? body.as_of : ''

  return { status: 'ok', scanned, advisories, asOf }
}
