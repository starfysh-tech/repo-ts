# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Building the **Repo Trust Extension** — a Manifest V3 (Chromium) browser extension that shows explainable trust signals on public GitHub repo pages. Current scope is a **Phase 1 client-only PoC**: no backend, no cloud enrichment, unauthenticated GitHub REST API only.

- **State:** greenfield — no toolchain or `src/` yet. Planned stack (per the issues): Vite + `@crxjs/vite-plugin` + TypeScript + **Preact**, shadow-DOM in-page UI, `chrome.storage.local`. Scaffold to this, not a different stack.
- **Plan & work:** the PRD and 7 `ready-for-agent` issues live in `.scratch/repo-trust-extension/` (start at its `README.md`). Read the PRD before implementing a feature; deferred scope is in `docs/future-enhancements.md`.
- **Scoring engine** is a pure function tested through an injected-fetch seam against committed per-archetype JSON fixtures — not against the live API.

## Product rules (easy to get wrong)

- **Conservative language only.** Never "safe", "trusted", "verified safe", "dangerous", or "malicious". Use "strong signals", "mixed signals", "caution", "limited evidence".
- **Confidence is separate from trust.** A small/sparse repo is *low confidence*, not *bad*.
- **`caution` fires only on a high-severity flag** (archived/dormant). Broad weakness → `mixed`, never caution. A small, finished, stable utility must never be flagged risky.
- **Show qualitative states, not numeric scores**, to users.

## Agent skills

This repo vendors the [mattpocock/skills](https://github.com/mattpocock/skills) engineering, productivity, and misc skills under `.claude/skills/`. The settings below configure how those skills operate in this repo.

### Issue tracker

Issues and PRDs live as local markdown under `.scratch/<feature>/` (no remote issue tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
