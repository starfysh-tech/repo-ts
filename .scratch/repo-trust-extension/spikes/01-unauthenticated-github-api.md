# Spike 01 — Unauthenticated GitHub REST API: findings

**Date:** 2026-06-24 · **Verdict: GO on the 2-call design.**

Live unauthenticated probes (`curl`, no token) against the real API for the archetype repos. Every load-bearing assumption from the PRD held.

## Go/no-go

**GO.** A full analysis needs exactly **2 unauthenticated GET calls** and the data for all three Phase-1 dimensions (Provenance, Security hygiene, Transparency) is present. No fallback path is required — `community/profile` works unauthenticated and honors the org-default `.github` fallback.

## Endpoints (both return `200` unauthenticated for public repos)

1. `GET /repos/{owner}/{repo}` — core repository object.
2. `GET /repos/{owner}/{repo}/community/profile` — community-health files.

## Request budget

- **2 calls per fresh analysis** → unauthenticated limit is **60/hr per IP** = ~30 fresh analyses/hr worst case. The 24h cache + manual-only watchlist refresh keep normal browsing well under budget.
- Rate-limit headers are present on **every** response:
  - `x-ratelimit-limit: 60`
  - `x-ratelimit-remaining: <n>` (decrements per call; a `301` redirect still consumes 1)
  - `x-ratelimit-reset: <unix-epoch-seconds>` — drives the non-alarmist rate-limit state's "recovers at" copy.

## Org-default `.github` fallback — CONFIRMED unauthenticated

`sindresorhus/got` relies on `sindresorhus/.github` for shared health files. Unauthenticated `community/profile` resolved them natively:
- `files.code_of_conduct.html_url` → `https://github.com/sindresorhus/.github/blob/main/code-of-conduct.md`
- `files.contributing.html_url` → `https://github.com/sindresorhus/.github/blob/main/contributing.md`

So a repo using an org `.github` fallback is **not** penalized for "missing docs" — the endpoint does the resolution for us. This is the reason `community/profile` is load-bearing rather than doing direct content checks.

## Redirect handling — ACTION for the engine

Renamed/moved repos `301`-redirect. `facebook/react` now resolves to the canonical numeric path `/repositories/10270250` (full_name comes back `react/react`). The old path `301`s on **both** endpoints with an empty/`"Moved Permanently"` body.

- **`fetch` follows redirects by default (`redirect: "follow"`), which handles this transparently.** Do **not** set `redirect: "manual"`.
- A client that doesn't follow redirects would see an empty body and misread the repo as "no data" — guard the analysis path so a redirect is never treated as missing evidence.

## Field availability per dimension

### Provenance — from `/repos`
- `license` — object with `key` (`"mit"`) / `spdx_id` (`"MIT"`); `null` when absent (confirmed `null` on `hex-to-rgb-converter`).
- `owner.type` — `"User"` vs `"Organization"` (provenance downgrade for personal accounts; e.g. `tj`, `jonschlinkert` = User; `facebookarchive` = Organization). Note: org type alone ≠ "verified org"; verification isn't exposed here.
- `archived` — boolean; `true` on `facebookarchive/draft-js` (the high-severity `caution` trigger). Also `disabled`, `fork`.
- `created_at` (age) and `pushed_at` (dormancy/last-activity) — ISO timestamps.
- `homepage`, `topics[]`, `description` — consistency signals.

### Security hygiene — from `/community/profile` (+ `archived` from `/repos`)
- `files.security` — security policy; `null` when absent (low severity). `null` for got, is-number, react.
- `files.code_of_conduct` — honors org fallback (see above).

### Transparency — from `/community/profile`
- `files.readme`, `files.contributing`, `description`, `documentation`, `health_percentage` (0–100).
- `health_percentage` observed: react/got **100**, is-number **42**, brand-new hex-to-rgb-converter **14** — tracks the "limited evidence" intuition but is a coarse signal; use the explicit `files.*` presence for scoring, treat health % as secondary.

## Archetype data captured (for tuning later)

| repo | owner | license | archived | security | coc | contributing | health% |
|---|---|---|---|---|---|---|---|
| facebook/react (→react/react) | Org | MIT | false | — | ✓ | — | 100 |
| sindresorhus/got | User | MIT | false | — | ✓ (org-default) | ✓ (org-default) | 100 |
| jonschlinkert/is-number | User | MIT | false | — | — | — | 42 |
| facebookarchive/draft-js | Org | MIT | **true** | — | — | — | (n/a) |
| The-Silent-Voyager-coder/hex-to-rgb-converter | User | **none** | false | — | — | — | 14 |

`is-number` = the guardrail: license + README only, no security/CoC/contributing, not archived → must resolve **mixed/low, never caution**.

## Not empirically tested (documented behavior)

- **Private repos:** unauthenticated calls return `404` (well-documented). The engine routes `404` on `/repos` to the explicit "cannot analyze (private/unsupported)" state. Could not test against a private repo from here; relying on documented behavior, to be confirmed during walking-skeleton manual QA.

## Next-slice notes

- Capture the raw JSON of these responses as committed fixtures when building the `analyzeRepo` seam (issue 03/04) — do it in one batched pass to stay under the 60/hr budget.
- Background worker owns both fetches; surface `x-ratelimit-remaining`/`reset` from the response headers up to the rate-limit state.
