# Repo Trust Extension — Phase 1 Client-Only PoC

Status: ready-for-agent

> Scope is the Phase 1 client-only proof of concept agreed during the grilling session. It is intentionally a subset of the four source specs (implementation, manifest/permissions, signal dictionary, wireframe). Everything cut is recorded in `docs/future-enhancements.md`, not lost.

## Problem Statement

When a developer lands on a public GitHub repository they are evaluating — to adopt a library, trial a tool, or recommend it to a team — they have to judge its trustworthiness from signals that are scattered across the page and easy to misread. Star counts and popularity say little about provenance, maintenance health, or security hygiene. Gathering the real signals (is there a license? a security policy? real releases? is the repo archived?) means clicking through multiple tabs, and even then the user has to assemble a judgment in their head. There is no fast, explainable, in-page answer to the question: "Should this repo get a closer look, or do I need to be cautious?"

## Solution

A Manifest V3 browser extension that, when the user is on a public GitHub repository page, renders a lightweight in-page **trust card** summarizing the repository's trust state, the extension's confidence in that assessment, and the top reasons behind it. The user can expand a **detail drawer** to see the per-dimension breakdown with rationale and evidence links that deep-link to the GitHub surfaces backing each claim. They can save repositories to a local **watchlist** to revisit later, and open a **popup** from the toolbar for the current page's summary and watchlist access.

The assessment is computed entirely client-side from the unauthenticated GitHub REST API — no backend, no account, no secrets. The language is deliberately conservative ("strong signals," "mixed signals," "caution," "limited evidence" — never "safe" or "malicious"), trust and confidence are presented as separate concepts, and every signal shown maps to inspectable evidence. Critically, the tool does not cry wolf: a small, finished, stable utility is never flagged as risky merely for being quiet.

## User Stories

1. As a developer evaluating a library, I want a trust summary to appear automatically on a public GitHub repo page, so that I can gauge the repo without clicking through tabs.
2. As a developer, I want the trust summary to render without blocking or disrupting the normal GitHub page, so that the extension never gets in my way.
3. As a developer, I want the single most prominent line to be the trust state, so that I get the headline answer at a glance.
4. As a developer, I want confidence shown right next to the trust state, so that I know how much evidence backs the assessment.
5. As a developer, I want the top three reasons (a mix of positives and cautions) on the card, so that I understand the summary without expanding anything.
6. As a developer, I want a "View details" action on the card, so that I can drill deeper when I choose to.
7. As a developer, I want clicking "View details" to open an in-page drawer rather than navigate away, so that I keep my place on the repo page.
8. As a developer, I want the detail drawer to show each evaluated trust dimension with a state and short rationale, so that I understand why the summary is what it is.
9. As a developer, I want each dimension's rationale paired with evidence links to the relevant GitHub surface, so that I can verify the claim myself.
10. As a developer, I want evidence links to only point at things that actually exist, so that I never click through to a 404.
11. As a developer, I want dimensions we do not evaluate in this version to be shown as "not evaluated," so that I am not misled into thinking they were assessed and passed.
12. As a security-conscious user, I want an archived/dormant repository to be surfaced as a caution, so that I do not adopt something no longer maintained.
13. As a developer evaluating a small, finished utility, I want it to NOT be flagged as risky just because it has no recent releases or security policy, so that I can trust the tool's judgment.
14. As a developer, I want a brand-new repo with little history to read as "limited evidence" rather than a bad score, so that low evidence is not confused with low trust.
15. As a developer, I want a repo owned by a personal account (not a verified org) to have lower provenance but not be flagged as caution, so that solo-maintained projects are judged fairly.
16. As a developer, I want a repository's missing license to count against it modestly, so that licensing ambiguity is visible but not alarmist.
17. As a developer, I want the assessment to honor GitHub's org-default community-health files, so that a repo using an org `.github` fallback is not unfairly marked as missing docs.
18. As a developer, I want to save a repository to a watchlist from its card or the popup, so that I can compare or revisit it later.
19. As a developer, I want the watchlist to open instantly showing each repo's last-known trust state and how recently it was analyzed, so that I get a usable overview without waiting on the network.
20. As a developer, I want to manually refresh a single watchlist entry, so that I can update one repo's assessment on demand.
21. As a developer, I want the watchlist to never auto-refresh everything at once, so that I do not exhaust the API rate limit in one action.
22. As a developer, I want to remove a repository from my watchlist, so that I can keep the list relevant.
23. As a developer, I want recency shown as a relative freshness state ("just now," "today," "1d ago," "stale — refresh recommended") rather than a fixed timestamp, so that staleness is self-evident.
24. As a developer, I want to click the toolbar icon and see the current page's trust state plus quick actions, so that I have a compact control center.
25. As a developer, I want the popup on an unsupported page to tell me clearly that no supported repository was detected, so that I am not confused by an empty UI.
26. As a developer, I want to reach my watchlist from the popup, so that I can review saved repos from anywhere.
27. As a developer browsing many repos, I want revisiting a recently analyzed repo to be instant and cost no API calls, so that the tool feels fast and stays within rate limits.
28. As a developer, I want a clear, non-alarmist message when the API rate limit is reached, including when it will recover, so that I understand why analysis is paused.
29. As a developer, I want a distinct "limited evidence" state when a repo does not expose enough public information, so that I know to review it manually.
30. As a developer, I want a clear "analysis temporarily unavailable" state with a retry on transient failure, so that a hiccup does not look like a verdict.
31. As a developer on a private repository, I want the extension to clearly state it cannot analyze it, so that I am not given a misleading partial result.
32. As a developer on a non-repository GitHub page, I want the extension to stay silent or show an unsupported state, so that it does not inject noise everywhere.
33. As a developer navigating GitHub's client-side transitions between repos, I want the card to update to the repo I am actually viewing, so that I never see a stale or wrong-repo assessment.
34. As a keyboard user, I want to operate the card, drawer, popup, and watchlist by keyboard with predictable focus, so that I can use the extension without a mouse.
35. As a keyboard user, I want focus to return to the triggering control when I close the drawer, so that I do not lose my place.
36. As a user who relies on more than color, I want every trust state conveyed with an icon or text label, not color alone, so that the state is unambiguous.
37. As a user sensitive to motion, I want animations to respect my reduced-motion preference, so that the UI does not cause discomfort.
38. As a privacy-conscious user, I want the extension to require no account and send no telemetry, so that my browsing is not tracked.
39. As a developer, I want each assessment to record the scoring version it was produced with, so that results remain interpretable as the rules evolve.
40. As a maintainer comparing my own repo against a consistent rubric, I want the same explainable dimensions applied to any public repo, so that I can see where my project stands.

## Implementation Decisions

### Platform & distribution
- Manifest V3 extension targeting Chromium browsers (Chrome, Edge, Brave). Firefox/Safari deferred.
- Distribution for this build is **load-unpacked only** (dogfood). No Chrome Web Store submission, listing assets, or privacy-policy URL in scope.
- No backend, no cloud enrichment, no accounts, no telemetry. Fully client-side.

### Data source & permissions
- **Hybrid data source:** the DOM/URL is used only to detect a supported repository page and extract `owner/repo` for instant rendering; the **unauthenticated GitHub REST API** is the source of truth for the analysis.
- GraphQL is explicitly excluded because it requires authentication, and this build stores no secrets (no Personal Access Token).
- **Private repositories are unsupported.** Unauthenticated API calls return 404 for them; the extension routes that to an explicit "cannot analyze" state and never falls back to scraping authenticated page content.
- Manifest permissions kept minimal: `storage` and host access to `https://github.com/*` and `https://api.github.com/*`. Content script runs only on `https://github.com/*` and internally gates rendering to supported repo pages. Avoid `tabs`, `history`, `identity`, `scripting` (prefer declarative content script), `alarms`, and broad host access unless a concrete need arises.

### Architecture
- **Content script is "dumb":** detect the page, extract `owner/repo`, request analysis from the background worker, and own mount/unmount of the in-page UI. It performs no network or scoring logic.
- **Background service worker owns all fetch, scoring, and caching.** It is the single place the API rate limit is managed and the single owner of analysis results (the popup consumes the same results).
- **GitHub client-side navigation (Turbo) is a first-class concern.** Route changes are observed (History API / navigation events plus a DOM-observer fallback), debounced, and the stale card is unmounted before a new one is mounted for the new repo. This is the highest-risk reliability detail.
- The in-page card and drawer are mounted inside a **Shadow DOM** root for style isolation in both directions (GitHub CSS cannot leak in; extension CSS cannot break GitHub's layout or accessibility).

### Build stack
- Vite + the CRXJS Vite plugin + TypeScript for the MV3 build (handles manifest and multiple entry points: content script, background worker, popup page, watchlist page).
- **Preact** for all UI surfaces (small footprint, important for the injected content-script bundle).
- `chrome.storage.local` for persistence (watchlist, analysis cache).

### Scoring engine
- Evaluates **three dimensions only** in this version: **Provenance, Security hygiene, Transparency.** Release discipline, Governance, Supply-chain, and Responsiveness are deferred and surfaced in the drawer as "not evaluated in this version."
- Computed from **~2 REST calls per analysis**: the core repository object (`GET /repos/{owner}/{repo}`) and the community profile (`GET /repos/{owner}/{repo}/community/profile`). The community-profile endpoint is **load-bearing** because it resolves community-health files the way GitHub does, including the org-default `.github` fallback. **A first build task must spike-verify that this endpoint returns useful data unauthenticated for public repos;** if it does not, fall back to direct content checks while preserving the org-default-fallback behavior.
- **Output is qualitative states, never numeric scores shown to the user.** Each signal resolves to an evidence state; each dimension rolls up to `strong | mixed | weak | unknown`; the top-level trust state is derived deterministically.
- **Confidence is separate from trust** and is driven by evidence breadth: `high` when all three dimensions had observable evidence, `medium` when two, `low` when one or none. Confidence absorbs low evidence so small/sparse repos read as low-confidence, not bad.
- **Severity posture (anti-false-alarm):** `archived` is high severity; missing license is medium; missing security policy, sparse documentation, and absent releases are low severity or contextual; a missing code of conduct is very low / contextual. Missing items primarily lower confidence, not trust.
- **Top-level trust state rollup** (the decision, encoded precisely):
  - `caution` — only when a high-severity flag is present (in this version, effectively an archived/dormant repo). Broad weakness alone never escalates to caution.
  - `insufficient_evidence` — when confidence is `low`.
  - `strong_signals` — majority of evaluated dimensions are `strong` and no negative flags.
  - `mixed_signals` — the default for everything else, including repos that are merely quiet or sparse.
- **Versioned:** every analysis records `score_version` (starting `"0.1.0"`). Cached results and any shared output carry it. The specific weights and the weak/mixed/strong cutoffs live as tunable constants in a single configuration unit and are finalized against the archetype fixtures.
- The analysis result shape (decision-encoding type, to be refined in code):
  - top level: `trust_state`, `confidence_state`, `dimension_results[]`, `flags[]`, `positive_signals[]`, `score_version`, `analyzed_at`
  - per dimension: `dimension_key`, `dimension_state`, `confidence_state`, `triggered_signals[]`, `evidence_links[]`, `rationale_summary`

### Caching & watchlist
- Each analysis is cached in `chrome.storage.local` keyed by `owner/repo` + `score_version`, stamped with `analyzed_at`, with a **24-hour TTL.** Within TTL, revisiting a repo costs zero API calls. Cache entries are invalidated when stale or when `score_version` changes.
- **Watchlist entries are saved snapshots, not live queries.** Opening the watchlist renders last-known snapshots instantly with their recency, performing no network calls. Refresh is **manual and per-row only** — no bulk refresh, no background auto-refresh — to protect the rate-limit budget.
- The UI displays **recency** (a live-computed relative freshness state against the 24h TTL), not a frozen timestamp; the absolute `analyzed_at` is stored solely for TTL math and recency computation.

### UI surfaces
- In scope: in-page **trust card**, expandable **detail drawer**, toolbar **popup**, **watchlist page**, and the required **states** (unsupported page, loading, limited evidence, rate-limit/error with retry).
- **No Settings page and no Share-summary** in this build (deferred to backlog). The "Balanced" scoring profile is hardcoded and the theme follows the system.
- Copy follows the spec's conservative vocabulary: "Strong signals," "Mixed signals," "Caution," "Limited evidence," "Review recommended." Avoid "Safe," "Trusted," "Dangerous," "Malicious."
- Evidence links are **constructed URLs** derived from `owner/repo` (repo root, LICENSE path, security policy/Security tab, README, CONTRIBUTING). A link renders only when the underlying signal was observed; otherwise it is omitted or points to the relevant tab — never a 404.

### Accessibility
- Built to WCAG AA structurally from the start: semantic markup and ARIA roles, full keyboard operability (tab/enter/escape), focus returns to the triggering control on drawer close, and `prefers-reduced-motion` respected.
- **Color is never the only signal:** every trust state carries an icon or text label.
- A formal contrast audit and screen-reader QA pass are deferred to a polish phase; the build does not gate on them.

## Testing Decisions

- **Good tests assert external behavior, not implementation details.** For the scoring engine, that means asserting the produced analysis (trust state, confidence, dimension states, flags, positive signals, evidence states, `score_version`) for a given set of GitHub API responses — never the internal weighting math or private helpers.
- **Primary seam — `analyzeRepo` with the HTTP boundary injected.** The background-worker analysis flow is tested by injecting a fake fetcher that returns committed fixture JSON, asserting the full analysis output. This single, highest seam covers normalization → scoring → flag/positive generation deterministically, with no network. The pure scoring logic is exercised through this seam rather than tested directly.
- **Fixtures are committed per-archetype GitHub API responses**, captured once from real repositories and stored as JSON so tests never hit the network and remain stable even if a source repo changes or is deleted. The verified archetype set:
  - `facebook/react` — healthy, verified-org, multi-maintainer → expected strong / high.
  - `sindresorhus/got` — single-maintainer but disciplined; relies on the org-default health-file fallback → expected strong / high.
  - `facebookarchive/draft-js` — archived but otherwise solid → expected caution (archived overrides).
  - `MaxGoodfella/test-repo` — no license, no docs, not archived → expected mixed / low (NOT caution).
  - `jonschlinkert/is-number` — simple-stable finished utility (license + README only, no security policy, no releases) → **required test: never caution.**
  - `The-Silent-Voyager-coder/hex-to-rgb-converter` — brand-new, no license → expected insufficient evidence / low.
  - `tj/commander.js` — personal-account but strong docs/security/releases → expected provenance downgrade without caution.
- Expected outcomes above are provisional and are finalized by tuning the threshold constants against these fixtures; the `is-number`-is-never-caution assertion is a hard requirement, not a tunable.
- **Secondary seam — `parseRepoContext`.** Page detection / `owner-repo` extraction / private-and-unsupported classification is pure URL logic and unit-tested directly, because misclassification (analyzing the wrong or a private repo) is correctness-critical.
- **Not seam-tested (thin/manual for the PoC):** caching behavior, SPA-navigation mount/unmount lifecycle, Shadow-DOM mounting, and live API integration. Recency formatting is trivial enough to be covered within the analyze tests rather than its own seam.
- No prior art exists in the repo (greenfield); these seams establish the testing conventions.

## Out of Scope

- The four deferred trust dimensions: Release discipline, Governance, Supply-chain, Responsiveness (shown as "not evaluated").
- Cloud enrichment, the enrichment/rules/ingestion backend services, historical snapshots (`/history`), and advisory/package-registry correlation.
- User accounts, watchlist sync, team collaboration, and notifications on trust-posture change.
- Settings page and Share-summary export.
- Telemetry and the analytics event taxonomy.
- Chrome Web Store packaging, listing, and review compliance.
- An optional Personal Access Token field (and the 5,000/hr authenticated limit it would unlock).
- Simplicity-aware contextual downgrading of negative signals (detecting "this is a small finished repo" to suppress negatives).
- Private repositories, non-GitHub hosts, numeric score exposure, repo comparison workspace.
- Formal WCAG-AA contrast audit and screen-reader QA pass (designed-to, not audited).

## Further Notes

- All cut scope is to be recorded in `docs/future-enhancements.md` so deferrals are deliberate and recoverable.
- The single biggest external risk is the **unauthenticated 60 requests/hour GitHub API limit.** The design mitigates it with ~2 calls per analysis, a 24h cache, snapshot-based watchlist with manual per-row refresh, and a clean rate-limit state that reads `X-RateLimit-Reset`. The first implementation task should validate real call counts against the budget.
- The **community-profile endpoint's unauthenticated behavior is an assumption to verify first.** If it is unavailable unauthenticated, the fallback is direct content/health-file checks that still honor GitHub's org-default `.github` resolution.
- The conservative-language and "confidence ≠ trust" principles are product-defining, not cosmetic: they are what prevent the tool from either over-trusting popular repos or false-alarming on small, finished, stable ones (the `is-number` guardrail).
