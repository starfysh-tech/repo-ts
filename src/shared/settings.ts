import {
  DIMENSION_KEYS,
  SCORING_PRESET_KEYS,
  SCORING_PRESETS,
  type ScoringConfig,
  type ScoringPreset,
} from '../engine/config'
import {
  GUARD_SENSITIVITY_OPTIONS,
  GUARD_SEVERITY_OPTIONS,
  NUMERIC_BOUNDS,
  type NumericKey,
} from './scoringKnobs'
import type { DimensionKey } from '../engine/types'

// User settings stored locally. An optional GitHub Personal Access Token (PAT)
// used only to raise the unauthenticated REST rate limit (60/hr → 5,000/hr; the
// token is read-only public access and never leaves this device except to
// api.github.com), plus the scoring stance: a named preset and any advanced
// per-knob overrides. The active config = the preset baseline merged with the
// overrides (resolved by `resolveScoringConfig`).
export interface Settings {
  pat?: string
  scoringPreset?: ScoringPreset
  scoringOverrides?: Partial<ScoringConfig>
  /** One-time consent gate for the manual "Known advisories" check. The check is
   *  the first signal to ever leave the device (it calls our backend), so the
   *  first call is gated on an explicit, persisted opt-in. */
  advisoriesConsentGiven?: boolean
}

const KEY = 'settings'

// Validation vocab derived from the canonical sources so the read-time guards
// can never drift from the type/UI. (`as string[]` so `.includes(rawString)`
// type-checks against untrusted storage input.)
const PRESETS = SCORING_PRESET_KEYS as string[]
const GUARD_SENSITIVITIES = GUARD_SENSITIVITY_OPTIONS.map((o) => o.value) as string[]
const GUARD_SEVERITIES = GUARD_SEVERITY_OPTIONS.map((o) => o.value) as string[]

// Serialize every read-modify-write on the settings object. chrome.storage.local
// reads/writes are async, so two writers fired in quick succession (rapid clicks,
// a knob edit landing while a preset switch is in flight) could each read the same
// snapshot and clobber the other's change. Routing all mutations through one queue
// makes each read-modify-write atomic with respect to the others.
let writeQueue: Promise<void> = Promise.resolve()
function mutateSettings(
  mutator: (raw: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const run = writeQueue.then(async () => {
    const raw = await readRaw()
    await chrome.storage.local.set({ [KEY]: mutator(raw) })
  })
  // Keep the chain alive even if one mutation rejects (e.g. a storage-quota error),
  // so a single failure can't wedge every later write behind a rejected promise.
  writeQueue = run.catch(() => {})
  return run
}

/** Extract the validated scoring stance from an already-read raw object (the
 *  scoring half of `getSettings`, without re-reading storage) — so an atomic
 *  mutator can resolve the current config inside the write queue. */
function readSettingsFromRaw(raw: Record<string, unknown>): Settings {
  const settings: Settings = {}
  if (typeof raw.scoringPreset === 'string' && PRESETS.includes(raw.scoringPreset))
    settings.scoringPreset = raw.scoringPreset as ScoringPreset
  if (raw.scoringOverrides && typeof raw.scoringOverrides === 'object')
    settings.scoringOverrides = raw.scoringOverrides as Partial<ScoringConfig>
  return settings
}

/** Read the stored settings, hardened against a corrupted/older-schema value.
 *  Storage is untrusted at read time (could be corrupted, manually edited, or
 *  written by a previous extension version), so reuse the single `readRaw`
 *  guard and only surface `pat` when it is a real non-empty string. */
export async function getSettings(): Promise<Settings> {
  const raw = await readRaw()
  // The scoring stance (preset + raw overrides — `resolveScoringConfig` is the
  // single seam that validates overrides field-by-field) plus the trimmed token.
  const settings = readSettingsFromRaw(raw)
  if (typeof raw.pat === 'string' && raw.pat.trim()) settings.pat = raw.pat.trim()
  if (raw.advisoriesConsentGiven === true) settings.advisoriesConsentGiven = true
  return settings
}

/**
 * The centralized validation seam: resolve stored settings to a COMPLETE, valid
 * `ScoringConfig` before it reaches the engine. The active config is the chosen
 * preset's baseline with any advanced overrides merged on top — but every override
 * is validated field-by-field, falling back to the baseline for anything missing,
 * wrong-typed, or out-of-vocabulary (storage is untrusted: corrupted, hand-edited,
 * or written by another schema version). This keeps the engine free of scattered
 * per-field guards — it always receives a well-formed config.
 *
 * Note: an *explicit* empty `additiveDimensions: []` is a valid advanced choice
 * (make every dimension core) and is honored; only a non-array (missing/corrupt)
 * falls back to the baseline. Numeric overrides are clamped to each knob's bounds
 * (`NUMERIC_BOUNDS`) so a hand-edited out-of-range value can never reach the engine.
 */
export function resolveScoringConfig(settings: Settings): ScoringConfig {
  const baseline = SCORING_PRESETS[settings.scoringPreset ?? 'balanced'] ?? SCORING_PRESETS.balanced
  const o = settings.scoringOverrides
  if (!o || typeof o !== 'object') return baseline

  // A valid finite number is clamped to the knob's [min, max]; anything else
  // falls back to the (in-bounds) baseline. Clamp, not reject, so a UI input that
  // momentarily exceeds a bound still resolves to a usable config.
  const num = (key: NumericKey, v: unknown, fallback: number) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
    const { min, max } = NUMERIC_BOUNDS[key]
    return Math.min(max, Math.max(min, n))
  }

  // Loop over the bounds (the single source of truth for the nine numeric keys)
  // so adding a knob can't leave an override silently un-clamped.
  const numeric = {} as Record<NumericKey, number>
  for (const key of Object.keys(NUMERIC_BOUNDS) as NumericKey[]) {
    numeric[key] = num(key, o[key], baseline[key])
  }

  return {
    ...numeric,
    provenanceGate: typeof o.provenanceGate === 'boolean' ? o.provenanceGate : baseline.provenanceGate,
    manufacturedGuard: resolveGuard(o.manufacturedGuard, baseline.manufacturedGuard),
    additiveDimensions: resolveAdditive(o.additiveDimensions, baseline.additiveDimensions),
  }
}

function resolveGuard(
  v: unknown,
  fallback: ScoringConfig['manufacturedGuard'],
): ScoringConfig['manufacturedGuard'] {
  if (!v || typeof v !== 'object') return fallback
  const g = v as Record<string, unknown>
  const sensitivity = GUARD_SENSITIVITIES.includes(g.sensitivity as string)
    ? (g.sensitivity as ScoringConfig['manufacturedGuard']['sensitivity'])
    : fallback.sensitivity
  const severity = GUARD_SEVERITIES.includes(g.severity as string)
    ? (g.severity as ScoringConfig['manufacturedGuard']['severity'])
    : fallback.severity
  return { sensitivity, severity }
}

function resolveAdditive(v: unknown, fallback: DimensionKey[]): DimensionKey[] {
  // A non-array (missing/corrupt) falls back; a real array is filtered to known
  // keys (an explicit [] — every dimension core — is the user's valid choice).
  if (!Array.isArray(v)) return fallback
  return v.filter((x): x is DimensionKey => DIMENSION_KEYS.includes(x as DimensionKey))
}

/** Select a named preset. Selecting a preset clears any advanced overrides, so the
 *  preset's baseline is exactly what takes effect. */
export async function setScoringPreset(preset: ScoringPreset): Promise<void> {
  await mutateSettings(({ scoringOverrides: _overrides, ...rest }) => ({ ...rest, scoringPreset: preset }))
}

/** Merge advanced per-knob overrides on top of the current stored overrides. */
export async function setScoringOverrides(overrides: Partial<ScoringConfig>): Promise<void> {
  await mutateSettings((raw) => {
    const existing =
      raw.scoringOverrides && typeof raw.scoringOverrides === 'object'
        ? (raw.scoringOverrides as Partial<ScoringConfig>)
        : {}
    return { ...raw, scoringOverrides: { ...existing, ...overrides } }
  })
}

/** Atomically update the advanced overrides from the CURRENT resolved config. The
 *  read, resolve, compute, and write all happen inside the serialized queue, so a
 *  set-shaped edit (an additive toggle, a guard change) that replaces a whole field
 *  computed from the prior value can't be clobbered by a concurrent edit. `compute`
 *  returns the partial override(s) to merge. */
export async function updateScoringOverrides(
  compute: (current: ScoringConfig) => Partial<ScoringConfig>,
): Promise<void> {
  await mutateSettings((raw) => {
    const settings = readSettingsFromRaw(raw)
    const partial = compute(resolveScoringConfig(settings))
    const existing = settings.scoringOverrides ?? {}
    return { ...raw, scoringOverrides: { ...existing, ...partial } }
  })
}

/** Drop a single advanced override, reverting that one knob to the preset
 *  baseline (used when a numeric field is cleared). When the last override goes,
 *  remove the `scoringOverrides` object entirely so the stance reads as un-customized. */
export async function clearScoringOverride(key: keyof ScoringConfig): Promise<void> {
  await mutateSettings((raw) => {
    const o = raw.scoringOverrides
    if (!o || typeof o !== 'object') return raw
    const { [key]: _removed, ...rest } = o as Record<string, unknown>
    if (Object.keys(rest).length === 0) {
      const { scoringOverrides: _drop, ...siblings } = raw
      return siblings
    }
    return { ...raw, scoringOverrides: rest }
  })
}

/** Reset scoring to defaults (Balanced): drop the preset and all overrides,
 *  preserving sibling settings like the PAT. */
export async function resetScoring(): Promise<void> {
  await mutateSettings(({ scoringPreset: _preset, scoringOverrides: _overrides, ...rest }) => rest)
}

/** Raw stored object for read-modify-write. Writers must NOT round-trip through
 *  the hardened getSettings() — that view only exposes `pat`, so doing so would
 *  silently wipe any sibling setting (e.g. a future theme/profile) on every save. */
async function readRaw(): Promise<Record<string, unknown>> {
  const stored = await chrome.storage.local.get(KEY)
  const raw = stored[KEY]
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

/** Store the PAT (trimmed). An empty/whitespace token clears it instead. */
export async function setPat(token: string): Promise<void> {
  const trimmed = token.trim()
  if (!trimmed) return clearPat()
  await mutateSettings((raw) => ({ ...raw, pat: trimmed }))
}

/** Remove the PAT, preserving any other settings. */
export async function clearPat(): Promise<void> {
  await mutateSettings(({ pat: _pat, ...rest }) => rest)
}

/** Persist (or clear) the one-time advisories consent. Routed through the same
 *  serialized queue so it can't clobber a concurrent settings write. */
export async function setAdvisoriesConsentGiven(given: boolean): Promise<void> {
  if (!given) {
    await mutateSettings(({ advisoriesConsentGiven: _drop, ...rest }) => rest)
    return
  }
  await mutateSettings((raw) => ({ ...raw, advisoriesConsentGiven: true }))
}
