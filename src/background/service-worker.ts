import { analyzeRepo } from '../engine/analyzeRepo'
import { checkPackageSource } from '../engine/packageSource'
import { createGithubClient } from '../engine/githubClient'
import { createNpmAdapter, type RegistryFetch } from '../engine/registryNpm'
import { hashConfig } from '../engine/config'
import { getSettings, resolveScoringConfig } from '../shared/settings'
import { readCache, writeCache } from './cache'
import type { WorkerRequest } from '../shared/messages'
import type { AnalysisOutcome } from '../engine/types'
import type { SupportedRepo } from '../content/parseRepoContext'

// Background service worker — the single owner of fetch, scoring, and caching.

const REGISTRY_TIMEOUT_MS = 10_000

/** The real npm registry GET (the only network surface for the registry lookup).
 *  Bounded by a timeout so a stall surfaces as `unverifiable`, never an alarm. */
const npmRegistryFetch: RegistryFetch = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REGISTRY_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!res.ok) return { ok: false, status: res.status }
    return { ok: true, data: await res.json() }
  } catch {
    return { ok: false, status: 0 }
  } finally {
    clearTimeout(timeout)
  }
}

/** Per-request setup shared by both handlers: resolve settings/config once so the
 *  cache key (configHash) and the GitHub client can never drift between them. */
async function buildContext() {
  const now = new Date()
  const settings = await getSettings()
  const config = resolveScoringConfig(settings)
  return { now, config, configHash: hashConfig(config), client: createGithubClient(settings.pat) }
}

async function handleAnalyze(target: SupportedRepo, refresh: boolean): Promise<AnalysisOutcome> {
  const { now, config, configHash, client } = await buildContext()

  // Serve the single cached verdict (base, or a remembered package-source-augmented
  // one — both live in the same entry) with zero API calls, unless forced to refresh.
  if (!refresh) {
    const cached = await readCache(target, now, configHash)
    if (cached) return { status: 'ok', result: cached }
  }

  const outcome = await analyzeRepo({ ...client, now, config }, target)
  if (outcome.status === 'ok') await writeCache(target, outcome.result, configHash)
  return outcome
}

// The manual package-source check: resolve the linkage, fold it into the verdict
// (escalating to caution on a confirmed mismatch), and write the merged result
// back into the SAME cache entry so a re-visit is remembered and no surface
// disagrees. A later forced refresh re-derives the base verdict (re-run to re-augment).
async function handleCheckPackageSource(target: SupportedRepo): Promise<AnalysisOutcome> {
  const { now, config, configHash, client } = await buildContext()

  const repoRes = await client.fetchRepo(target)
  // A repo we can't even fetch isn't a package-source verdict — surface the same
  // non-alarmist states the base analysis would.
  if (!repoRes.ok) {
    if (repoRes.reason === 'not_found') return { status: 'private' }
    if (repoRes.reason === 'rate_limited') return { status: 'rate_limited', resetAt: repoRes.resetAt ?? 0 }
    return { status: 'error' }
  }

  const sameRepo = (owner: string, repo: string) =>
    owner.toLowerCase() === target.owner.toLowerCase() && repo.toLowerCase() === target.repo.toLowerCase()

  const adapter = createNpmAdapter(npmRegistryFetch)
  const packageSource = await checkPackageSource(
    {
      adapter,
      fetchManifest: (t) => client.fetchPackageJson(t),
      // The package's repository usually points at the repo we already hold (the
      // verified case) — skip a redundant /repos call; otherwise resolve through
      // GitHub (follows transfer/rename redirects).
      resolveRepo: async (owner, repo) => {
        if (sameRepo(owner, repo)) return repoRes.repo.full_name
        const r = await client.fetchRepo({ kind: 'repo', owner, repo })
        return r.ok ? r.repo.full_name : null
      },
    },
    target,
    repoRes.repo,
  )

  const outcome = await analyzeRepo({ ...client, now, config }, target, packageSource)
  if (outcome.status === 'ok') await writeCache(target, outcome.result, configHash)
  return outcome
}

chrome.runtime.onMessage.addListener(
  (message: WorkerRequest, _sender, sendResponse: (outcome: AnalysisOutcome) => void) => {
    const handler =
      message?.type === 'analyze'
        ? handleAnalyze(message.target, message.refresh ?? false)
        : message?.type === 'check-package-source'
          ? handleCheckPackageSource(message.target)
          : undefined
    if (!handler) return undefined

    handler.then(sendResponse).catch(() => sendResponse({ status: 'error' }))
    return true // keep the message channel open for the async response
  },
)
