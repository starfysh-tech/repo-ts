import type { SupportedRepo } from '../content/parseRepoContext'
import type { DimensionContribution, EvidenceLink, Flag, GithubRepo, RationaleSegment } from './types'

// ── Registry-agnostic seam ───────────────────────────────────────────────────
// v1 wires only the npm adapter, but the linkage logic below is adapter-driven so
// PyPI/crates/gems slot in later without reworking `checkPackageSource`.

export type RegistryLookup =
  | { kind: 'found'; repositoryUrl: string | null }
  | { kind: 'unpublished' }
  | { kind: 'unverifiable' }

/** The package a repo's root manifest declares, or why none was found. */
export type DeclaredPackage =
  | { name: string }
  | { name: null; reason: 'none' | 'private' | 'workspaces' }

export interface RegistryAdapter {
  readonly id: string
  /** Read the declared package name from a parsed root manifest (npm: package.json). */
  declaredPackage(manifest: unknown): DeclaredPackage
  /** Look the name up on the registry and return its declared repository URL. */
  lookup(name: string): Promise<RegistryLookup>
}

export interface PackageSourceDeps {
  adapter: RegistryAdapter
  /** Parsed root manifest for the repo, or null when absent/unreadable. */
  fetchManifest: (target: SupportedRepo) => Promise<unknown | null>
  /** Resolve owner/repo through GitHub (following transfer/rename redirects) to the
   *  current `full_name`, or null on failure. This is what makes a confirmed
   *  mismatch safe: a transferred repo resolves to its new home, not a stranger. */
  resolveRepo: (owner: string, repo: string) => Promise<string | null>
}

export type PackageSourceOutcome =
  | 'verified'
  | 'mismatch'
  | 'fork'
  | 'no_package'
  | 'unpublished'
  | 'unverifiable'

/** Extract `owner/repo` from a registry `repository` URL in any of the common
 *  shapes (`git+https://…/o/r.git`, `git@github.com:o/r.git`, `github:o/r`, a
 *  bare `https://github.com/o/r`), or null when it isn't a GitHub URL. */
export function parseGithubRepo(url: string | null | undefined): { owner: string; repo: string } | null {
  if (!url) return null
  let u = url.trim()
  u = u.replace(/^git\+/, '')
  u = u.replace(/^(git:|ssh:|https?:)\/\//, '')
  u = u.replace(/^git@github\.com:/, 'github.com/')
  u = u.replace(/^github:/, 'github.com/')
  const m = u.match(/github\.com[/:]([^/]+)\/([^/#?]+)/)
  if (!m) return null
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
}

/**
 * Canonical package↔repo linkage (v1, the manual "Package source" check). Reads
 * the repo's declared package, looks it up on the registry, resolves the
 * registry's repository through GitHub (transfer-safe), and maps the comparison
 * to a `DimensionContribution`:
 *
 *  - verified (resolves back here)      → strong, additive lift, no flag
 *  - confirmed mismatch (non-fork, →    → weak + a HIGH-severity flag (drives
 *    a different live repo)               caution, like `archived`)
 *  - fork (→ upstream)                  → mixed neutral note, no flag, no lift
 *  - no-package / unpublished /         → unknown, no evidence, never caution
 *    unverifiable / unreachable
 *
 * The contribution is always `additive`, so it can only ever LIFT the majority;
 * the only way it lowers a verdict is the explicit high-severity mismatch flag.
 */
export async function checkPackageSource(
  deps: PackageSourceDeps,
  target: SupportedRepo,
  repo: GithubRepo,
): Promise<DimensionContribution> {
  const manifest = await deps.fetchManifest(target)
  const declared: DeclaredPackage =
    manifest == null ? { name: null, reason: 'none' } : deps.adapter.declaredPackage(manifest)
  if (declared.name == null) return noPackage(declared.reason)

  const name = declared.name
  const lookup = await deps.adapter.lookup(name)
  if (lookup.kind === 'unpublished') return unknownOutcome('unpublished', name)
  if (lookup.kind === 'unverifiable') return unknownOutcome('unverifiable', name)

  const parsed = parseGithubRepo(lookup.repositoryUrl)
  if (!parsed) return unknownOutcome('unverifiable', name)

  const resolved = await deps.resolveRepo(parsed.owner, parsed.repo)
  if (!resolved) return unknownOutcome('unverifiable', name)

  if (resolved.toLowerCase() === repo.full_name.toLowerCase()) return verified(name)
  if (repo.fork) return fork(name, resolved)
  return mismatch(name, resolved)
}

// ── Outcome → contribution builders ──────────────────────────────────────────
const npmUrl = (name: string) => `https://www.npmjs.com/package/${name}`
const repoUrl = (fullName: string) => `https://github.com/${fullName}`

function contribution(
  state: DimensionContribution['dimension']['dimension_state'],
  confidence: DimensionContribution['dimension']['confidence_state'],
  outcome: PackageSourceOutcome,
  segments: RationaleSegment[],
  opts: { hasEvidence: boolean; links?: EvidenceLink[]; flag?: Flag; positiveLabel?: string },
): DimensionContribution {
  return {
    dimension: {
      dimension_key: 'package_source',
      dimension_state: state,
      confidence_state: confidence,
      triggered_signals: ['package-source', outcome],
      evidence_links: opts.links ?? [],
      rationale_segments: segments,
    },
    // Always additive — it lifts the majority but never dilutes it; a mismatch
    // lowers the verdict only through its explicit high-severity flag.
    additive: true,
    hasEvidence: opts.hasEvidence,
    flags: opts.flag ? [opts.flag] : [],
    positives: opts.positiveLabel ? [{ key: `package-source-${outcome}`, label: opts.positiveLabel }] : [],
  }
}

function verified(name: string): DimensionContribution {
  return contribution(
    'strong',
    'high',
    'verified',
    [
      { text: 'Confirmed source — this repo is the published source of ' },
      { text: name, href: npmUrl(name) },
      { text: '.' },
    ],
    { hasEvidence: true, links: [{ label: `npm: ${name}`, url: npmUrl(name) }], positiveLabel: 'Confirmed package source' },
  )
}

function mismatch(name: string, other: string): DimensionContribution {
  return contribution(
    'weak',
    'high',
    'mismatch',
    [
      { text: 'The published ' },
      { text: name, href: npmUrl(name) },
      { text: ` package resolves to a different repository (${other}) — this repo may be impersonating it.` },
    ],
    {
      hasEvidence: true,
      links: [
        { label: `npm: ${name}`, url: npmUrl(name) },
        { label: other, url: repoUrl(other) },
      ],
      // The second caution trigger alongside `archived`: a high-severity flag the
      // top-level rollup escalates to `caution`.
      flag: { key: 'package-source-mismatch', severity: 'high', label: `Package source mismatch: ${name} → ${other}` },
    },
  )
}

function fork(name: string, upstream: string): DimensionContribution {
  // A fork legitimately declares its upstream's package; neutral, never caution,
  // and not evidence (no lift) — just an honest "the canonical source is elsewhere".
  return contribution(
    'mixed',
    'high',
    'fork',
    [
      { text: 'Fork — the canonical ' },
      { text: name, href: npmUrl(name) },
      { text: ` package is published from ${upstream}.` },
    ],
    {
      hasEvidence: false,
      links: [
        { label: `npm: ${name}`, url: npmUrl(name) },
        { label: upstream, url: repoUrl(upstream) },
      ],
    },
  )
}

function noPackage(reason: 'none' | 'private' | 'workspaces'): DimensionContribution {
  const segments: RationaleSegment[] =
    reason === 'none'
      ? [{ text: 'No published package detected for this repository.' }]
      : [{ text: 'No published package at the repository root (this looks like a monorepo) — per-package linkage is not checked here yet.' }]
  return contribution('unknown', 'low', 'no_package', segments, { hasEvidence: false })
}

function unknownOutcome(outcome: 'unpublished' | 'unverifiable', name: string): DimensionContribution {
  const segments: RationaleSegment[] =
    outcome === 'unpublished'
      ? [{ text: `This repository declares “${name}”, which isn’t published on the registry.` }]
      : [{ text: `Couldn’t verify the package source for “${name}”.` }]
  return contribution('unknown', 'low', outcome, segments, { hasEvidence: false })
}
