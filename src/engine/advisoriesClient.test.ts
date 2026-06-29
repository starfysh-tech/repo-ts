import { describe, it, expect } from 'vitest'
import { fetchAdvisories } from './advisoriesClient'
import type { AdvisoriesDeps, AdvisoriesFetch } from './advisoriesClient'

import advisoriesFound from './__fixtures__/advisories/advisories-found.json'
import advisoriesNone from './__fixtures__/advisories/advisories-none.json'
import noDependencyData from './__fixtures__/advisories/no-dependency-data.json'
import unavailableBody from './__fixtures__/advisories/unavailable.json'

const target = { owner: 'someone', repo: 'thing' }

// Stub backend seam: returns a 2xx with the given body. Mirrors the real client's
// AdvisoriesFetch contract (body on 2xx, status code on failure).
const okFetch = (data: unknown): AdvisoriesFetch => async () => ({ ok: true, data })
const downFetch = (status: number): AdvisoriesFetch => async () => ({ ok: false, status })

const deps = (fetch: AdvisoriesFetch): AdvisoriesDeps => ({ fetch })

describe('fetchAdvisories', () => {
  it('1: advisories-found (mixed severities) → ok, scanned + all rows preserved', async () => {
    const r = await fetchAdvisories(deps(okFetch(advisoriesFound)), target)
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.scanned).toBe(142)
    expect(r.asOf).toBe('2026-06-24T00:00:00Z')
    expect(r.advisories).toHaveLength(4)
    expect(r.advisories.map((a) => a.severity)).toEqual(['critical', 'high', 'medium', 'low'])
    expect(r.advisories.map((a) => a.source)).toEqual(['GHSA', 'GHSA', 'OSV', 'GHSA'])
    expect(r.advisories[0]).toMatchObject({
      id: 'GHSA-pfrx-2q88-qq97',
      package: 'minimist',
      version: '1.2.5',
      summary: 'Prototype pollution in minimist',
      url: 'https://osv.dev/vulnerability/GHSA-pfrx-2q88-qq97',
    })
  })

  it('2: none-found (advisories: []) → ok, scanned ≥ 0, empty list', async () => {
    const r = await fetchAdvisories(deps(okFetch(advisoriesNone)), target)
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.scanned).toBe(87)
    expect(r.scanned).toBeGreaterThanOrEqual(0)
    expect(r.advisories).toEqual([])
  })

  it('3: {error: no_dependency_data} → no_dependency_data', async () => {
    const r = await fetchAdvisories(deps(okFetch(noDependencyData)), target)
    expect(r.status).toBe('no_dependency_data')
  })

  it('4: backend down ({ok:false, status:503}) → unavailable', async () => {
    const r = await fetchAdvisories(deps(downFetch(503)), target)
    expect(r.status).toBe('unavailable')
  })

  it('5: {error: unavailable} body → unavailable', async () => {
    const r = await fetchAdvisories(deps(okFetch(unavailableBody)), target)
    expect(r.status).toBe('unavailable')
  })

  it('6a: an advisory missing id is dropped; unknown severity/source coerced to low/OSV', async () => {
    const data = {
      scanned: 5,
      as_of: '2026-06-24T00:00:00Z',
      advisories: [
        { id: '', source: 'GHSA', severity: 'critical', package: 'p', version: '1', summary: 's', url: 'u' },
        { source: 'GHSA', severity: 'high' }, // no id → dropped
        { id: 'OSV-X', source: 'NONSENSE', severity: 'catastrophic', package: 'q', version: '2', summary: 't', url: 'v' },
      ],
    }
    const r = await fetchAdvisories(deps(okFetch(data)), target)
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.advisories).toHaveLength(1)
    expect(r.advisories[0]).toMatchObject({ id: 'OSV-X', source: 'OSV', severity: 'low' })
  })

  it('6b: scanned falls back to survivor count when not a finite number; asOf defaults to empty', async () => {
    const data = {
      scanned: 'lots', // not a number → fall back to advisories.length
      advisories: [{ id: 'OSV-1' }, { id: 'OSV-2' }],
    }
    const r = await fetchAdvisories(deps(okFetch(data)), target)
    expect(r.status).toBe('ok')
    if (r.status !== 'ok') return
    expect(r.scanned).toBe(2)
    expect(r.asOf).toBe('')
    // missing string fields coerce to ''
    expect(r.advisories[0]).toMatchObject({ package: '', version: '', summary: '', url: '' })
  })

  it('6c: garbage data (null) → unavailable', async () => {
    const r = await fetchAdvisories(deps(okFetch(null)), target)
    expect(r.status).toBe('unavailable')
  })

  it('6d: missing advisories array → unavailable', async () => {
    const r = await fetchAdvisories(deps(okFetch({ scanned: 3 })), target)
    expect(r.status).toBe('unavailable')
  })

  it('7: a thrown fetch (network rejection) never propagates → unavailable', async () => {
    const throwing: AdvisoriesFetch = async () => {
      throw new Error('network down')
    }
    const r = await fetchAdvisories(deps(throwing), target)
    expect(r.status).toBe('unavailable')
  })
})
