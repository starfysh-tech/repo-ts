# Repo Trust Extension — feature workspace

Phase 1 client-only PoC of an MV3 browser extension that shows explainable trust signals on public GitHub repo pages.

- **PRD:** [`PRD.md`](./PRD.md) — full scope, 40 user stories, implementation/testing decisions.
- **Backlog:** [`../../docs/future-enhancements.md`](../../docs/future-enhancements.md) — everything deferred from this PoC.
- **Issues:** [`issues/`](./issues) — independently-grabbable vertical slices, all `ready-for-agent`.

## How to work this

Start a **fresh session per issue** and run `/implement` with the PRD plus the single issue file. Issues are independent vertical slices; clear context between them. Begin with the unblocked issues (01, 02); land **01 first** because the 2-call scoring design depends on its go/no-go.

## Issue order & dependencies

```
01 spike (unauth GitHub API)  ──┐
                                ├─▶ 03 provenance tracer ──▶ 04 engine + caching + states ──▶ 05 drawer ──▶ 06 watchlist + popup
02 walking skeleton ────────────┘                                                              │
                                                                                               └─▶ (06 also needs 04)
03 ──▶ 07 SPA-navigation hardening
```

| # | Issue | Blocked by |
|---|---|---|
| 01 | Spike: verify unauthenticated GitHub API data | — |
| 02 | Walking skeleton: scaffold, page detection, card shows owner/repo | — |
| 03 | First analysis tracer: Provenance + loading/error states | 01, 02 |
| 04 | Complete engine: Security + Transparency, caching/recency, rate-limit & limited-evidence | 03 |
| 05 | Detail drawer: dimensions, rationale, evidence links | 04 |
| 06 | Watchlist and popup | 04, 05 |
| 07 | SPA-navigation hardening | 03 |

## Test seams

- **Primary:** `analyzeRepo` with the GitHub fetch dependency injected — committed per-archetype JSON fixtures assert the full analysis output. `jonschlinkert/is-number` is never `caution` is a hard test.
- **Secondary:** `parseRepoContext` — pure URL → repo context / private / unsupported classification.

## Verified fixture repos

react · got · facebookarchive/draft-js · MaxGoodfella/test-repo · jonschlinkert/is-number · The-Silent-Voyager-coder/hex-to-rgb-converter · tj/commander.js
