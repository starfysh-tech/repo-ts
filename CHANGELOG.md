# Changelog

All notable changes to the Repo Trust extension. Most recent first. The extension
manifest version (`src/manifest.ts`) bumps on each user-facing slice; `SCORE_VERSION`
(`src/engine/config.ts`) bumps only when the analysis shape/logic changes (it
invalidates the analysis cache) and is noted where relevant.

## manifest 0.2.11 — cloud enrichment + a movable card

### Added
- **Known advisories** (manual, opt-in cloud enrichment) — a "Check known advisories"
  action sends only the public `owner/repo` to our backend (a Cloudflare Worker that
  resolves the GitHub dependency-graph SBOM and queries OSV/GHSA) and renders a
  separate, source-linked advisory list. The first data the extension ever sends
  off-device, gated by a one-time consent. The maintenance verdict is untouched —
  advisories are a point-in-time security-*data* axis, not a dimension; **no
  `SCORE_VERSION` bump**. Backend lives in the sibling repo `../repo-trust-backend`.
  (PR #24)
- **Draggable, collapsible card** — the in-page card has a drag handle to reposition
  it and a collapse-to-edge tab; the tab is itself draggable along the right edge.
  Collapsed state, card position, and tab offset persist in `chrome.storage.local`.
  (PR #25)

### Changed
- **Manual checks visibly resolve** — the advisories empty state now names the scanned
  dependency count; package source renders a persistent outcome line (state icon +
  rationale) instead of the button silently vanishing, and is no longer duplicated in
  Trust details. A long advisory list is bound to a severity-sorted scroll region, and
  a relative "pulled" timestamp (just now → Nh → Nd → date after 3 days) sits by
  Re-check. (PR #26)

### Fixed
- Package-source state→display lookup falls back to a neutral icon/accent for an
  unexpected/corrupted `dimension_state`, matching `DimensionRow` (no render crash on a
  stale cached result). (PR #27)

## SCORE_VERSION 0.8.0 — Package source / Supply-chain v1
- Manual, on-demand 7th dimension checking canonical package↔repo linkage (npm, behind
  a registry-agnostic adapter). A confirmed impersonation mismatch → `caution` (a 2nd
  trigger alongside `archived`), made safe by fork-gating and resolving the registry URL
  through GitHub (transfer/rename redirects). (PR #22)

## SCORE_VERSION 0.7.0 — Structured rationale
- The engine emits `rationale_segments` (explicit inline-link slots); `DimensionRow`
  renders them directly, removing the fragile label-matching. (PR #21)

## manifest 0.2.10 — Advanced settings redesign
- Scoring dials grouped into collapsible per-dimension sections; each threshold is a
  slider + number field with live readout, units, a changed-from-default dot, a per-dial
  reset, and a stricter/looser hint; "additive vs core" reframed as a positive
  `can lower / lift only` toggle. (PR #23)

## User-configurable scoring
- The engine reads an injected `ScoringConfig` threaded through every scorer; presets
  (Balanced / Cautious / Minimal) + a validated-override seam; the cache key folds in a
  stable config hash. `is-number` stays never-`caution` under every preset.

## SCORE_VERSION 0.6.0 — Scoring policy (security critique)
- STRONG now requires `provenance` itself to be strong; a manufactured-credibility guard
  flags the very-new-yet-already-fully-active pattern (medium caveat, never caution); a
  `Caveats` UI channel surfaces all sub-caution flags.

## Post-Phase-2 hardening
- Settings page + optional GitHub PAT (lifts 60/hr → 5,000/hr); manifest versioning
  introduced.
- Verdict-summary no longer drops `mixed` dimensions.
- Security framing: persistent `ScopeNote`, "Security docs" rename (doc presence only),
  explicit "Not checked here" Supply-chain callout.

## Phase 2 — dimensions 4–6
- **Release discipline** (additive, `/releases`), **Governance** (core, `/contributors`),
  **Responsiveness** (additive, recent closed `/issues` + `/pulls`). The engine scores 6
  automatic dimensions.

## Phase 1 — client-only PoC
- MV3 scaffold, repo-page detection, the analysis engine (Provenance, Security docs,
  Transparency) with 24h caching, recency, and rate-limit/limited-evidence states; the
  shadow-DOM card with collapsible Trust details; watchlist + popup; SPA-navigation
  hardening. Pure scoring engine tested through an injected-fetch seam against committed
  per-archetype fixtures.
