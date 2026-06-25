# 05 — Detail drawer: dimensions, rationale, evidence links

Status: ready-for-agent

## What to build

The expandable detail drawer that delivers the product's explainability promise. Activating "View details" on the card opens an in-page drawer (mounted in the same Shadow DOM, not a navigation away) showing the per-dimension breakdown: the three evaluated dimensions (Provenance, Security hygiene, Transparency) each with their state and a short, evidence-first rationale, plus the four deferred dimensions clearly marked "not evaluated in this version."

Each rationale is paired with **evidence deep-links** — constructed URLs derived from `owner/repo` (repo root, license path, security policy / Security tab, README, CONTRIBUTING) — and a link renders only when its underlying signal was actually observed, never pointing at a 404. The drawer is keyboard operable: focus moves predictably into it, Escape closes it, and focus returns to the triggering control on close. Every dimension state is conveyed with icon/text, not color alone, and animation respects `prefers-reduced-motion`.

## Acceptance criteria

- [ ] "View details" opens an in-page drawer without navigating away from the GitHub page.
- [ ] The drawer shows all three evaluated dimensions with state, rationale, and evidence links, plus the four deferred dimensions marked "not evaluated."
- [ ] Evidence links are constructed from `owner/repo`, render only for observed signals, and never resolve to a 404.
- [ ] The drawer is fully keyboard operable; Escape closes it and focus returns to the trigger.
- [ ] Dimension states are distinguishable without color.
- [ ] Drawer motion respects reduced-motion preferences.

## Blocked by

- 04
