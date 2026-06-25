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

/** Update an entry's snapshot only if it is still present. Used by the per-row
 *  refresh so a refresh that resolves AFTER the user removed the row does not
 *  resurrect the deleted entry. */
export function updateIfPresent(list: WatchlistEntry[], entry: WatchlistEntry): WatchlistEntry[] {
  return hasEntry(list, entry.owner, entry.repo) ? upsertEntry(list, entry) : list
}

// ── chrome.storage.local wrappers (thin; usable from any extension context) ──
// NOTE: these are non-atomic read-modify-write. For a single user this is fine;
// two simultaneous writes from different surfaces (e.g. popup + content card in
// another tab) could lose one write. Accepted for the Phase-1 PoC; centralizing
// all writes in the background worker would make them serial if it matters later.
export async function getWatchlist(): Promise<WatchlistEntry[]> {
  const stored = await chrome.storage.local.get(KEY)
  const raw = stored[KEY]
  // Untrusted at read time: a corrupted/older-schema value may not be an array,
  // and entries may lack the owner/repo that key and identify a row. Guard once
  // here so every reader (page + isWatched) degrades instead of throwing.
  if (!Array.isArray(raw)) return []
  return (raw as WatchlistEntry[]).filter((e) => e?.owner && e?.repo)
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

/** Refresh a row's snapshot without re-adding it if it was removed meanwhile. */
export async function updateWatchlistSnapshot(target: SupportedRepo, result: AnalysisResult): Promise<void> {
  const list = await getWatchlist()
  await chrome.storage.local.set({
    [KEY]: updateIfPresent(list, { owner: target.owner, repo: target.repo, result }),
  })
}

export async function isWatched(target: SupportedRepo): Promise<boolean> {
  return hasEntry(await getWatchlist(), target.owner, target.repo)
}
