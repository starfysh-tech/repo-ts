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

/** Resolve known advisories for a repo via the backend, normalizing the v1 API
 *  contract (or any failure) into an `AdvisoriesResult`. Pure but for the
 *  injected `deps.fetch`; never touches the maintenance verdict.
 *
 *  NOTE: body is intentionally a stub — the engine lane implements it against
 *  advisoriesClient.test.ts. The types above are the frozen contract both the
 *  engine lane and the wiring/UI lane build against. */
export async function fetchAdvisories(
  _deps: AdvisoriesDeps,
  _target: AdvisoriesTarget,
): Promise<AdvisoriesResult> {
  throw new Error('fetchAdvisories not implemented')
}
