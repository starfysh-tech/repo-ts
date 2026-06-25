# 02 — Walking skeleton: scaffold, page detection, card shows owner/repo

Status: ready-for-agent

## Parent

`.scratch/repo-trust-extension/PRD.md`

## What to build

The end-to-end walking skeleton of the extension: an installable Manifest V3 build that, when loaded unpacked and pointed at a public GitHub repository page, mounts a lightweight in-page card displaying the detected `owner/repo` and a placeholder trust state. This is the tracer bullet that proves every layer wires together before any real analysis exists.

Set up the build toolchain (Vite + CRXJS + TypeScript + Preact) with the MV3 manifest and the four entry points (content script, background service worker, popup page, watchlist page) as stubs where not yet needed. The content script detects supported public repository pages and extracts the repository context via a pure `parseRepoContext` function, which also classifies private and unsupported pages. The card is mounted inside a Shadow DOM root for style isolation. Keep manifest permissions minimal (`storage`, host access to `github.com` and `api.github.com`).

This slice establishes the `parseRepoContext` test seam.

## Acceptance criteria

- [ ] Extension loads unpacked in a Chromium browser with no manifest errors.
- [ ] On a public repo page, a Shadow-DOM card mounts showing the correct `owner/repo` and a placeholder state.
- [ ] On a non-repository GitHub page, the card does not inject broken UI (stays silent or shows unsupported).
- [ ] On a private repository, the context is classified as private/unsupported, not analyzed.
- [ ] `parseRepoContext` is unit-tested against repo, subpage, org, non-GitHub, and private/unsupported URLs.
- [ ] Manifest requests only the minimal permissions agreed in the PRD.

## Blocked by

None - can start immediately.
