# Future Enhancements — Repo Trust Extension

Scope deliberately cut from the Phase 1 client-only PoC during the design grilling. Each item was a conscious deferral, not an oversight. Captured here so the cuts are recoverable. See `.scratch/repo-trust-extension/PRD.md` for the in-scope build.

## Trust dimensions (mostly shipped — kept for history)
The PoC originally scored 3 of 7. Since then **Release discipline**, **Governance**, and **Responsiveness** all shipped as scored dimensions (Phase 2), so the engine now scores **6 automatic** dimensions plus 2 manual checks. What remains deferred:
- **Supply-chain** — partially shipped: the manual **"Package source"** check (canonical package↔repo linkage, npm, transfer-safe; confirmed mismatch → caution) and the manual **"Known advisories"** cloud check (dependency-graph SBOM → OSV/GHSA, opt-in). **Still deferred:** dependency churn, malware, dependency-risk *scoring*, SBOM/attestation — these stay under "Not checked here".
- Deeper variants of the shipped dimensions (e.g. signed/attested releases, per-ecosystem governance thresholds, PR-review-latency time series) remain future work.

## Deferred UI surfaces & features
- ~~**Settings page** — scoring profile selector (Balanced/Cautious/Minimal)~~ — **shipped** (options page with presets + an advanced per-threshold UI). Theme still follows system.
- **Share summary** — plain-language exportable summary for notes/chat (FR-8 "should"). Still omitted.

## Deferred platform & infrastructure
- **Cloud enrichment** — first slice **shipped**: a Cloudflare Worker backend (`../repo-trust-backend`) powering the manual "Known advisories" check. A broader enrichment/rules/ingestion service remains deferred.
- **Historical snapshots** (`/history`) and trend/delta analysis. *(deferred)*
- ~~**Advisory & package-registry correlation**~~ — **shipped** (Known advisories + Package source).
- **Chrome Web Store packaging** — listing assets, screenshots, privacy-policy URL, permissions-justification review. PoC is load-unpacked only. *(deferred)*
- ~~**Optional Personal Access Token field**~~ — **shipped** (options page; lifts 60/hr → 5,000/hr, stored locally).

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
- ~~**Manufactured-credibility guard**~~ — **shipped** (`SCORE_VERSION` 0.6.0): flags the temporally implausible "newly created **and** already highly active" pattern as a medium caveat (never `caution`), configurable sensitivity/severity.
- ~~**Provenance-gated verdict**~~ — **shipped** (`SCORE_VERSION` 0.6.0): `strong_signals` now requires provenance itself to be strong, so a newly-created / mixed-provenance repo can't earn the top verdict on activity/additive signals alone.

## Deferred identity & canonicality
- **Canonical-source / typosquat verification** — registry↔repo linkage **shipped** as the manual "Package source" check (confirmed mismatch → caution). Still deferred: confusable/typosquat name-similarity warnings (needs name-similarity analysis over the registry namespace).
- **Ownership-change / takeover signal** — surface a recent maintainer/owner change or suspicious force-push history (a top account-takeover supply-chain vector that a "responsive, active" repo can mask). Needs history/audit data beyond the unauthenticated REST snapshot.
- **Release & commit attestation** — signed releases / commits, SLSA provenance, Sigstore — the actual security-*posture* signals, none of which the current "Security docs" dimension checks.

## Deferred platform reach
- Firefox and Safari adaptations.
- Non-GitHub code hosts.
- Private repository support.
- Repo comparison workspace (side-by-side).

## Deferred quality gates
- Formal WCAG-AA contrast audit and screen-reader QA pass (PoC is built-to-AA structurally but not audited).
