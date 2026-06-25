# 01 — Spike: verify unauthenticated GitHub API data availability

Status: done

> Verdict: **GO** on the 2-call design. Findings: [`../spikes/01-unauthenticated-github-api.md`](../spikes/01-unauthenticated-github-api.md).

## Parent

`.scratch/repo-trust-extension/PRD.md`

## What to build

A time-boxed investigation (not production code) that validates the core assumption the whole 2-call scoring design rests on: that the data needed for the Provenance, Security hygiene, and Transparency dimensions is available from the **unauthenticated** GitHub REST API within the 60-requests/hour budget.

Confirm the field availability and behavior of `GET /repos/{owner}/{repo}` and `GET /repos/{owner}/{repo}/community/profile` when called with no authentication, for public repos. Establish whether `community/profile` honors GitHub's org-default `.github` health-file fallback unauthenticated (the `sindresorhus/got` case). Measure the actual request count for one full analysis against the budget, and inspect the rate-limit response headers (including `X-RateLimit-Reset`).

Produce a short findings note recording: which fields are reliably present, whether the 2-call design holds, and — if `community/profile` is unavailable or unauthenticated-restricted — the concrete fallback (direct content/health-file checks that still resolve the org-default fallback). This note unblocks the analysis slices.

## Acceptance criteria

- [ ] Documented confirmation of which Provenance/Security/Transparency inputs are available unauthenticated from the two endpoints, for public repos.
- [ ] Confirmed whether `community/profile` returns org-default `.github` fallback health files unauthenticated, tested against a repo that relies on it (e.g. `sindresorhus/got`).
- [ ] Measured request count for a single full analysis, stated against the 60/hr budget.
- [ ] Captured the shape of the rate-limit headers, including `X-RateLimit-Reset`.
- [ ] A written go/no-go on the 2-call design, with a named fallback if `community/profile` does not work unauthenticated.
- [ ] Findings recorded in the repo (a short markdown note) so later slices can reference the decision.

## Blocked by

None - can start immediately.
