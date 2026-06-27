# PRD — Scoring policy: provenance-gated STRONG + manufactured-credibility guard

Status: ready-for-agent

> Origin: a security-framing critique caught while dogfooding `DietrichGebert/ponytail` — a **newly-created, personal-account, mixed-provenance** repo that nonetheless read **STRONG SIGNALS** because its activity dimensions (transparency, governance) carried a majority while provenance sat at `mixed` and didn't block it. The copy/UI half shipped in PR #15 (ScopeNote, "Security docs", "Not checked here"). This PRD is the deferred **scoring-policy** half.

## Problem Statement

As a non-security person deciding whether to install or proceed with a repo, I can be misled when the extension shows **STRONG SIGNALS** for a repo that has not actually earned trust:

- A **brand-new** repo (created days ago) can reach STRONG purely on activity/maintenance signals, even though no project can have earned solid standing in that time.
- The single most dangerous pattern — a repo that is **newly created yet already highly active** (regular releases, many contributors, active triage) — is *temporally implausible* for an organic project and is a known **manufactured-credibility** supply-chain tell. Today the engine not only fails to flag it, it *rewards* it with strong dimension states.
- Sub-caution caveats that the engine already computes (e.g. "No license detected") are **invisible** to the user — the only flag the UI surfaces is the high-severity `archived`.

## Solution

From the user's perspective:

1. A repo can only read **STRONG SIGNALS** when its **provenance** is itself strong (licensed, established, current, not dormant). A repo with caveated provenance reads at most **MIXED SIGNALS**, regardless of how active it is.
2. When a repo is **newly created yet already shows the full set of maturity signals** (a release cadence, distributed contributors, and active issue/PR triage), the card shows an explicit **caveat** — "Newly created yet already highly active — verify independently" — without crying wolf (it never escalates to Caution).
3. The card and popup gain a small **caveats** area that surfaces every sub-Caution flag — so the manufactured-credibility caveat *and* the previously-silent "No license detected" are now visible.

These are conservative, evidence-based signals: the verdict never claims a repo is "safe" or "dangerous"; it withholds the top verdict where trust isn't earned and names the specific reason for extra scrutiny.

## User Stories

1. As a user, I want a repo created days ago to not read STRONG, so that recency-without-track-record isn't mistaken for earned trust.
2. As a user, I want a repo with no license to not read STRONG, so that a basic provenance gap caps the verdict.
3. As a user, I want a repo whose provenance is only `mixed` (e.g. licensed-but-dormant, or unlicensed-but-established) to read at most MIXED, so that the top verdict means solid provenance.
4. As a user, I want a well-established, licensed, currently-maintained repo to still read STRONG when its other dimensions are strong, so that the gate doesn't punish genuinely trustworthy projects.
5. As a user, I want a newly-created repo that already has a release cadence **and** many contributors **and** active triage to be flagged as "verify independently," so that I'm warned about the manufactured-credibility pattern.
6. As a user, I want that manufactured-credibility caveat to **not** read as "Caution," so that a legitimately viral new project isn't branded dangerous.
7. As a user, I want a new repo that only shows *one* maturity signal (e.g. a single first release) to **not** trip the guard, so that normal early activity isn't over-flagged.
8. As a user, I want the "No license detected" caveat to be visible on the card, so that a flag already affecting the verdict isn't hidden from me.
9. As a user, I want caveats shown on both the in-page card and the popup, so that the surface I happen to use doesn't change what I learn.
10. As a user, I want a small finished utility (e.g. `is-number`) to keep reading conservatively — never Caution — under the new policy, so that "stable and quiet" is never mistaken for "risky."
11. As a maintainer, I want the gate and guard locked by committed fixtures, so that a future change can't silently regress the ponytail behavior.
12. As a maintainer, I want the cache to invalidate when this policy ships, so that users don't see stale pre-policy verdicts for 24h.
13. As a user, I want the manufactured-credibility caveat to explain *why* (newly created + already highly active), so that the warning is actionable rather than cryptic.
14. As a user, I want the watchlist rows to stay summary-level, so that the new caveat detail doesn't clutter the saved-repos list.

## Implementation Decisions

### Provenance gate (`deriveTrustState`, `src/engine/analyzeRepo.ts`)
- Add a necessary condition for `strong_signals`: the `provenance` contribution must be present **and** its `dimension_state === 'strong'`. This is layered on top of the existing logic (majority of evidenced **core** dims strong, no flags) — it tightens, never loosens.
- Because `provenanceState` returns `strong` only for `licensed && established && !veryNew && !dormant`, this inherently blocks every `very-new` repo from STRONG (the ponytail fix), and also caps `mixed`/`weak`/un-evidenced-provenance repos at MIXED.

### Manufactured-credibility guard (new pure function, e.g. `src/engine/manufacturedCredibility.ts`, called from `analyzeRepo`)
- It is **cross-dimensional**, so it lives in/after the `analyzeRepo` rollup, not inside a single scorer. It reads the computed contributions plus repo age.
- **Trigger:** repo is `very-new` (age `< VERY_NEW_DAYS` = 30d) **AND** the `release`, `governance`, and `responsiveness` contributions are **all** `dimension_state === 'strong'`.
- **Output:** a single `flag` with **medium** severity (never `high` — `archived` remains the only Caution trigger), keyed e.g. `manufactured-credibility`, labelled e.g. "Newly created yet already highly active — verify independently."
- Newness source: recompute from `repo.created_at` (the same `daysBetween`/`VERY_NEW_DAYS` provenance uses) rather than string-matching `triggered_signals`.

### Caveat surface (new shared UI)
- A new shared component (e.g. `Caveats`) with co-located styles, rendering **every flag whose `severity !== 'high'`** as a small list. High flags continue to flow through the existing `verdictSummary` headline path (unchanged).
- Rendered on the **card** (`card.tsx`) and **popup** (`popup.tsx`) result states, after the takeaway/ScopeNote region. **Not** rendered on watchlist rows.
- Surfaces both the new `manufactured-credibility` flag and the existing `license-missing` flag (previously invisible).

### Versioning & cache
- Bump `SCORE_VERSION` `0.4.0 → 0.5.0` (`src/engine/config.ts`) — the 24h cache key includes it, so stale pre-policy verdicts invalidate.
- Bump the manifest `version` (user-facing behavior change), per the established convention (distinct from `SCORE_VERSION`).

### Out of the `deriveTrustState` "no flags" interaction
- `deriveTrustState` already requires `flags.length === 0` for STRONG, and the guard only fires on `very-new` repos (already blocked by the gate), so adding the guard flag never demotes an established repo. The new medium flag does not change any non-new repo's tier.

## Testing Decisions

- **What makes a good test:** asserts externally-observable output (the analysis result's `trust_state`, `flags`, dimension states) for a given repo shape — never internal call structure.
- **Primary seam (existing):** `analyzeRepo(deps, target)` with injected fetch against committed per-archetype JSON fixtures in `src/engine/__fixtures__/`. No new seam.
  - **New fixture archetype** — add a `ponytail`-style repo (very-new, licensed, personal-account; release + governance + responsiveness all strong) across the existing fixture folders (`repos`, `community`, `releases`, `contributors`, `issues`, `pulls`). Assert: `trust_state === 'mixed_signals'` (gated, not strong), a `manufactured-credibility` medium flag present, and **never** `caution`.
  - **Re-baseline existing archetypes** — recompute each of the 7 committed archetypes' expected `trust_state` under the gate. Any archetype currently STRONG whose provenance isn't `strong` moves to MIXED; update its expected fixture output accordingly and document why in the test.
  - **is-number guardrail** — keep the hard assertion that `jonschlinkert/is-number` is never `caution`; confirm its expected verdict under the gate (its provenance may read `mixed` from dormancy — it is not STRONG today, so the gate should not surprise it).
- **Unit tests (pure):**
  - The guard function — table of (age, release/governance/responsiveness states) → fires / doesn't. Cover: all-three-strong + new → fires; two-strong + new → no; all-three-strong + not-new → no; flag severity is `medium`.
  - `deriveTrustState` — provenance `strong` + majority core strong → STRONG; provenance `mixed` + otherwise-strong → MIXED (the ponytail unit-level case); provenance `strong` but minority core → MIXED.
- **Prior art:** mirrors the existing `analyzeRepo.test.ts` archetype matrix, `release.test.ts` / `governance.test.ts` / `responsiveness.test.ts` pure-scorer tests, and `cache.test.ts` (assert the new `SCORE_VERSION` in the key). No UI render tests (consistent with the current suite — the caveat component is wired but not snapshot-tested).

## Out of Scope

- **Identity / canonicality verification** (typosquat detection, registry↔repo linkage, ownership-change/takeover signals, release attestation) — needs external data, tracked in `docs/future-enhancements.md`.
- Widening the newness window beyond 30d, or making the guard trigger on a subset (<3) of maturity signals — the conservative all-three trigger is intentional for v1.
- Escalating manufactured-credibility to `caution` — explicitly rejected (preserves the archived-only-caution rule; avoids false-alarming viral repos).
- Surfacing caveats on watchlist rows.
- Any change to the additive-vs-core model or to confidence derivation.

## Further Notes

- **Decision log (from the grilling):** scope = both gate + guard; gate rule = require `provenance === 'strong'`; guard effect = visible sub-caution caveat; guard trigger = very-new + all three maturity signals strong; surface = general non-high-flag caveat list (also surfaces `license-missing`).
- The gate makes the guard's *tier* effect redundant (very-new repos are already capped), so the guard's value is purely the **surfaced explanation** — which the generic ScopeNote cannot give.
- Suggested slicing (see `/to-issues`): (1) provenance gate + `deriveTrustState` tests + fixture re-baseline; (2) manufactured-credibility guard function + new fixture; (3) caveat UI surface (card + popup). Slices 1–2 are engine-only and independently verifiable; slice 3 is additive UI.
