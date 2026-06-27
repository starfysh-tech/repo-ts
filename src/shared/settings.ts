import {
  DIMENSION_KEYS,
  SCORING_PRESETS,
  type ScoringConfig,
  type ScoringPreset,
} from '../engine/config'
import { NUMERIC_BOUNDS, type NumericKey } from './scoringKnobs'
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
}

const KEY = 'settings'

const PRESETS: ScoringPreset[] = ['balanced', 'cautious', 'minimal']
const GUARD_SENSITIVITIES = ['off', 'any-2-of-3', 'all-3']
const GUARD_SEVERITIES = ['note', 'medium', 'caution']

/** Read the stored settings, hardened against a corrupted/older-schema value.
 *  Storage is untrusted at read time (could be corrupted, manually edited, or
 *  written by a previous extension version), so reuse the single `readRaw`
 *  guard and only surface `pat` when it is a real non-empty string. */
export async function getSettings(): Promise<Settings> {
  const raw = await readRaw()
  const settings: Settings = {}
  // Only surface a usable, trimmed token; otherwise omit the field entirely.
  if (typeof raw.pat === 'string' && raw.pat.trim()) settings.pat = raw.pat.trim()
  if (typeof raw.scoringPreset === 'string' && (PRESETS as string[]).includes(raw.scoringPreset))
    settings.scoringPreset = raw.scoringPreset as ScoringPreset
  // Overrides stay raw here — `resolveScoringConfig` is the single seam that
  // validates them field-by-field, so a corrupted/older-schema object can't reach
  // the engine.
  if (raw.scoringOverrides && typeof raw.scoringOverrides === 'object')
    settings.scoringOverrides = raw.scoringOverrides as Partial<ScoringConfig>
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

  return {
    veryNewDays: num('veryNewDays', o.veryNewDays, baseline.veryNewDays),
    dormantDays: num('dormantDays', o.dormantDays, baseline.dormantDays),
    establishedDays: num('establishedDays', o.establishedDays, baseline.establishedDays),
    releaseRecentDays: num('releaseRecentDays', o.releaseRecentDays, baseline.releaseRecentDays),
    govDistributedMin: num('govDistributedMin', o.govDistributedMin, baseline.govDistributedMin),
    govDominantShare: num('govDominantShare', o.govDominantShare, baseline.govDominantShare),
    responsiveRecentDays: num(
      'responsiveRecentDays',
      o.responsiveRecentDays,
      baseline.responsiveRecentDays,
    ),
    responsiveActiveMin: num('responsiveActiveMin', o.responsiveActiveMin, baseline.responsiveActiveMin),
    highConfidenceThreshold: num(
      'highConfidenceThreshold',
      o.highConfidenceThreshold,
      baseline.highConfidenceThreshold,
    ),
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
  const { scoringOverrides: _overrides, ...rest } = await readRaw()
  await chrome.storage.local.set({ [KEY]: { ...rest, scoringPreset: preset } })
}

/** Merge advanced per-knob overrides on top of the current stored overrides. */
export async function setScoringOverrides(overrides: Partial<ScoringConfig>): Promise<void> {
  const raw = await readRaw()
  const existing =
    raw.scoringOverrides && typeof raw.scoringOverrides === 'object'
      ? (raw.scoringOverrides as Partial<ScoringConfig>)
      : {}
  await chrome.storage.local.set({ [KEY]: { ...raw, scoringOverrides: { ...existing, ...overrides } } })
}

/** Reset scoring to defaults (Balanced): drop the preset and all overrides,
 *  preserving sibling settings like the PAT. */
export async function resetScoring(): Promise<void> {
  const { scoringPreset: _preset, scoringOverrides: _overrides, ...rest } = await readRaw()
  await chrome.storage.local.set({ [KEY]: rest })
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
  const raw = await readRaw()
  await chrome.storage.local.set({ [KEY]: { ...raw, pat: trimmed } })
}

/** Remove the PAT, preserving any other settings. */
export async function clearPat(): Promise<void> {
  const { pat: _pat, ...rest } = await readRaw()
  await chrome.storage.local.set({ [KEY]: rest })
}
