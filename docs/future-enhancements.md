# Future Enhancements — Repo Trust Extension

Scope deliberately cut from the Phase 1 client-only PoC during the design grilling. Each item was a conscious deferral, not an oversight. Captured here so the cuts are recoverable. See `.scratch/repo-trust-extension/PRD.md` for the in-scope build.

## Deferred trust dimensions
The PoC scores 3 of 7 dimensions. These are shown in the drawer as "not evaluated in this version":
- **Release discipline** — release cadence, changelog quality, signed/attested releases. Needs the `/releases` call (extra rate-limit cost).
- **Governance** — maintainer concentration, CODEOWNERS, governance docs. Needs `/contributors` (extra call) and careful thresholds per ecosystem.
- **Supply-chain** — package-registry linkage, package/repo mismatch, dependency churn, external advisories. Requires enrichment / external feeds.
- **Responsiveness** — issue triage latency, PR review patterns, stale-backlog ratios. Requires many calls and time-series analysis.

## Deferred UI surfaces & features
- **Settings page** — scoring profile selector (Balanced/Cautious/Minimal) and theme control. PoC hardcodes "Balanced" and follows system theme.
- **Share summary** — plain-language exportable summary for notes/chat (FR-8 "should"). PoC omits it.

## Deferred platform & infrastructure
- **Cloud enrichment** and the enrichment/rules/ingestion backend services.
- **Historical snapshots** (`/history`) and trend/delta analysis.
- **Advisory & package-registry correlation.**
- **Chrome Web Store packaging** — listing assets, screenshots, privacy-policy URL, permissions-justification review. PoC is load-unpacked only.
- **Optional Personal Access Token field** — would lift the unauthenticated 60/hr limit to 5,000/hr, at the cost of storing a user secret (pulls in secret-handling security requirements).

## Deferred accounts & collaboration
- User accounts, watchlist sync across devices, team collaboration, shared watchlists.
- Notifications on material trust-posture change.

## Deferred analytics
- **Telemetry / event taxonomy** — the wireframe spec's 8 events (`trust_card_rendered`, `detail_drawer_opened`, `evidence_link_clicked`, `repo_saved_to_watchlist`, `share_summary_clicked`, `settings_updated`, `enrichment_toggled`, `feedback_submitted`). No backend exists to receive them in the PoC.
- User feedback capture (false positive / false negative / confusing rationale).

## Deferred scoring sophistication
- **Simplicity-aware negative downgrade** — detecting "this is a small, finished repo" (size, file count, age) to contextually suppress missing-item negatives. The PoC instead relies on the confidence model to absorb low evidence, with `caution` reserved for archived. This is the more accurate-but-riskier version of the `is-number` guardrail.
- Numeric score exposure (PoC shows qualitative states only).
- Per-ecosystem single-maintainer-concentration thresholds.
- **Manufactured-credibility guard** (from the security critique) — flag the temporally implausible "newly created **and** already highly active" pattern (recent creation date alongside an established release cadence, many contributors, and active triage), a known supply-chain manufactured-trust tell. The engine currently *rewards* this with strong dimension states. Would surface as a contextual note, never `caution`. Scoring-policy change → fixture re-baseline + `is-number` guardrail recheck + `SCORE_VERSION` bump.
- **Provenance-gated verdict** (from the security critique) — require provenance to be non-weak/non-mixed before a repo can reach `strong_signals`, so a newly-created / personal-account / mixed-provenance repo can't earn the top verdict on activity (and additive) signals alone. Today `deriveTrustState` takes a strong majority of evidenced core dims, so a mixed provenance can still land STRONG. Needs a PRD decision on the exact gate + fixture re-baseline + guardrail recheck + `SCORE_VERSION` bump.

## Deferred identity & canonicality
- **Canonical-source / typosquat verification** — link the repo to the package a user is about to install (registry ↔ repo linkage, confusable-name warnings, "is this the official upstream"). The PoC ships only a passive "confirm the official source" nudge in the `ScopeNote`; real verification needs package-registry data and name-similarity analysis (out of client-only scope → backend/enrichment).
- **Ownership-change / takeover signal** — surface a recent maintainer/owner change or suspicious force-push history (a top account-takeover supply-chain vector that a "responsive, active" repo can mask). Needs history/audit data beyond the unauthenticated REST snapshot.
- **Release & commit attestation** — signed releases / commits, SLSA provenance, Sigstore — the actual security-*posture* signals, none of which the current "Security docs" dimension checks.

## Deferred platform reach
- Firefox and Safari adaptations.
- Non-GitHub code hosts.
- Private repository support.
- Repo comparison workspace (side-by-side).

## Deferred quality gates
- Formal WCAG-AA contrast audit and screen-reader QA pass (PoC is built-to-AA structurally but not audited).
