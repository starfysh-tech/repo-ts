# PRD — Cloud enrichment v1: known-advisory lookup ("Known advisories")

Status: ready-for-agent (extension side) · backend = separate effort

> Goal: add the first **security** data layer — a **manual, opt-in** "Known advisories" panel that, on request, sends `owner/repo` to **our backend**, which resolves the repo's dependencies (authenticated GitHub dependency-graph) and returns known **CVE/GHSA/OSV advisories**. It fills the "known vulnerabilities / dependency risk" half of the "Not checked here" gap **without** touching the maintenance verdict, and **without** sending anything off-device until the user clicks.

## Problem Statement

The extension says, on every verdict, that *malware, known vulnerabilities, and dependency risk are "not checked here — assess these separately before installing."* That's the single most security-relevant pre-install question, and it's the one thing the client genuinely can't answer: resolving a repo's dependency tree and checking it against advisory databases needs authenticated APIs and server-side work the unauthenticated, client-only extension can't do. A developer evaluating a dependency still has to leave the tool to answer "does this have known vulnerabilities?"

## Solution

A **manual "Check known vulnerabilities" action** on the card/popup (mirroring Package source). On click — and only on click — the extension sends `{ owner, repo }` to **our backend**, which:

1. Uses an authenticated GitHub token to pull the repo's **dependency graph / SBOM** (resolved package names + versions — the auth-only data the client can't get).
2. Queries **OSV** (and optionally the **GitHub Advisory Database / GHSA**) for known advisories affecting those package versions.
3. Returns a list of advisories — `{ id (GHSA/CVE), severity, package, version, summary, url }` — plus counts by severity and a "dependencies scanned" count.

The extension renders a **"Known advisories"** panel: a factual count and a row per advisory, each **linked to its source** (OSV/GHSA) so the user verifies it directly rather than trusting our number. The **maintenance verdict is untouched** — advisories are a separate, explicitly-security axis. The "Not checked here → Supply chain" note updates: *known vulnerabilities are now checkable on request; malware and dependency risk are still not checked.*

This is the first time the product talks to infrastructure we control and the first signal that leaves the device — so the privacy boundary is the design's spine: **nothing is sent until the user opts in per repo**, only the public `owner/repo` is sent, and the backend retains nothing identifying.

## User Stories

1. As a developer, I want to manually check a repo for known dependency vulnerabilities, so that I can answer the one security question the tool always deferred.
2. As a user, I want nothing sent off my device until I click "Check known vulnerabilities" on a specific repo, so that the local-only promise holds by default.
3. As a user, I want a clear one-time consent before the first backend call (what's sent, that it leaves the device), so that the privacy trade-off is explicit and mine to make.
4. As a user, I want each advisory linked to OSV/GHSA, so that I can verify it at the source rather than trust an opaque backend number.
5. As a user, I want the maintenance verdict to stay exactly as it was, so that a well-maintained repo with a (fixable) vulnerable dependency isn't mislabeled as low-trust.
6. As a user, I want "no known advisories found" to read as a point-in-time fact, never "safe" or "secure," so that I'm not given false assurance.
7. As a user, I want a backend/network failure to read as "couldn't check," never an alarm or a verdict, so that an outage can't manufacture fear or false comfort.
8. As a user, I want the "Not checked here" panel to still list malware and dependency risk as not assessed, so that one new check doesn't imply comprehensiveness.
9. As a user, I want my result cached so a re-check isn't re-sent needlessly, with a visible "as of" time, so that I know how fresh it is.
10. As a maintainer, I want the extension-side advisory fetch behind an injected seam, so that it's testable offline against fixtures like the other clients.
11. As a maintainer, I want a stable backend API contract documented here, so that the extension and the (separately built) backend can be developed against it independently.
12. As a maintainer, I want the maintenance scoring engine completely unchanged (no `SCORE_VERSION` bump for this), so that the deterministic, client-auditable core is unaffected.

## Implementation Decisions

### Scope split
- **This PRD covers the extension side** (the manual action, the panel, the consent, the injected backend client) **and the backend API contract**. The **backend implementation is a separate effort/codebase** (own infra) — it is out of scope for the extension repo beyond the contract below.

### Backend API contract (v1)
- `POST /v1/advisories` with `{ owner, repo }` → `200` with:
  ```
  { scanned: number,            // dependencies resolved + checked
    advisories: [ { id, source: 'GHSA'|'OSV', severity: 'critical'|'high'|'medium'|'low',
                    package, version, summary, url } ],
    as_of: ISO8601 }
  ```
  Distinct non-result responses (never an alarm on the client): `no_dependency_data` (repo has no resolvable dependency graph), `unavailable` (transient). No user identity in the request.
- Backend internals (recommended, not binding): authenticated GitHub token → `GET /repos/{o}/{r}/dependency-graph/sbom` for resolved PURLs/versions → OSV `POST /v1/querybatch` (open, multi-ecosystem) primary, GHSA via the same token optional for richer GitHub-curated data. Cache by `owner/repo` with a TTL to bound cost; per-client rate limit.

### Deployment (v1) — DECIDED & LIVE
- **Backend is built and deployed:** a Cloudflare Worker + Workers KV, in the sibling repo `../repo-trust-backend`, live at **`https://repo-trust-backend.randall-847.workers.dev`** (route `POST /v1/advisories`). Smoke-tested end-to-end: real GitHub SBOM resolution → OSV query, KV cache hit/miss, input guard (`400 bad_request`), and `no_dependency_data`.
- The extension must read this base URL from a **single constant** (later overridable in Settings), never hardcoded across files. The injected `fetchAdvisories` seam owns the actual `fetch`.

### Privacy boundary
- **Manual, per-repo, opt-in.** Only the public `owner/repo` leaves the device, only on an explicit click. No PAT, no scoring config, no user identity sent. A **one-time consent** gate before the first backend call, plus a persistent note in the panel + settings stating what's sent and the backend's no-retention policy. The existing "stored locally … except api.github.com" copy is amended to name the backend explicitly as a user-triggered exception.

### Presentation (conservative framing)
- A **"Known advisories" panel** (separate from the maintenance Trust details), shown after the manual check: a factual headline (`3 known advisories across 142 dependencies — 1 high`) and a row per advisory (severity · `package@version` · summary · source link). Counts are evidence facts (like evidence links), not a numeric trust score — consistent with "show qualitative states, not numeric scores" for the *verdict*.
- **Maintenance verdict untouched** — no new flag, no caution, no `trust_state` change. Advisories are a distinct security axis.
- **Empty result copy:** *"No known advisories found in the resolved dependencies (as of …)."* Never "safe"/"secure"; a sub-note: only resolved deps, only *known* advisories, point-in-time.
- The **"Not checked here"** entry updates: *known vulnerabilities — checkable on request; malware and dependency risk — still not checked.*
- Result cached per repo (with `as_of`) so a revisit shows it without re-sending; a manual "re-check" re-sends.

### Open / deferred (the user has resources; these are infra calls)
- ~~Backend **stack + hosting**~~ — **RESOLVED:** Cloudflare Worker + Workers KV (see "Deployment (v1)" above), deployed and smoke-tested.
- **Premium/entitlement/auth** — v1 may ship open or behind a thin gate; the premium model is a separate decision. If auth is added, it must not undermine the no-identity-retention posture.
- Advisory **source mix** (OSV-only vs OSV+GHSA) and **ecosystem coverage** (whatever the dependency graph + OSV return — no per-ecosystem adapter needed, unlike Package source).

## Testing Decisions

- **What makes a good test:** asserts the externally-observable panel state for a given backend response — never internal wiring.
- **Extension seam:** a pure `fetchAdvisories(deps, target)` with the **backend call injected** (mirroring `githubClient` / the registry adapter), so the panel logic is testable offline. Committed fixtures for: advisories-found (mixed severities), none-found, `no_dependency_data`, and `unavailable`/network-error (→ "couldn't check", never an alarm).
- **Framing assertions:** "no known advisories" copy never contains "safe"/"secure"; a backend error never produces a verdict or a caution; the maintenance `trust_state` is identical with and without the advisory result (a regression test that enrichment can't move the verdict).
- **No UI render tests** (consistent with the suite); the manual-action wiring is exercised through the pure seam.
- **Backend** is tested in its own codebase against the contract above; the extension tests run against a mocked backend client.

## Out of Scope (v1)

- The backend implementation itself (separate effort) and its hosting/ops.
- Folding advisories into the maintenance verdict / a new caution trigger.
- Malware scanning, dependency-risk *scoring*, license-compliance, SBOM export.
- Automatic / background enrichment (watchlist or every-page).
- A premium/billing system (the entitlement decision is deferred).
- Remediation advice / "upgrade to X" suggestions (show the advisory + link; let the source own the fix guidance).

## Further Notes

- **Why a backend (recap):** the resolved dependency set comes cleanly only from GitHub's auth-only dependency-graph/SBOM; a backend also centralizes the privacy boundary, caches to bound advisory-API cost, and is the natural home for a future premium tier. Client-direct-to-OSV was rejected (messy multi-ecosystem lockfile parsing, unreliable version resolution, still third-party egress).
- **Identity tension:** this is the first signal that leaves the device and the first that depends on infrastructure the user can't audit. The mitigations are deliberate: opt-in per repo, source links on every advisory (verify, don't trust), and the maintenance verdict staying pure/client-side. The product stays "maintenance signals, not a safety review" for its *verdict*; the advisory panel is a clearly-labeled, separate, point-in-time security-*data* surface — not a security audit.
- **Decision log:** purpose = known-vuln/advisory data; own backend (auth dependency-graph → OSV/GHSA); manual per-repo opt-in; separate panel, verdict unchanged, every advisory source-linked.
