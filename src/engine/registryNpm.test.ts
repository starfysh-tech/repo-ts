import { describe, it, expect } from 'vitest'
import { createNpmAdapter } from './registryNpm'

const adapter = (resp: { ok: true; data: unknown } | { ok: false; status: number }, capture?: (url: string) => void) =>
  createNpmAdapter(async (url) => {
    capture?.(url)
    return resp
  })

describe('npm adapter — declaredPackage', () => {
  const a = adapter({ ok: true, data: {} })
  it('reads a plain package name', () => {
    expect(a.declaredPackage({ name: 'is-number' })).toEqual({ name: 'is-number' })
  })
  it('private root → no package (monorepo)', () => {
    expect(a.declaredPackage({ name: 'x', private: true })).toEqual({ name: null, reason: 'private' })
  })
  it('workspaces root → no package (monorepo)', () => {
    expect(a.declaredPackage({ name: 'root', workspaces: ['packages/*'] })).toEqual({ name: null, reason: 'workspaces' })
  })
  it('missing/empty/non-object → none', () => {
    expect(a.declaredPackage({})).toEqual({ name: null, reason: 'none' })
    expect(a.declaredPackage({ name: '  ' })).toEqual({ name: null, reason: 'none' })
    expect(a.declaredPackage(null)).toEqual({ name: null, reason: 'none' })
  })
})

describe('npm adapter — lookup', () => {
  it('string repository field → found', async () => {
    const r = await adapter({ ok: true, data: { repository: 'github:o/r' } }).lookup('p')
    expect(r).toEqual({ kind: 'found', repositoryUrl: 'github:o/r' })
  })
  it('object repository field → found with its url', async () => {
    const r = await adapter({ ok: true, data: { repository: { type: 'git', url: 'git+https://github.com/o/r.git' } } }).lookup('p')
    expect(r).toEqual({ kind: 'found', repositoryUrl: 'git+https://github.com/o/r.git' })
  })
  it('published but no repository field → found with null url (unverifiable downstream)', async () => {
    const r = await adapter({ ok: true, data: { name: 'p' } }).lookup('p')
    expect(r).toEqual({ kind: 'found', repositoryUrl: null })
  })
  it('404 → unpublished', async () => {
    expect(await adapter({ ok: false, status: 404 }).lookup('p')).toEqual({ kind: 'unpublished' })
  })
  it('other failure → unverifiable', async () => {
    expect(await adapter({ ok: false, status: 503 }).lookup('p')).toEqual({ kind: 'unverifiable' })
  })
  it('scoped name escapes only the slash in the path', async () => {
    let url = ''
    await adapter({ ok: true, data: {} }, (u) => (url = u)).lookup('@babel/core')
    expect(url).toBe('https://registry.npmjs.org/@babel%2Fcore')
  })
})
