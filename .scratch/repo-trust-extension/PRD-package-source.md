# PRD — Package source (Supply-chain v1: canonical package↔repo linkage)

Status: ✅ implemented (branch `feat/package-source`)

> Landed: `checkPackageSource` + `parseGithubRepo` + the npm `RegistryAdapter` (`packageSource.ts`, `registryNpm.ts`); folded into `analyzeRepo` as an always-additive 7th contribution; manual `check-package-source` worker message + a separate "remembered" cache; `PackageSourceAction` button on card + popup with headline escalation; transfer-safe via GitHub redirect resolve. `SCORE_VERSION` `0.8.0`, manifest `0.2.9`, CLAUDE.md caution rule updated. 185 tests (pure seam + npm adapter + analyzeRepo integration; is-number-never-caution and the draft-js transfer regression both asserted). Open: in-browser dogfood; the mismatch→caution path uses a synthetic fixture (no live non-fork impersonation found).

> Goal: add a **manual, on-demand** 7th dimension — **"Package source"** — that answers the single highest-value pre-install question the tool currently punts on: *is this repo the genuine source of the package it claims to publish, or an impersonation/typosquat?* v1 verifies **linkage only** (one npm registry lookup, transfer-safe), behind a registry-agnostic seam. It does **not** assess malware, known vulnerabilities, or dependency risk — those stay explicitly "Not checked here."

## Problem Statement

As a developer deciding whether to install a package, I land on its GitHub repo and can't tell whether this repo is actually the canonical source of the package it claims to publish. A typosquat, or a malicious fork that declares a popular package's name, looks identical to the real project. The extension today says supply chain is *"not checked here — assess separately before installing"* (`TrustDetails.tsx`), so the most security-relevant pre-install question is left entirely unanswered — even though the answer to *"does the published package point back to this repo?"* is cheaply checkable.

## Solution

A **manual "Check package source" action** on the card/popup. The auto-analysis (the existing six dimensions) renders immediately and unchanged; the user explicitly clicks to run the heavier, external linkage check. On click, the extension:

1. Reads the repo's **root `package.json`** (GitHub contents API) to find the declared package `name`.
2. Looks that name up on the **npm registry** and reads its `repository` field.
3. **Resolves that repository URL through the GitHub API** (following transfer/rename redirects) and compares the resolved current `full_name` to the repo being viewed.
4. Maps the result to a verdict and, when warranted, **escalates the headline**.

Outcomes:
- **Verified** — the published package resolves back to this repo → an **additive lift** toward strong. Rendered as *"Confirmed source"*, never *"safe"*.
- **Confirmed mismatch** — a non-fork repo whose declared package is published and clearly resolves to a **different live repo** → a **high-severity flag → `caution`** (a second legitimate caution trigger alongside `archived`). This is the impersonation/typosquat tell.
- **Fork** — `repo.fork === true` and the package resolves to the upstream → neutral note (*"Fork — the canonical package is published from <upstream>"*); never caution.
- **No published package / private (monorepo) root / unpublished / unverifiable / registry unreachable** → **no evidence** (most repos aren't packages — absence is never a negative), never caution.

The result is **cached** so a re-visit shows it without re-clicking. The broad "Supply chain (malware, known vulnerabilities, dependency risk)" gap stays under **"Not checked here,"** updated to note that *source linkage* is now checked on request.

## User Stories

1. As a developer, I want to manually check whether this repo is the real source of the package it claims, so that I can spot an impersonation before installing.
2. As a user, I want the six-dimension verdict to appear immediately without waiting on a registry call, so that the normal experience stays fast.
3. As a user, I want the package-source check to run only when I click, so that the heavier external call and its latency aren't paid on every page load.
4. As a user who runs the check and sees a confirmed mismatch, I want the headline verdict to escalate to **caution**, so that a real impersonation changes the top-line and isn't buried in a sub-row.
5. As a user, I want a verified result to read as *"confirmed source,"* never *"safe"* or *"verified safe,"* so that I'm not misled into thinking the package's code was vetted.
6. As a user viewing a legitimate fork, I want it labelled as a fork pointing at its upstream, not flagged as impersonation, so that forks aren't false-accused.
7. As a user viewing a transferred/renamed repo (e.g. `facebookarchive/draft-js`), I want it NOT flagged as a mismatch, so that a repo move doesn't masquerade as impersonation.
8. As a user viewing a repo that publishes no package (or a monorepo whose root is private), I want an honest *"no published package at the repository root"* message, not a negative signal.
9. As a user, I want a registry/network failure to read as *"couldn't verify"* (no evidence), never as caution, so that an outage can't manufacture an alarm.
10. As a user, I want the dimension titled **"Package source"** and scoped precisely, so that it never implies malware/vuln/dependency assessment.
11. As a user, I want the "Not checked here" panel to still list malware, known vulnerabilities, and dependency risk as **not** assessed, so that the linkage check doesn't create false comprehensiveness.
12. As a user, I want my check result remembered (cached) on re-visit, so that I don't re-trigger the call each time.
13. As a maintainer, I want the linkage logic to be a pure function with an **injected registry-fetch** dependency, so that it's testable offline at the existing fixture seam.
14. As a maintainer, I want a **registry-agnostic adapter** interface with npm as the first concrete implementation, so that PyPI/crates/gems slot in later without reworking the seam.
15. As a maintainer, I want the `is-number`-never-`caution` guardrail to still hold (is-number verifies → lift, never caution), so that the load-bearing safety invariant survives the new dimension.
16. As a maintainer, I want a confirmed mismatch to fire `caution` via a **high-severity flag** (independent of the additive/core majority, exactly like `archived`), so that the mechanism matches the existing engine.
17. As a maintainer, I want the transfer-safety resolve step to follow GitHub redirects, so that a confident mismatch can only fire on a genuinely different live repo.
18. As a maintainer, I want `SCORE_VERSION` and the manifest version bumped, so that the new shape invalidates stale cache and tracks the user-facing slice.

## Implementation Decisions

### The linkage flow (v1, npm)
- **Discovery:** root `package.json` only via the GitHub contents API. `private: true`, a `workspaces` field, missing file, or missing `name` → `no-package`. Copy matches the reason: `workspaces` → "looks like a monorepo"; `private` → "root package.json is private" (a private root isn't necessarily a monorepo). Monorepo workspace-walking is explicitly v2.
- **Registry lookup:** one unauthenticated `GET registry.npmjs.org/<name>` (scoped names URL-encoded). 404 → `unpublished`; network/5xx → `unverifiable`; missing/garbage `repository` → `unverifiable`. None of these fire caution.
- **Transfer-safe comparison:** normalize the registry `repository` URL to `owner/repo`, then **resolve it through the GitHub API** and compare the resolved current `full_name` (lowercased) to the viewed repo. (Validated: `facebook/draft-js` resolves to `facebookarchive/draft-js`, eliminating the transfer false-positive.)
- **Verdict mapping:** resolved == viewed → `verified` (additive lift, positive signal). `fork === false` and resolved != viewed (both live) → `confirmed mismatch` (high-severity flag → caution). `fork === true` and resolved != viewed → `fork` (neutral note). Everything else → no evidence.

### Registry-agnostic seam
- A `RegistryAdapter` interface: detect the declared package from a `package.json`, look it up, and return its repository URL — with an `npm` implementation as the only one wired in v1. The transfer-resolve and repo comparison live in shared linkage logic above the adapter.

### Integration & architecture
- **Manual trigger:** a new background message (e.g. `check-package-source`) handled by the service worker (the single owner of fetch/scoring/caching). The card/popup renders a "Check package source" affordance; on click it dispatches the message and renders the returned result.
- **Headline escalation:** the result feeds the verdict as a 7th contribution — **additive** (excluded from the trust-majority denominator), but emitting a **high-severity flag** on confirmed mismatch so the flag drives `caution` independently of additivity (same path as `archived`). `verified` contributes an additive lift; the other outcomes contribute no evidence.
- **Cache:** the linkage result is cached (24h, keyed by `owner/repo` + `SCORE_VERSION`) so a re-visit shows it without a re-click.
- **Versioning:** `SCORE_VERSION` bumps (new contribution/flag shape → cache invalidation); manifest version bumps (user-facing slice).

### Conservative framing (product rules)
- Title **"Package source"** (precise, mirroring the "Security docs" precedent), never "Supply chain" or "Package authenticity."
- `verified` copy: *"Confirmed source — this repo is the published source of `<pkg>`."* Never "safe"/"verified safe"/"trusted."
- `mismatch` copy names the conflict factually: *"The published `<pkg>` resolves to a different repository (`<other>`) — this repo may be impersonating it."*
- The persistent `ScopeNote` (maintenance-not-security + confirm-the-official-source) is unchanged. The "Not checked here" entry updates to: source-linkage **is** checked on request; malware, known vulnerabilities, and dependency risk remain **not** checked.
- **CLAUDE.md update:** the "`caution` fires only on a high-severity flag (archived only)" rule becomes "archived, **or** a confirmed package-source impersonation mismatch."

## Testing Decisions

- **What makes a good test:** asserts the externally-observable linkage outcome for a given (repo, registry-response) pair — never internal wiring.
- **Primary seam:** a pure `checkPackageSource(deps, target, repo)` with the **registry fetch injected** (mirroring `analyzeRepo` + `githubClient`), and the GitHub transfer-resolve reusing the injected GitHub client. Committed fixtures (package.json + registry response + resolved-repo) drive each case.
- **Fixture cases:** `verified` (is-number), `fork` (a fork declaring upstream's name), `transfer` (**draft-js — must NOT caution**, the regression that justifies the resolve step), `confirmed mismatch` (**synthetic** — see open item), `no-package`/private monorepo root (react), `unpublished`, `unverifiable`/registry-unreachable.
- **Guardrail:** `jonschlinkert/is-number` verifies → additive lift, **never `caution`**, asserted.
- **Open testing item:** no *live* non-fork impersonation appeared in the 10-repo validation sample, so the mismatch→caution path needs a **synthetic fixture** (a crafted package.json whose published name resolves to a different live repo). Optionally seed a real known-typosquat if one can be found that's still live.
- **No UI render tests** (consistent with the current suite); the manual-action wiring is exercised through the pure seam + message handler.

## Out of Scope (v1)

- Monorepo `workspaces` walking / per-package linkage (v2, same adapter seam).
- Registry adapters beyond npm (PyPI, crates, gems) — interface designed-for, not implemented.
- Any assessment of malware, known vulnerabilities, dependency risk, SBOM, or signing/attestation (SLSA/Sigstore).
- A backend / cloud enrichment / authenticated APIs / a premium entitlement tier (a later phase; v1 is client-side and manual).
- Auto-running the check on page load.

## Further Notes

- **Validation evidence (10 repos):** 4 clean verifies (is-number, got, commander, express); 0 true mismatches in-sample; **1 false-positive caught** (`draft-js` transfer → drove the resolve-via-GitHub fix, empirically confirmed); monorepo gap exposed (react/lodash/babel/vue private roots → drove the documented v1 limit). The validation script lived in scratch; its findings shaped this PRD.
- **Decision log:** resources available but *simplest start* chosen → linkage-only, manual, npm-first behind an agnostic seam. Confirmed mismatch → caution (loud), made safe by fork-gating + GitHub transfer-resolve. Verified → additive lift, never "safe." Headline escalates on result. Title "Package source" to keep the malware/vuln/dep gap honestly "Not checked here."
- This is the first dimension that can introduce a **new caution trigger** since `archived`; the synthetic-fixture + guardrail recheck are the load-bearing safety gates before merge.
