import { analyzeRepo } from '../engine/analyzeRepo'
import { checkPackageSource } from '../engine/packageSource'
import { createGithubClient } from '../engine/githubClient'
import { createNpmAdapter, type RegistryFetch } from '../engine/registryNpm'
import { hashConfig } from '../engine/config'
import { getSettings, resolveScoringConfig } from '../shared/settings'
import {
  readCache,
  readPackageSourceCache,
  writeCache,
  writePackageSourceCache,
} from './cache'
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

async function handleAnalyze(target: SupportedRepo, refresh: boolean): Promise<AnalysisOutcome> {
  const now = new Date()
  const settings = await getSettings()
  const config = resolveScoringConfig(settings)
  const configHash = hashConfig(config)

  if (!refresh) {
    // Prefer a remembered package-source-augmented verdict, then the base analysis —
    // both protect the API budget by serving with zero calls.
    const merged = await readPackageSourceCache(target, now, configHash)
    if (merged) return { status: 'ok', result: merged }
    const cached = await readCache(target, now, configHash)
    if (cached) return { status: 'ok', result: cached }
  }

  const client = createGithubClient(settings.pat)
  const outcome = await analyzeRepo({ ...client, now, config }, target)
  if (outcome.status === 'ok') await writeCache(target, outcome.result, configHash)
  return outcome
}

// The manual package-source check: resolve the linkage, fold it into the verdict
// (escalating to caution on a confirmed mismatch), and cache the merged result so
// a re-visit shows it without re-running the registry call.
async function handleCheckPackageSource(target: SupportedRepo): Promise<AnalysisOutcome> {
  const now = new Date()
  const settings = await getSettings()
  const config = resolveScoringConfig(settings)
  const configHash = hashConfig(config)
  const client = createGithubClient(settings.pat)

  const repoRes = await client.fetchRepo(target)
  // A repo we can't even fetch isn't a package-source verdict — surface the same
  // non-alarmist states the base analysis would.
  if (!repoRes.ok) {
    if (repoRes.reason === 'not_found') return { status: 'private' }
    if (repoRes.reason === 'rate_limited') return { status: 'rate_limited', resetAt: repoRes.resetAt ?? 0 }
    return { status: 'error' }
  }

  const adapter = createNpmAdapter(npmRegistryFetch)
  const packageSource = await checkPackageSource(
    {
      adapter,
      fetchManifest: (t) => client.fetchPackageJson(t),
      resolveRepo: async (owner, repo) => {
        const r = await client.fetchRepo({ kind: 'repo', owner, repo })
        return r.ok ? r.repo.full_name : null
      },
    },
    target,
    repoRes.repo,
  )

  const outcome = await analyzeRepo({ ...client, now, config }, target, packageSource)
  if (outcome.status === 'ok') await writePackageSourceCache(target, outcome.result, configHash)
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
