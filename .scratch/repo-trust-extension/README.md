# Repo Trust Extension — feature workspace

Phase 1 client-only PoC of an MV3 browser extension that shows explainable trust signals on public GitHub repo pages.

- **PRD:** [`PRD.md`](./PRD.md) — full scope, 40 user stories, implementation/testing decisions.
- **Backlog:** [`../../docs/future-enhancements.md`](../../docs/future-enhancements.md) — everything deferred from this PoC.
- **Issues:** [`issues/`](./issues) — the 7 vertical slices, all `done`.

## Current status (2026-06-25)

**Phase 1 is built and feature-complete — all 7 issues merged to `main`.** Shipped via 7 PRs:

- **#1** issues 01–03 (spike, walking skeleton, Provenance tracer) · **#2** issue 04 (Security + Transparency, 24h caching, recency, rate-limit/limited-evidence states) · **#3** issue 05 (detail drawer) · **#4** issue 06 (watchlist + popup) · **#5** issue 07 (SPA-nav hardening).
- **#6** hotfix: distinct entry basenames so the service worker loads (see the CLAUDE.md build gotcha).
- **#7** dogfood UX pass: per-dimension "why" + plain-language takeaway on card and popup, inline (deduped) evidence links, bolder visuals (trust accent strip, uppercase state, neutral confidence meter), collapsible Trust details, shared components (`Headline`/`ConfidenceMeter`/`DimensionRow`/`TrustDetails`) with co-located styles, and defensive guards on storage-derived renders.

**49 tests** (engine fixtures + pure seams). Note: issue 05's expandable drawer was deliberately evolved into an always-visible **collapsible** disclosure during the dogfood pass.

**Phase 2 dimensions:**
- **Slice 1 — Release discipline** (4th dimension, **additive**, scored from `GET /releases`) shipped in **PR #10**.
- **Slice 2 — Governance** (5th dimension, **core**, scored from `GET /contributors`: distributed maintenance → strong, bus-factor-1 → weak; emits no flags, so a solo utility is never flagged caution).
- **Slice 3 — Responsiveness** (6th dimension, **additive**, scored from recent closed `/issues` + `/pulls` activity; lifts toward strong for actively-triaged repos, never demotes).

The engine now scores **6 of 7** dimensions.

**Post-Phase-2 slices:**
- **Settings + optional PAT** (PR #13) — an `options_page` storing an optional GitHub token (lifts 60/hr → 5,000/hr), attached only via the service-worker fetch path. **Manifest now versioned** (bump on each user-facing slice; distinct from `SCORE_VERSION`).
- **Verdict-summary fix** (PR #14) — the one-line takeaway no longer silently drops `mixed` dimensions.
- **Security framing** — a persistent `ScopeNote` on every verdict ("maintenance signals, not a security review" + confirm-the-official-source), the security dimension renamed **"Security docs"** (it only checks doc presence), and a clearer "Not checked here" gap callout for Supply chain (copy/UI).
- **Scoring policy** ([`PRD-scoring-policy.md`](./PRD-scoring-policy.md)) — the deferred half of the security critique, in 3 slices: **(1)** STRONG now requires `provenance` itself to be strong (a newly-created / dormant / unlicensed-but-established repo can't earn the top verdict on activity alone); **(2)** a **manufactured-credibility guard** flags the very-new-yet-already-fully-active pattern (medium caveat, never caution); **(3)** a **`Caveats`** UI channel surfaces all sub-caution flags (the guard *and* the previously-silent "No license detected"). New `ponytail` fixture locks the gate + guard; `SCORE_VERSION` → `0.6.0`.

Suite is **111 tests** (up from 49).

### What's left / next

1. **Finish in-browser dogfood QA** — card + popup + settings verified by eye; not yet: the new caveat list on a manufactured-pattern repo, watchlist save/refresh/remove, SPA repo→repo nav, rate-limit/error/private/loading states.
2. **Deferred review item** — engine should emit structured rationale segments (explicit link slots) instead of `DimensionRow` string-matching link labels against rationale prose.
3. **Backlog** — 1 deferred dimension (Supply chain), share, cloud enrichment, canonicality/typosquat verification, Chrome Web Store packaging.

## How issues were worked

A **fresh session per issue** with `/implement` (PRD + the single issue). Then per slice: `/code-review` → `/commitcraft pr` → Gemini auto-review → `/pr-comment-review` → merge.

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
