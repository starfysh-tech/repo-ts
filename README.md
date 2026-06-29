# Repo Trust

A Manifest V3 (Chromium) browser extension that shows **explainable, conservative trust signals** on public GitHub repository pages. It surfaces how a project is *maintained* — provenance, security docs, transparency, release discipline, governance, responsiveness — as qualitative states, never numeric scores, and never as a safety verdict.

> **Maintenance signals, not a security review.** Repo Trust measures how a project is maintained; it does not inspect the code for safety, and every signal is gameable by a motivated actor. Malware, known vulnerabilities, and dependency risk are labelled "not checked here" — assess those separately before installing.

## What it does

- Injects a shadow-DOM **card** on a repo page with a one-line takeaway, a confidence meter, and collapsible "Trust details" per dimension. The card is **draggable** and **collapses to an edge tab**.
- Scores **6 automatic dimensions** from the unauthenticated GitHub REST API, plus two **manual, on-demand** checks:
  - **Package source** — confirms the repo is the published source of the package it declares (npm), transfer-safe; a confirmed impersonation mismatch is the one supply-chain `caution` trigger (alongside `archived`).
  - **Known advisories** — an opt-in cloud-enrichment check that resolves the repo's dependency graph and lists known GHSA/OSV advisories. The first and only data that leaves the device, gated behind a one-time consent; the maintenance verdict is untouched.
- A **watchlist** + popup, an **options page** (optional GitHub PAT to lift the rate limit; user-configurable scoring presets + advanced thresholds).

Conservative-language rule throughout: never "safe"/"trusted"/"dangerous"/"malicious" — only "strong signals", "mixed signals", "caution", "limited evidence". Confidence is separate from trust: a small, finished utility is *low confidence*, not *bad*.

## Build & load

```bash
npm install
npm run build          # produces the unpacked extension in dist/
```

Then `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `dist/`.

```bash
npm test               # Vitest (pure seams + per-archetype fixtures)
npm run typecheck      # tsc --noEmit
```

## Architecture (pointers)

- `src/content/` — content script: `parseRepoContext` (URL classification), `mount.tsx` (single shadow-DOM host + SPA-nav watch), `CardShell.tsx` (drag/collapse chrome), `card.tsx` (UI states).
- `src/background/service-worker.ts` — owns all fetch/scoring/caching; `cache.ts` (24h TTL keyed by `owner/repo` + `SCORE_VERSION` + config hash); `advisoriesCache.ts` (separate keyspace for the manual advisories result).
- `src/engine/` — `analyzeRepo` (pure, injected-fetch seam) + the 6 auto scorers + the manual `packageSource` + the `advisoriesClient` (talks to the cloud backend); `githubClient`.
- `src/shared/` — components reused by card + popup, the `display` vocab/accents, `watchlist`, `settings`, scoring knobs.

The maintenance scoring engine is deterministic and client-auditable; `jonschlinkert/is-number` is asserted to never read `caution` (the load-bearing guardrail).

## Cloud enrichment backend

The "Known advisories" check talks to a small **Cloudflare Worker** (GitHub dependency-graph SBOM → OSV) in a **separate repo** (`../repo-trust-backend`), against the contract in [`PRD-cloud-enrichment.md`](.scratch/repo-trust-extension/PRD-cloud-enrichment.md). Nothing is sent off-device until the user opts in per repo; only the public `owner/repo` leaves, and the backend retains nothing identifying.

## Project docs

- **[CHANGELOG.md](./CHANGELOG.md)** — what shipped, most recent first.
- **Feature workspace & status** — [`.scratch/repo-trust-extension/README.md`](.scratch/repo-trust-extension/README.md) (PRDs, issues, current progress).
- **Backlog / deferred scope** — [`docs/future-enhancements.md`](docs/future-enhancements.md).
- **Working agreements** — [`CLAUDE.md`](./CLAUDE.md) (product rules, build gotchas, agent skills).
