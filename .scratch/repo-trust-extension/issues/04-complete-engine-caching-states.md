# 04 — Complete the engine: Security + Transparency, caching/recency, rate-limit & limited-evidence states

Status: done (pending in-browser dogfood QA)

> All three dimensions now computed from ≤2 REST calls (community profile honoring the org-default `.github` fallback). Confidence is breadth across the three. Thresholds finalized against all 7 archetype fixtures (16 engine tests): react/got strong/high, commander strong/medium, is-number mixed/medium (**never caution**), draft-js caution, hex-to-rgb/test-repo insufficient/low. 24h caching in `chrome.storage.local` (keyed by owner/repo + score_version; fresh revisit = zero API calls; version bump invalidates). Live recency ("Just now" → "Nm/Nh ago" → "Stale" past TTL). Rate-limit state reads `X-RateLimit-Reset`; limited-evidence maps to the "Limited evidence" card. 31 tests total. Live cache round-trip + browser E2E remain manual dogfood.

## What to build

Complete the three-dimension scoring engine and the data lifecycle around it. Extend `analyzeRepo` to make the second REST call (the community profile, honoring GitHub's org-default `.github` fallback per the spike's decision) and compute the **Security hygiene** and **Transparency** dimensions. Confidence now reflects breadth across all three dimensions. Wire all seven archetype fixtures with their finalized expected outcomes and tune the threshold constants against them.

Add the caching and remaining state behavior folded into this slice:
- **Caching:** persist each analysis in `chrome.storage.local` keyed by `owner/repo` + `score_version`, stamped with `analyzed_at`, with a 24-hour TTL; serve cached results instantly with zero API calls within TTL; invalidate when stale or when `score_version` changes.
- **Recency:** the UI shows a live-computed relative freshness state ("just now" → "today" → "1d ago" → "stale — refresh recommended"), not a frozen timestamp.
- **Rate-limit state:** when the unauthenticated limit is hit, show a clean, non-alarmist state that reads `X-RateLimit-Reset` to indicate recovery time.
- **Limited-evidence state:** when a repo does not expose enough public information, present the distinct "limited evidence / review recommended" state rather than a bad score.

The severity posture from the PRD applies: archived = high; missing license = medium; missing security policy / sparse docs / absent releases = low or contextual; missing code of conduct = very low.

## Acceptance criteria

- [ ] All three dimensions (Provenance, Security, Transparency) are computed from at most two REST calls; the four deferred dimensions are not evaluated.
- [ ] `community/profile` results honor the org-default `.github` health-file fallback (e.g. `sindresorhus/got` is not penalized for missing docs).
- [ ] All seven archetype fixtures pass with finalized expectations; **`jonschlinkert/is-number` is asserted to never be `caution`**.
- [ ] Revisiting a repo within 24h serves a cached result and makes zero API calls.
- [ ] Recency is shown as a live relative freshness state and reaches a "stale" state past TTL.
- [ ] Hitting the rate limit shows a clean state indicating recovery time from `X-RateLimit-Reset`.
- [ ] A low-information repo shows the limited-evidence state.

## Blocked by

- 03
