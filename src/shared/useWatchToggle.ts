import { useEffect, useState } from 'preact/hooks'
import type { SupportedRepo } from '../content/parseRepoContext'
import type { AnalysisResult } from '../engine/types'
import { isWatched, removeFromWatchlist, saveToWatchlist } from './watchlist'

// Saved-state toggle shared by the card and popup Save controls. Reflects the
// stored state, and guards against rapid double-clicks (storage writes are
// non-atomic, so one toggle must finish before the next starts).
export function useWatchToggle(target: SupportedRepo, result: AnalysisResult) {
  const [watched, setWatched] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let live = true
    isWatched(target)
      .then((w) => live && setWatched(w))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [target])

  const toggle = async () => {
    if (pending) return
    setPending(true)
    try {
      if (watched) {
        await removeFromWatchlist(target.owner, target.repo)
        setWatched(false)
      } else {
        await saveToWatchlist(target, result)
        setWatched(true)
      }
    } finally {
      setPending(false)
    }
  }

  return { watched, pending, toggle }
}
