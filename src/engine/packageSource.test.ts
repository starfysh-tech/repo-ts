import { describe, it, expect } from 'vitest'
import { checkPackageSource, parseGithubRepo } from './packageSource'
import type { PackageSourceDeps, RegistryAdapter, RegistryLookup } from './packageSource'
import type { GithubRepo } from './types'
import type { SupportedRepo } from '../content/parseRepoContext'

const target = (owner: string, repo: string): SupportedRepo => ({ kind: 'repo', owner, repo })

const repoOf = (full_name: string, fork = false): GithubRepo => ({
  full_name,
  private: false,
  archived: false,
  disabled: false,
  fork,
  license: null,
  owner: { type: 'User', login: full_name.split('/')[0] },
  created_at: '2020-01-01T00:00:00Z',
  pushed_at: '2026-01-01T00:00:00Z',
  homepage: null,
  topics: [],
  description: null,
})

// A stub npm-style adapter: declaredPackage reads name/private/workspaces; lookup
// answers from an injected map. Mirrors the real npm adapter's contract.
const stubAdapter = (lookups: Record<string, RegistryLookup>): RegistryAdapter => ({
  id: 'npm',
  declaredPackage(manifest) {
    if (!manifest || typeof manifest !== 'object') return { name: null, reason: 'none' }
    const m = manifest as Record<string, unknown>
    if (m.private === true) return { name: null, reason: 'private' }
    if (m.workspaces) return { name: null, reason: 'workspaces' }
    return typeof m.name === 'string' && m.name ? { name: m.name } : { name: null, reason: 'none' }
  },
  async lookup(name) {
    return lookups[name] ?? { kind: 'unpublished' }
  },
})

// Build deps with inline stubs. `resolved` maps "owner/repo" (the npm-pointed repo)
// to the GitHub-resolved current full_name (the transfer-redirect step).
const deps = (opts: {
  manifest: unknown
  lookups?: Record<string, RegistryLookup>
  resolved?: Record<string, string | null>
}): PackageSourceDeps => ({
  adapter: stubAdapter(opts.lookups ?? {}),
  async fetchManifest() {
    return opts.manifest
  },
  async resolveRepo(owner, repo) {
    const key = `${owner}/${repo}`
    return key in (opts.resolved ?? {}) ? (opts.resolved![key] ?? null) : `${owner}/${repo}`
  },
})

const hasHighFlag = (c: { flags: { severity: string }[] }) => c.flags.some((f) => f.severity === 'high')

describe('parseGithubRepo', () => {
  it('extracts owner/repo from the common registry URL shapes', () => {
    expect(parseGithubRepo('git+https://github.com/jonschlinkert/is-number.git')).toEqual({ owner: 'jonschlinkert', repo: 'is-number' })
    expect(parseGithubRepo('https://github.com/sindresorhus/got')).toEqual({ owner: 'sindresorhus', repo: 'got' })
    expect(parseGithubRepo('git@github.com:tj/commander.js.git')).toEqual({ owner: 'tj', repo: 'commander.js' })
    expect(parseGithubRepo('github:expressjs/express')).toEqual({ owner: 'expressjs', repo: 'express' })
  })
  it('returns null for non-GitHub or empty URLs', () => {
    expect(parseGithubRepo('https://gitlab.com/o/r')).toBeNull()
    expect(parseGithubRepo(null)).toBeNull()
    expect(parseGithubRepo('')).toBeNull()
  })
})

describe('checkPackageSource', () => {
  it('verified: the package resolves back to this repo → strong, additive, no caution flag', async () => {
    const c = await checkPackageSource(
      deps({
        manifest: { name: 'is-number' },
        lookups: { 'is-number': { kind: 'found', repositoryUrl: 'git+https://github.com/jonschlinkert/is-number.git' } },
      }),
      target('jonschlinkert', 'is-number'),
      repoOf('jonschlinkert/is-number'),
    )
    expect(c.dimension.dimension_state).toBe('strong')
    expect(c.additive).toBe(true)
    expect(c.hasEvidence).toBe(true)
    expect(hasHighFlag(c)).toBe(false) // the load-bearing guardrail: verified never cautions
  })

  it('GUARDRAIL: is-number verifies and never produces a high-severity flag', async () => {
    const c = await checkPackageSource(
      deps({
        manifest: { name: 'is-number' },
        lookups: { 'is-number': { kind: 'found', repositoryUrl: 'https://github.com/jonschlinkert/is-number' } },
      }),
      target('jonschlinkert', 'is-number'),
      repoOf('jonschlinkert/is-number'),
    )
    expect(hasHighFlag(c)).toBe(false)
    expect(c.dimension.dimension_state).toBe('strong')
  })

  it('TRANSFER regression: draft-js npm points to facebook/draft-js but resolves to facebookarchive → verified, no caution', async () => {
    const c = await checkPackageSource(
      deps({
        manifest: { name: 'draft-js' },
        lookups: { 'draft-js': { kind: 'found', repositoryUrl: 'https://github.com/facebook/draft-js' } },
        // GitHub resolves the old path to the transferred home = the viewed repo.
        resolved: { 'facebook/draft-js': 'facebookarchive/draft-js' },
      }),
      target('facebookarchive', 'draft-js'),
      repoOf('facebookarchive/draft-js'),
    )
    expect(c.dimension.dimension_state).toBe('strong')
    expect(hasHighFlag(c)).toBe(false)
  })

  it('confirmed mismatch: non-fork repo whose package resolves elsewhere → weak + HIGH-severity flag', async () => {
    const c = await checkPackageSource(
      deps({
        manifest: { name: 'left-pad' },
        lookups: { 'left-pad': { kind: 'found', repositoryUrl: 'https://github.com/stevemao/left-pad' } },
      }),
      target('evil', 'left-pad'),
      repoOf('evil/left-pad', false),
    )
    expect(c.dimension.dimension_state).toBe('weak')
    expect(hasHighFlag(c)).toBe(true)
    expect(c.flags[0].key).toBe('package-source-mismatch')
  })

  it('fork: the same elsewhere-pointing package on a FORK → mixed neutral note, no flag, no lift', async () => {
    const c = await checkPackageSource(
      deps({
        manifest: { name: 'left-pad' },
        lookups: { 'left-pad': { kind: 'found', repositoryUrl: 'https://github.com/stevemao/left-pad' } },
      }),
      target('someone', 'left-pad'),
      repoOf('someone/left-pad', true),
    )
    expect(c.dimension.dimension_state).toBe('mixed')
    expect(hasHighFlag(c)).toBe(false)
    expect(c.hasEvidence).toBe(false) // neutral — does not lift
  })

  it('no-package: no manifest → unknown, no evidence, no flag', async () => {
    const c = await checkPackageSource(deps({ manifest: null }), target('torvalds', 'linux'), repoOf('torvalds/linux'))
    expect(c.dimension.dimension_state).toBe('unknown')
    expect(c.hasEvidence).toBe(false)
    expect(hasHighFlag(c)).toBe(false)
  })

  it('monorepo: private/workspaces root → no-package with the honest monorepo message', async () => {
    const priv = await checkPackageSource(deps({ manifest: { private: true } }), target('facebook', 'react'), repoOf('facebook/react'))
    expect(priv.dimension.dimension_state).toBe('unknown')
    expect(priv.dimension.rationale_segments[0].text).toContain('monorepo')

    const ws = await checkPackageSource(deps({ manifest: { name: 'root', workspaces: ['packages/*'] } }), target('babel', 'babel'), repoOf('babel/babel'))
    expect(ws.dimension.rationale_segments[0].text).toContain('monorepo')
    expect(hasHighFlag(ws)).toBe(false)
  })

  it('unpublished: declared name not on the registry → unknown, never caution', async () => {
    const c = await checkPackageSource(
      deps({ manifest: { name: 'totally-not-published-xyz' }, lookups: { 'totally-not-published-xyz': { kind: 'unpublished' } } }),
      target('someone', 'thing'),
      repoOf('someone/thing'),
    )
    expect(c.dimension.dimension_state).toBe('unknown')
    expect(hasHighFlag(c)).toBe(false)
  })

  it('unverifiable: published but no usable repository URL, or unreachable resolve → unknown, never caution', async () => {
    const noUrl = await checkPackageSource(
      deps({ manifest: { name: 'norepo' }, lookups: { norepo: { kind: 'found', repositoryUrl: null } } }),
      target('someone', 'norepo'),
      repoOf('someone/norepo'),
    )
    expect(noUrl.dimension.dimension_state).toBe('unknown')
    expect(hasHighFlag(noUrl)).toBe(false)

    const unreachable = await checkPackageSource(
      deps({
        manifest: { name: 'pkg' },
        lookups: { pkg: { kind: 'found', repositoryUrl: 'https://github.com/o/r' } },
        resolved: { 'o/r': null }, // GitHub couldn't resolve → don't risk a false mismatch
      }),
      target('someone', 'pkg'),
      repoOf('someone/pkg'),
    )
    expect(unreachable.dimension.dimension_state).toBe('unknown')
    expect(hasHighFlag(unreachable)).toBe(false)
  })
})
