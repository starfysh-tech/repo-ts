import type { DeclaredPackage, RegistryAdapter, RegistryLookup } from './packageSource'

const REGISTRY = 'https://registry.npmjs.org'

/** Result of the injected registry GET — `status` lets the adapter distinguish a
 *  404 (unpublished) from any other failure (unverifiable). */
export type RegistryFetch = (url: string) => Promise<{ ok: true; data: unknown } | { ok: false; status: number }>

/**
 * The npm RegistryAdapter — the only concrete adapter wired in v1. The registry
 * GET is injected (`fetchJson`) so the lookup is testable offline and the network
 * surface stays in one place. A scoped name (`@scope/pkg`) is path-encoded by
 * escaping only the slash (the registry expects `@scope%2Fpkg`, not `%40...`).
 */
export function createNpmAdapter(fetchJson: RegistryFetch): RegistryAdapter {
  return {
    id: 'npm',
    declaredPackage(manifest): DeclaredPackage {
      if (!manifest || typeof manifest !== 'object') return { name: null, reason: 'none' }
      const m = manifest as Record<string, unknown>
      // A private root or a workspaces monorepo doesn't publish a single root
      // package — honest "no package at the root", not a negative signal.
      if (m.private === true) return { name: null, reason: 'private' }
      if (m.workspaces != null) return { name: null, reason: 'workspaces' }
      return typeof m.name === 'string' && m.name.trim() ? { name: m.name } : { name: null, reason: 'none' }
    },
    async lookup(name): Promise<RegistryLookup> {
      const res = await fetchJson(`${REGISTRY}/${name.replace(/\//g, '%2F')}`)
      if (!res.ok) return res.status === 404 ? { kind: 'unpublished' } : { kind: 'unverifiable' }
      const data = res.data as Record<string, unknown> | null
      const repo = data?.repository
      if (typeof repo === 'string') return { kind: 'found', repositoryUrl: repo }
      if (repo && typeof repo === 'object') {
        const url = (repo as Record<string, unknown>).url
        return { kind: 'found', repositoryUrl: typeof url === 'string' ? url : null }
      }
      // Published but no usable repository field → can't verify either way.
      return { kind: 'found', repositoryUrl: null }
    },
  }
}
