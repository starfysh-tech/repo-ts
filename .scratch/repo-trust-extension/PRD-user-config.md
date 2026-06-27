# PRD — User-configurable scoring (presets + advanced overrides)

Status: ready-for-agent

> Goal: expose **all** scoring configuration and policy decisions in the Settings page so a user can modify them — via named **presets** for the default surface, with an **Advanced** disclosure for individual overrides. Decisions are editable too (not just numeric thresholds), bounded and warned, with a global **Reset to defaults**.

## Problem Statement

As a user, I can't see or change how the extension decides a verdict. The thresholds and policy decisions are hardcoded, so I can neither understand *why* a repo scored the way it did nor adapt the tool to my own risk tolerance (stricter for dependencies I'll ship, looser for casual browsing).

## Solution

The Settings page gains a **Scoring** section:
1. A **preset selector** — *Balanced* (the current defaults), *Cautious* (stricter), *Minimal* (lighter-touch) — as the primary, audience-friendly surface.
2. An **Advanced** disclosure exposing every individual knob — numeric thresholds **and** policy decisions — each with a plain-language label, a short "why," a bounded input, and (for policy decisions that weaken the conservative guarantees) an inline **warning**.
3. A **Reset to defaults** that returns everything to *Balanced*.

Changing any value re-scores future analyses (the active config flows into the engine and into the cache key, so verdicts can't go stale against an old config).

## User Stories

1. As a user, I want to pick a Balanced/Cautious/Minimal preset, so that I can set a stance without learning every threshold.
2. As a user, I want an Advanced view of every threshold with plain labels and a "why," so that I understand and can tune individual dials.
3. As a user, I want to edit policy decisions too (the provenance gate, the manufactured-credibility guard's sensitivity, what triggers caution), so that "all decisions" really are mine to change.
4. As a user, I want a warning on any change that makes the tool less conservative (e.g. turning off the provenance gate), so that I'm not silently weakening my own protection.
5. As a user, I want each input bounded to a sane range, so that I can't enter a value that breaks the engine.
6. As a user, I want a one-click Reset to defaults, so that I can always get back to the conservative baseline.
7. As a user, I want my config to take effect on the next analysis without reloading the extension, so that tuning is immediate.
8. As a user, I want a changed config to invalidate stale cached verdicts, so that what I see reflects my current settings.
9. As a user, I want my settings stored only on this device (not synced), so that config sits alongside the PAT under the same local-only privacy posture.
10. As a maintainer, I want the engine to read a `ScoringConfig` object rather than module constants, so that config is injectable and testable at the existing `analyzeRepo` seam.
11. As a maintainer, I want the `is-number`-never-`caution` guardrail asserted against the **default** config, so that defaults stay safe even though advanced edits can deviate.
12. As a maintainer, I want each preset's resulting config covered by a test, so that "Cautious"/"Minimal" can't silently drift.
13. As a user picking Cautious, I want more repos to read MIXED/CAUTION at the margins (higher bars to reach strong), so that the tool errs toward scrutiny.
14. As a user picking Minimal, I want a lighter-touch read (fewer caveats, only high-confidence signals surfaced), so that casual browsing isn't noisy.

## Implementation Decisions

### Slice A — Config seam (prerequisite, no behavior change)
- Introduce a `ScoringConfig` type (a record of every value currently in `src/engine/config.ts` plus the policy decisions below). The existing constants become the `DEFAULT_SCORING_CONFIG`.
- Thread a `config: ScoringConfig` through `analyzeRepo` (add to `AnalyzeDeps`, defaulting to `DEFAULT_SCORING_CONFIG`) and down into every scorer (`provenance`, `security`, `transparency`, `release`, `governance`, `responsiveness`), the gate in `deriveTrustState`, and the manufactured-credibility guard. Scorers stop importing constants and read `config.*`.
- The cache key incorporates a **stable hash of the active config** (alongside `SCORE_VERSION` + owner/repo), so distinct configs don't collide and a config change invalidates prior entries. (`SCORE_VERSION` still bumps when the *shape*/logic changes; the config hash handles *value* changes.)
- This slice is a pure refactor: with `DEFAULT_SCORING_CONFIG`, every committed fixture's verdict is unchanged. A new test passes a non-default config (e.g. `VERY_NEW_DAYS: 0`) and asserts the output shifts, proving the threading.

### The knob inventory (the "all" surface)
- **Numeric thresholds** (bounded): `VERY_NEW_DAYS`, `DORMANT_DAYS`, `ESTABLISHED_DAYS`, `RELEASE_RECENT_DAYS`, `GOV_DISTRIBUTED_MIN`, `GOV_DOMINANT_SHARE`, `RESPONSIVE_RECENT_DAYS`, `RESPONSIVE_ACTIVE_MIN`, `HIGH_CONFIDENCE_THRESHOLD`, `CACHE_TTL_MS`.
- **Policy decisions** (toggles/enums, warned): provenance gate on/off; manufactured-credibility guard sensitivity (off / any-2-of-3 / all-3) and its severity (note / medium / **caution** — the last carries the strongest warning, as it overrides the archived-only rule); which dimensions are additive vs core.
- Each knob declares: key, label, "why" text, control type (number / toggle / enum), bounds or options, default, and a `weakensConservatism` flag that drives the warning.

### Slice B — Presets
- `Balanced` = `DEFAULT_SCORING_CONFIG`. `Cautious` = a partial override raising the bars to reach strong (e.g. larger `ESTABLISHED_DAYS`, larger `GOV_DISTRIBUTED_MIN`, guard sensitivity `any-2-of-3`). `Minimal` = a lighter-touch override (e.g. relax confidence breadth, fewer caveats). **Exact preset values are proposed defaults, tunable during build against the fixtures.**
- Settings (`shared/settings.ts`) stores `{ scoringPreset?: 'balanced'|'cautious'|'minimal', scoringOverrides?: Partial<ScoringConfig> }`. The active config = preset baseline merged with overrides. The service worker resolves it per analysis (same per-analysis read as the PAT).

### Slice C — Advanced UI
- A `Scoring` section in the settings page: preset radio/segmented control, then an `Advanced` disclosure rendering each knob from the inventory (number inputs / toggles / selects), bounded, with inline "why" + warnings on `weakensConservatism` knobs, and a `Reset to defaults` button. Edits write `scoringOverrides`; selecting a preset clears overrides.

### Safety
- All inputs bounded; invalid input is rejected/clamped, never persisted raw.
- `is-number`-never-`caution` and the other guardrail assertions run against `DEFAULT_SCORING_CONFIG` (and SHOULD also hold under each shipped preset — asserted). Only raw advanced edits may deviate, which is the user's explicit, warned choice.
- Config stored in `chrome.storage.local` (not `sync`), consistent with the PAT.

## Testing Decisions

- **What makes a good test:** asserts the externally-observable analysis output for a given (repo, config) — never internal wiring.
- **Seam:** the existing `analyzeRepo` fixture seam, now with `config` injectable. Existing archetype tests run with `DEFAULT_SCORING_CONFIG` and are unchanged.
- **Slice A:** a threading test — same fixture, a non-default config, asserts the verdict/dimension shifts as expected (proves config reaches the scorers + the cache hash changes).
- **Presets:** a pure test that each preset resolves to the expected `ScoringConfig`; and that `is-number` stays never-`caution` under every shipped preset.
- **Settings:** extend `settings.test.ts` for the new fields (get/set/reset, hardened reads, override-merge precedence).
- **Cache:** `cache.test.ts` asserts the key includes the config hash and that two different configs yield different keys.
- No UI render tests (consistent with the current suite).

## Out of Scope

- Per-repo config overrides (config is global).
- Import/export or sharing of config.
- Syncing config across devices.
- Exposing `SCORE_VERSION` itself (it tracks logic/shape, not user values).

## Further Notes

- **Decision log:** exposure = **both** presets + advanced; **policies editable** too (not just thresholds), bounded + warned, with reset; `is-number` guardrail asserted at defaults (and shipped presets).
- The config seam (Slice A) is the long-deferred "profile seam" from the original handoff — landing it unblocks presets, advanced overrides, and any future scoring experimentation.
- Tension to keep visible in copy: this tool is a conservative indicator for non-experts; the Advanced surface must make "you are weakening your own protection" legible, not bury it.
