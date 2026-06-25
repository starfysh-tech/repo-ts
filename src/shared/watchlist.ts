import type { SupportedRepo } from '../content/parseRepoContext'
import type { AnalysisResult } from '../engine/types'

// The local watchlist: saved analysis SNAPSHOTS (not live queries). Opening the
// watchlist renders these instantly with no network calls; refresh is manual and
// per-row only, to protect the unauthenticated rate-limit budget.
export interface WatchlistEntry {
  owner: string
  repo: string
  result: AnalysisResult
}

const KEY = 'watchlist'

const sameRepo = (entry: WatchlistEntry, owner: string, repo: string) =>
  entry.owner === owner && entry.repo === repo

// ── Pure list operations (unit-tested) ───────────────────────────────────────
/** Add or replace an entry, keeping the list keyed uniquely by owner/repo. */
export function upsertEntry(list: WatchlistEntry[], entry: WatchlistEntry): WatchlistEntry[] {
  return [...list.filter((e) => !sameRepo(e, entry.owner, entry.repo)), entry]
}

export function removeEntry(list: WatchlistEntry[], owner: string, repo: string): WatchlistEntry[] {
  return list.filter((e) => !sameRepo(e, owner, repo))
}

export function hasEntry(list: WatchlistEntry[], owner: string, repo: string): boolean {
  return list.some((e) => sameRepo(e, owner, repo))
}

// ── chrome.storage.local wrappers (thin; usable from any extension context) ──
export async function getWatchlist(): Promise<WatchlistEntry[]> {
  const stored = await chrome.storage.local.get(KEY)
  return (stored[KEY] as WatchlistEntry[] | undefined) ?? []
}

export async function saveToWatchlist(target: SupportedRepo, result: AnalysisResult): Promise<void> {
  const list = await getWatchlist()
  await chrome.storage.local.set({
    [KEY]: upsertEntry(list, { owner: target.owner, repo: target.repo, result }),
  })
}

export async function removeFromWatchlist(owner: string, repo: string): Promise<void> {
  const list = await getWatchlist()
  await chrome.storage.local.set({ [KEY]: removeEntry(list, owner, repo) })
}

export async function isWatched(target: SupportedRepo): Promise<boolean> {
  return hasEntry(await getWatchlist(), target.owner, target.repo)
}
