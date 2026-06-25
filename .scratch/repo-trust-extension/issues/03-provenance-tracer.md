# 03 — First analysis tracer: Provenance dimension, real API to real state

Status: done (pending in-browser dogfood QA)

> `analyzeRepo` injected-fetch seam + Provenance scorer landed with 10 fixture-driven tests (incl. the hard `is-number`-never-caution assertion). Content script requests analysis from the worker and renders loading / result / private / rate-limited / retryable-error states in the Shadow-DOM card (icon+text, never color alone). `score_version "0.1.0"`. Live browser E2E is the pending manual dogfood step. Confidence is intentionally low for all repos until Security+Transparency land (issue 04).

## What to build

The first real end-to-end analysis: the content script requests an assessment from the background worker, the worker fetches the core repository object from the unauthenticated GitHub REST API, runs the `analyzeRepo` engine computing **only the Provenance dimension** (license presence/clarity, owner type, archived/dormant, repository age, homepage/topics consistency), and returns a real top-level trust state and confidence that the card renders with its top reasons.

This slice establishes the **primary `analyzeRepo` test seam** with the GitHub fetch dependency injected, and the first committed archetype fixtures. It must implement the deterministic top-level rollup and confidence model from the PRD: `caution` only on a high-severity flag (archived), `insufficient_evidence` on low confidence, confidence driven by evidence breadth, and qualitative states only (no numeric scores shown). Every trust state is conveyed with icon/text, never color alone. Because this is the first real network call, include the **loading** state and a non-alarmist **transient-failure state with retry**.

## Acceptance criteria

- [ ] On a public repo, the card shows a real trust state and confidence derived from live Provenance signals.
- [ ] An archived repo surfaces as `caution`; a healthy licensed repo does not.
- [ ] A repo with low evidence reads as low confidence, not a bad score.
- [ ] `analyzeRepo` is tested through the injected-fetch seam against Provenance fixtures, asserting the full analysis output.
- [ ] Each analysis records `score_version` (`"0.1.0"`).
- [ ] Loading state shows during fetch; a transient failure shows a retry, not a verdict.
- [ ] Trust state is distinguishable without color (icon or label present).

## Blocked by

- 01 (spike confirms unauthenticated fetch shape)
- 02 (walking skeleton)
