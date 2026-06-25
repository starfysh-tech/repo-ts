# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Building the **Repo Trust Extension** — a Manifest V3 (Chromium) browser extension that shows explainable trust signals on public GitHub repo pages. Current scope is a **Phase 1 client-only PoC**: no backend, no cloud enrichment, unauthenticated GitHub REST API only.

- **State:** Phase 1 PoC is **built and feature-complete** (issues 01–07 all merged). Stack: Vite + `@crxjs/vite-plugin` + TypeScript + **Preact**, shadow-DOM in-page card, `chrome.storage.local`. Remaining: finish in-browser dogfood QA; backlog is Phase 2.
- **Plan & work:** the PRD and 7 issues live in `.scratch/repo-trust-extension/` (start at its `README.md`, which tracks current progress). Read the PRD before changing scoring; deferred scope is in `docs/future-enhancements.md`.
- **Scoring engine** is a pure function tested through an injected-fetch seam (`analyzeRepo`) against committed per-archetype JSON fixtures in `src/engine/__fixtures__/` — not the live API. `jonschlinkert/is-number` is asserted to never be `caution` (the load-bearing guardrail).

## Build & test

- `npm run build` — produce the unpacked extension in `dist/` (load via `chrome://extensions` → Developer mode → Load unpacked → `dist/`).
- `npm test` — Vitest (pure seams: `analyzeRepo`, `parseRepoContext`, recency, cache, watchlist, display). `npm run typecheck` — `tsc --noEmit`.
- **Build gotcha:** the content-script and background entry files MUST keep distinct basenames (`content-script.ts` / `service-worker.ts`, not both `index.ts`) — same-named entries collide on the emitted chunk and CRXJS wires the service-worker loader to the wrong one (`window is not defined`). After a build, sanity-check `dist/service-worker-loader.js` imports the chunk with `onMessage`.

## Architecture (pointers)

- `src/content/` — content script: `parseRepoContext` (pure URL classification), `mount.tsx` (single Shadow-DOM host, SPA-nav watch in `content-script.ts`), `card.tsx` (UI states).
- `src/background/service-worker.ts` — owns all fetch/scoring/caching; `cache.ts` (24h TTL keyed by `owner/repo` + `score_version`). `src/engine/` — `analyzeRepo` + the 3 dimension scorers + `githubClient`.
- `src/shared/` — components reused by card + popup (`Headline`, `ConfidenceMeter`, `DimensionRow`, `TrustDetails`), the `display.ts` vocab/accents, `watchlist.ts`, `useWatchToggle`. Each shared UI component exports a co-located CSS string injected into both the card's shadow stylesheet and the popup page stylesheet.

## Product rules (easy to get wrong)

- **Conservative language only.** Never "safe", "trusted", "verified safe", "dangerous", or "malicious". Use "strong signals", "mixed signals", "caution", "limited evidence".
- **Confidence is separate from trust.** A small/sparse repo is *low confidence*, not *bad*.
- **`caution` fires only on a high-severity flag** (archived only — dormancy is contextual and never caution). Broad weakness → `mixed`. A small, finished, stable utility must never be flagged risky.
- **Show qualitative states, not numeric scores**, to users.

## Agent skills

This repo vendors the [mattpocock/skills](https://github.com/mattpocock/skills) engineering, productivity, and misc skills under `.claude/skills/`. The settings below configure how those skills operate in this repo.

### Issue tracker

Issues and PRDs live as local markdown under `.scratch/<feature>/` (no remote issue tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
