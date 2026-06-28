import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SCORING_CONFIG,
  SCORING_PRESETS,
  SCORING_PRESET_KEYS,
  type ScoringConfig,
} from '../engine/config'
import {
  additiveWeakens,
  DEFAULT_ADDITIVE,
  DIMENSION_LABELS,
  GUARD_SENSITIVITY_OPTIONS,
  GUARD_SEVERITY_OPTIONS,
  KNOB_GROUPS,
  NUMERIC_BOUNDS,
  NUMERIC_KNOBS,
  PRESET_COPY,
  type NumericKey,
} from './scoringKnobs'

// The knob inventory is UI metadata, but it carries two load-bearing guarantees:
// (1) it must describe EVERY numeric config field (a missing knob = an un-clampable,
// un-editable dial), and (2) its bounds must contain every shipped preset value
// (otherwise resolving a preset would clamp it, silently changing behavior).
describe('scoring knob inventory', () => {
  // The nine numeric keys, derived structurally from the default config (every
  // field whose value is a number) so this list can't fall out of sync by hand.
  const numericConfigKeys = Object.entries(DEFAULT_SCORING_CONFIG)
    .filter(([, v]) => typeof v === 'number')
    .map(([k]) => k as NumericKey)

  it('1. NUMERIC_KNOBS covers exactly the numeric config fields', () => {
    const knobKeys = NUMERIC_KNOBS.map((k) => k.key).sort()
    expect(knobKeys).toEqual([...numericConfigKeys].sort())
  })

  it('2. NUMERIC_BOUNDS mirrors the knob list', () => {
    expect(Object.keys(NUMERIC_BOUNDS).sort()).toEqual(NUMERIC_KNOBS.map((k) => k.key).sort())
    for (const k of NUMERIC_KNOBS) {
      expect(NUMERIC_BOUNDS[k.key]).toEqual({ min: k.min, max: k.max })
      expect(k.min).toBeLessThan(k.max)
    }
  })

  it('3. every shipped preset’s numeric values lie within bounds (no preset is clamped)', () => {
    for (const presetKey of SCORING_PRESET_KEYS) {
      const cfg: ScoringConfig = SCORING_PRESETS[presetKey]
      for (const k of NUMERIC_KNOBS) {
        const v = cfg[k.key]
        expect(v, `${presetKey}.${k.key}`).toBeGreaterThanOrEqual(k.min)
        expect(v, `${presetKey}.${k.key}`).toBeLessThanOrEqual(k.max)
      }
    }
  })

  it('4. enum option lists match the config vocabulary used by the guard', () => {
    expect(GUARD_SENSITIVITY_OPTIONS.map((o) => o.value).sort()).toEqual(
      ['all-3', 'any-2-of-3', 'off'],
    )
    expect(GUARD_SEVERITY_OPTIONS.map((o) => o.value).sort()).toEqual(['caution', 'medium', 'note'])
    // The default guard's enum values must appear among the options (UI can render them).
    expect(GUARD_SENSITIVITY_OPTIONS.some((o) => o.value === DEFAULT_SCORING_CONFIG.manufacturedGuard.sensitivity)).toBe(true)
    expect(GUARD_SEVERITY_OPTIONS.some((o) => o.value === DEFAULT_SCORING_CONFIG.manufacturedGuard.severity)).toBe(true)
  })

  it('5. PRESET_COPY and DIMENSION_LABELS are complete', () => {
    for (const p of SCORING_PRESET_KEYS) expect(PRESET_COPY[p].label).toBeTruthy()
    for (const d of DEFAULT_SCORING_CONFIG.additiveDimensions) expect(DIMENSION_LABELS[d]).toBeTruthy()
  })

  it('6. additiveWeakens: the default additive set does not weaken; a widened set does', () => {
    expect(additiveWeakens(DEFAULT_ADDITIVE)).toBe(false)
    expect(additiveWeakens([])).toBe(false) // all-core is stricter, not weaker
    expect(additiveWeakens(['release', 'provenance'])).toBe(true) // provenance is core by default
  })

  it('7. every numeric knob maps to a declared group, and every group has at least one knob', () => {
    const groupKeys = KNOB_GROUPS.map((g) => g.key)
    for (const k of NUMERIC_KNOBS) {
      expect(groupKeys, `${k.key}.group`).toContain(k.group)
      expect(k.unit, `${k.key}.unit`).toBeTypeOf('string')
      expect(k.higherIsStricter, `${k.key}.higherIsStricter`).toBeTypeOf('boolean')
    }
    // No empty group (an empty section would render a confusing blank disclosure).
    for (const g of KNOB_GROUPS) {
      expect(NUMERIC_KNOBS.some((k) => k.group === g.key), `group ${g.key} has a knob`).toBe(true)
    }
  })
})
