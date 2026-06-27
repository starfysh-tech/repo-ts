import { describe, it, expect } from 'vitest'
import { resolveScoringConfig } from './settings'
import { SCORING_PRESETS, DEFAULT_SCORING_CONFIG } from '../engine/config'

// `resolveScoringConfig` is the pure, centralized validation seam: chosen preset
// baseline + validated overrides. These tests exercise it as untrusted-input
// hardening (storage may be corrupt/hand-edited), so bad values are cast with
// `as any` to bypass TS and simulate what could actually land at runtime.
describe('resolveScoringConfig', () => {
  it('1. no preset, no overrides → balanced baseline (DEFAULT_SCORING_CONFIG)', () => {
    expect(resolveScoringConfig({})).toEqual(SCORING_PRESETS.balanced)
    expect(resolveScoringConfig({})).toEqual(DEFAULT_SCORING_CONFIG)
  })

  it('2. cautious preset, no overrides → cautious baseline', () => {
    expect(resolveScoringConfig({ scoringPreset: 'cautious' })).toEqual(SCORING_PRESETS.cautious)
  })

  it('3. minimal preset → minimal baseline', () => {
    expect(resolveScoringConfig({ scoringPreset: 'minimal' })).toEqual(SCORING_PRESETS.minimal)
  })

  it('4. overrides merge on top of the preset baseline', () => {
    const result = resolveScoringConfig({
      scoringPreset: 'cautious',
      scoringOverrides: { veryNewDays: 99 },
    })
    expect(result).toEqual({ ...SCORING_PRESETS.cautious, veryNewDays: 99 })
    expect(result.veryNewDays).toBe(99)
  })

  it('5. invalid numeric override falls back to baseline', () => {
    expect(
      resolveScoringConfig({ scoringOverrides: { veryNewDays: NaN } }).veryNewDays,
    ).toBe(DEFAULT_SCORING_CONFIG.veryNewDays)
    expect(
      resolveScoringConfig({ scoringOverrides: { veryNewDays: 'lots' as any } }).veryNewDays,
    ).toBe(30)
  })

  it('6. invalid guard enum falls back to baseline guard', () => {
    const baselineGuard = DEFAULT_SCORING_CONFIG.manufacturedGuard

    expect(
      resolveScoringConfig({
        scoringOverrides: {
          manufacturedGuard: { sensitivity: 'sometimes', severity: 'loud' } as any,
        },
      }).manufacturedGuard,
    ).toEqual(baselineGuard)

    expect(
      resolveScoringConfig({ scoringOverrides: { manufacturedGuard: {} as any } })
        .manufacturedGuard,
    ).toEqual(baselineGuard)

    // A partial override: valid sensitivity is honored, missing severity falls back.
    expect(
      resolveScoringConfig({
        scoringOverrides: { manufacturedGuard: { sensitivity: 'off' } as any },
      }).manufacturedGuard,
    ).toEqual({ sensitivity: 'off', severity: baselineGuard.severity })
  })

  it('7. additiveDimensions: non-array falls back, [] honored, junk filtered', () => {
    expect(
      resolveScoringConfig({ scoringOverrides: { additiveDimensions: 'x' as any } })
        .additiveDimensions,
    ).toEqual(['release', 'responsiveness'])

    expect(
      resolveScoringConfig({ scoringOverrides: { additiveDimensions: [] } }).additiveDimensions,
    ).toEqual([])

    expect(
      resolveScoringConfig({
        scoringOverrides: { additiveDimensions: ['release', 'bogus'] as any },
      }).additiveDimensions,
    ).toEqual(['release'])
  })

  it('8. provenanceGate: non-boolean falls back, explicit false honored', () => {
    expect(
      resolveScoringConfig({ scoringOverrides: { provenanceGate: 'yes' as any } }).provenanceGate,
    ).toBe(true)

    expect(
      resolveScoringConfig({ scoringOverrides: { provenanceGate: false } }).provenanceGate,
    ).toBe(false)
  })

  it('9. unknown preset string falls back to the balanced baseline', () => {
    expect(resolveScoringConfig({ scoringPreset: 'wat' as any })).toEqual(SCORING_PRESETS.balanced)
  })
})
