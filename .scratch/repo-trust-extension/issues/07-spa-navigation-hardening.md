# 07 — SPA-navigation hardening

Status: ready-for-agent

## What to build

Make the in-page UI robust against GitHub's client-side (Turbo) navigation, so the card always reflects the repository the user is actually viewing. GitHub transitions between repos and subpages without a full page reload, which can otherwise leave a stale card, a card for the wrong repo, or duplicate mounts.

The content script observes route/container changes (History API / navigation events plus a DOM-observer fallback), debounces re-analysis, and **unmounts the stale injected UI before remounting** for the new context. Reaching a now-unsupported or private page after navigation tears the card down cleanly. This is the highest-risk reliability detail in the build and is validated by navigating between repos, into and out of subpages, and onto non-repo pages within a single session.

## Acceptance criteria

- [ ] Navigating from one repo to another client-side updates the card to the newly viewed repo.
- [ ] No duplicate cards mount across navigations; the stale card is unmounted before remounting.
- [ ] Re-analysis is debounced across rapid navigations.
- [ ] Navigating to an unsupported or private page tears the card down cleanly.
- [ ] Returning to a previously analyzed repo within TTL uses the cache (no redundant call).

## Blocked by

- 03 (validated once a real card renders; lifecycle scaffolding from 02)
