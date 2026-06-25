# 06 — Watchlist and popup

Status: ready-for-agent

## What to build

The local watchlist and the toolbar popup, completing the "save and revisit" workflow with no backend.

**Watchlist:** the user can save a repository from the card or the popup; saving stores the current analysis snapshot. The watchlist page renders saved repositories instantly from those snapshots — performing **no network calls on open** — showing each repo's last-known trust state and its recency. Refresh is **manual and per-row only** (re-analyzes that single repo); there is no bulk or background auto-refresh, to protect the rate-limit budget. The user can remove a repository, and an empty watchlist shows an encouraging empty state.

**Popup:** clicking the toolbar icon shows the current page's trust state and quick actions when on a supported repo, a clear "no supported repository detected" state on unsupported pages, and a shortcut into the watchlist. Saving is reflected obviously and reversibly. No account is required and no telemetry is sent.

## Acceptance criteria

- [ ] A repo can be saved to the watchlist from both the card and the popup, and removed.
- [ ] Opening the watchlist renders saved snapshots instantly with no network calls, showing trust state and recency per repo.
- [ ] Each watchlist row has a manual refresh that re-analyzes only that repo; there is no bulk or auto refresh.
- [ ] The empty watchlist shows a clear empty state.
- [ ] The popup shows current-page trust state on a supported repo and a clear unsupported state elsewhere, plus a watchlist shortcut.
- [ ] Save state is obvious and reversible; no account is required and no telemetry is emitted.

## Blocked by

- 04 (caching/recency and analysis)
- 05 (drawer/card save entry points)
