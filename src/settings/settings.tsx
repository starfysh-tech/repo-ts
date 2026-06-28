import { useEffect, useMemo, useState } from 'preact/hooks'
import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'
import {
  clearPat,
  clearScoringOverride,
  getSettings,
  resetScoring,
  resolveScoringConfig,
  setPat,
  setScoringOverrides,
  setScoringPreset,
  updateScoringOverrides,
} from '../shared/settings'
import { DIMENSION_KEYS, SCORING_PRESET_KEYS, type ScoringConfig, type ScoringPreset } from '../engine/config'
import type { DimensionKey } from '../engine/types'
import {
  additiveWeakens,
  dimensionRole,
  DIMENSION_LABELS,
  GUARD_SENSITIVITY_OPTIONS,
  GUARD_SEVERITY_OPTIONS,
  KNOB_GROUPS,
  NUMERIC_KNOBS,
  PRESET_COPY,
  type NumericKnob,
} from '../shared/scoringKnobs'

const STYLES = `
  body { margin: 0; font-family: ${SURFACE_FONT}; color: ${SURFACE_COLOR}; background: #f6f8fa; }
  .st { max-width: 560px; margin: 40px auto; padding: 0 16px; }
  .st h1 { font-size: 20px; margin: 0 0 6px; }
  .st h2 { font-size: 15px; margin: 0 0 4px; }
  .st__intro { margin: 0 0 18px; font-size: 12px; color: ${SURFACE_MUTED}; }
  .st__card {
    padding: 16px 18px; background: #fff;
    border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;
  }
  .st__card + .st__card { margin-top: 18px; }
  .st__label { display: block; font-size: 13px; font-weight: 600; margin: 0 0 8px; }
  .st__row { display: flex; gap: 8px; align-items: center; }
  .st input[type=text], .st input[type=password], .st input[type=number] {
    flex: 1; font-size: 13px; padding: 6px 10px;
    border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit;
  }
  .st button {
    font-size: 12px; padding: 6px 12px; cursor: pointer;
    border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit;
  }
  .st button:disabled { cursor: default; opacity: 0.6; }
  .st__saved { display: flex; align-items: center; gap: 10px; }
  .st__masked { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 13px; }
  .st__status { font-size: 12px; color: ${SURFACE_MUTED}; margin: 0 0 10px; }
  .st__guidance { margin: 16px 0 0; font-size: 12px; line-height: 1.5; color: ${SURFACE_MUTED}; }
  .st__guidance ul { margin: 6px 0 0; padding-left: 18px; }
  .st__guidance a { color: #0969da; }

  /* Scoring section */
  .sc__sub { margin: 0 0 14px; font-size: 12px; color: ${SURFACE_MUTED}; line-height: 1.5; }
  .sc__presets { display: flex; flex-direction: column; gap: 8px; }
  .sc__preset {
    display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px;
    border: 1px solid rgba(0,0,0,0.14); border-radius: 8px; cursor: pointer;
  }
  .sc__preset--on { border-color: #0969da; box-shadow: inset 0 0 0 1px #0969da; }
  .sc__preset input { margin-top: 2px; }
  .sc__preset-name { font-size: 13px; font-weight: 600; }
  .sc__preset-why { font-size: 12px; color: ${SURFACE_MUTED}; line-height: 1.45; margin-top: 2px; }
  .sc__customized { font-size: 12px; color: #9a6700; margin: 12px 0 0; }

  .sc__adv { margin-top: 16px; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 12px; }
  .sc__adv > summary {
    cursor: pointer; font-size: 13px; font-weight: 600; list-style: revert;
  }
  .sc__adv-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin: 8px 0 14px; }
  .sc__adv-intro { font-size: 12px; color: ${SURFACE_MUTED}; line-height: 1.5; margin: 0; }
  .sc__reset-all {
    font-size: 12px; padding: 5px 10px; border: 1px solid rgba(0,0,0,0.2); border-radius: 6px;
    background: transparent; color: inherit; cursor: pointer; white-space: nowrap; flex: 0 0 auto;
  }
  .sc__reset-all:disabled { opacity: 0.5; cursor: default; }
  .sc__why { font-size: 12px; color: ${SURFACE_MUTED}; line-height: 1.45; margin: 4px 0 0; }
  .sc__select {
    font-size: 13px; padding: 5px 8px; border: 1px solid rgba(0,0,0,0.2);
    border-radius: 6px; background: transparent; color: inherit;
  }
  .sc__check { display: flex; gap: 8px; align-items: center; font-size: 13px; }
  .sc__warn { font-size: 12px; color: #9a6700; margin: 6px 0 0; line-height: 1.45; }
  .sc__warn--loud {
    color: #cf222e; font-weight: 600; background: rgba(207,34,46,0.07);
    border: 1px solid rgba(207,34,46,0.3); border-radius: 6px; padding: 8px 10px; margin-top: 6px;
  }

  /* Collapsible threshold groups */
  .sc__grp { border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; margin: 0 0 10px; overflow: hidden; }
  .sc__grp-sum { cursor: pointer; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; list-style: revert; }
  .sc__grp[open] .sc__grp-sum { background: rgba(0,0,0,0.02); border-bottom: 1px solid rgba(0,0,0,0.06); }
  .sc__grp-name { font-size: 13px; font-weight: 600; }
  .sc__grp-why { font-size: 11px; color: ${SURFACE_MUTED}; line-height: 1.4; }
  .sc__policy { padding: 12px; border-top: 1px solid rgba(0,0,0,0.05); }
  .sc__field { display: flex; flex-direction: column; gap: 4px; margin: 0 0 6px; }
  .sc__field-label { font-size: 13px; font-weight: 600; }
  .sc__field .sc__select { width: 100%; box-sizing: border-box; }

  /* One threshold dial (slider + number) */
  .kn { padding: 12px; }
  .kn + .kn { border-top: 1px solid rgba(0,0,0,0.05); }
  .kn--custom { background: rgba(9,105,218,0.05); }
  .kn__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .kn__label { font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .kn__dot { width: 7px; height: 7px; border-radius: 50%; background: #0969da; display: inline-block; }
  .kn__reset {
    font-size: 11px; padding: 2px 7px; border: 1px solid rgba(0,0,0,0.2); border-radius: 5px;
    background: transparent; color: inherit; cursor: pointer;
  }
  .kn__controls { display: flex; align-items: center; gap: 10px; margin: 9px 0 3px; }
  .kn__slider { flex: 1; min-width: 0; accent-color: #0969da; }
  .kn__num {
    width: 70px; flex: 0 0 auto; text-align: right; font-size: 13px; padding: 5px 8px;
    border: 1px solid rgba(0,0,0,0.25); border-radius: 6px; background: transparent; color: inherit;
  }
  .kn__unit { font-size: 12px; color: ${SURFACE_MUTED}; min-width: 46px; }
  .kn__scale { display: flex; justify-content: space-between; font-size: 10px; color: ${SURFACE_MUTED}; }
  .kn__dir { font-style: italic; }

  /* Dimension roles (additive reframed) — a positive toggle: on = can lower */
  .sc__role-intro { padding: 0 12px; margin: 10px 0 2px; }
  .sc__role { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
  .sc__role + .sc__role { border-top: 1px solid rgba(0,0,0,0.05); }
  .sc__role-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sc__role-name { font-size: 13px; font-weight: 600; }
  .sc__role-impact { font-size: 11px; color: ${SURFACE_MUTED}; line-height: 1.4; margin: 0; }
  .sc__switch { position: relative; display: inline-flex; flex: 0 0 auto; cursor: pointer; }
  .sc__switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
  .sc__switch-track {
    width: 38px; height: 22px; border-radius: 11px; background: rgba(0,0,0,0.25);
    position: relative; transition: background 0.15s;
  }
  .sc__switch-thumb {
    position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.3); transition: transform 0.15s;
  }
  .sc__switch input:checked + .sc__switch-track { background: #0969da; }
  .sc__switch input:checked + .sc__switch-track .sc__switch-thumb { transform: translateX(16px); }
  .sc__switch input:focus-visible + .sc__switch-track { outline: 2px solid #0969da; outline-offset: 2px; }

  @media (prefers-color-scheme: dark) {
    body { background: #0d1117; color: #e6edf3; }
    .st__intro, .st__status, .st__guidance, .sc__sub, .sc__preset-why, .sc__adv-intro, .sc__why,
    .sc__grp-why, .kn__unit, .kn__scale, .sc__role-impact { color: #9198a1; }
    .st__card { background: #161b22; border-color: rgba(255,255,255,0.1); }
    .st input, .st button, .sc__select, .kn__num, .kn__reset, .sc__reset-all { border-color: rgba(255,255,255,0.24); }
    .st__guidance a { color: #4493f8; }
    .sc__preset { border-color: rgba(255,255,255,0.16); }
    .sc__preset--on { border-color: #4493f8; box-shadow: inset 0 0 0 1px #4493f8; }
    .sc__adv { border-top-color: rgba(255,255,255,0.1); }
    .sc__customized, .sc__warn { color: #d4a72c; }
    .sc__warn--loud { color: #ff7b72; background: rgba(255,123,114,0.1); border-color: rgba(255,123,114,0.35); }
    .sc__grp { border-color: rgba(255,255,255,0.1); }
    .sc__grp[open] .sc__grp-sum { background: rgba(255,255,255,0.03); border-bottom-color: rgba(255,255,255,0.08); }
    .kn + .kn, .sc__role + .sc__role, .sc__policy { border-top-color: rgba(255,255,255,0.07); }
    .kn--custom { background: rgba(68,147,248,0.09); }
    .kn__dot { background: #1f6feb; }
    .kn__slider { accent-color: #4493f8; }
    .sc__switch-track { background: rgba(255,255,255,0.2); }
    .sc__switch input:checked + .sc__switch-track { background: #1f6feb; }
  }
`

// ── PAT card (unchanged behavior) ──────────────────────────────────────────
type Loaded = 'loading' | 'error' | string

function PatCard() {
  const [saved, setSaved] = useState<Loaded>('loading')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () =>
    getSettings()
      .then((s) => setSaved(s.pat ? s.pat.slice(-4) : ''))
      .catch(() => setSaved('error'))
  useEffect(() => {
    reload()
  }, [])

  const save = async (e?: Event) => {
    e?.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await setPat(trimmed)
      setDraft('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await clearPat()
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="st__card">
      <span class="st__label">GitHub Personal Access Token</span>
      {saved === 'loading' ? null : saved === 'error' ? (
        <p class="st__status">Couldn’t read saved settings. Reload the page to try again.</p>
      ) : saved ? (
        <>
          <p class="st__status">Token saved on this device.</p>
          <div class="st__saved">
            <span class="st__masked">••••{saved}</span>
            <button type="button" onClick={remove} disabled={busy}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <form class="st__row" onSubmit={save}>
          <input
            type="password"
            value={draft}
            placeholder="ghp_… or github_pat_…"
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          />
          <button type="submit" disabled={busy || !draft.trim()}>
            Save
          </button>
        </form>
      )}

      <div class="st__guidance">
        The token only raises the GitHub API rate limit (60/hr → 5,000/hr). It only needs to read
        public data, so grant <strong>no scopes</strong> (classic token) or read-only public access
        (fine-grained). It is stored locally on this device only and is never sent anywhere except
        api.github.com.
        <ul>
          <li>
            <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer">
              Create a token
            </a>
          </li>
          <li>
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
              Manage or revoke tokens
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}

// One threshold dial: a slider (affordance + range + direction) paired with a
// precise number field, a value/unit readout, a "changed from default" dot, and a
// per-dial reset. The slider makes the row obviously interactive; the number field
// allows exact entry. Both commit the clamped value.
function KnobRow({
  knob,
  value,
  baseline,
  onCommit,
  onReset,
}: {
  knob: NumericKnob
  value: number
  baseline: number
  onCommit: (v: number) => void
  onReset: () => void
}) {
  // Local draft so dragging the slider / typing in the field updates the readout
  // live (onInput), while the storage write happens once on commit (onChange:
  // slider release or field blur). Re-syncs whenever the resolved value changes.
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const custom = value !== baseline
  const id = `knob-${knob.key}`
  const clamp = (v: number) => Math.min(knob.max, Math.max(knob.min, v))
  return (
    <div class={`kn${custom ? ' kn--custom' : ''}`}>
      <div class="kn__head">
        <label class="kn__label" for={id}>
          {knob.label}
          {custom && <span class="kn__dot" title="Changed from this preset's default" aria-hidden="true" />}
        </label>
        {custom && (
          <button type="button" class="kn__reset" title={`Reset to ${baseline}`} onClick={onReset}>
            ↺ reset
          </button>
        )}
      </div>
      <div class="kn__controls">
        <input
          class="kn__slider"
          id={id}
          type="range"
          min={knob.min}
          max={knob.max}
          step={knob.step}
          value={draft}
          onInput={(e) => setDraft(clamp((e.target as HTMLInputElement).valueAsNumber))}
          onChange={(e) => onCommit(clamp((e.target as HTMLInputElement).valueAsNumber))}
        />
        <input
          class="kn__num"
          type="number"
          aria-label={`${knob.label} value`}
          min={knob.min}
          max={knob.max}
          step={knob.step}
          value={draft}
          // Track raw input live (no clamp mid-type, so e.g. "150" doesn't snap to
          // the min on the first digit); clamp + commit only on blur/Enter.
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).valueAsNumber
            if (Number.isFinite(v)) setDraft(v)
          }}
          onChange={(e) => {
            const el = e.target as HTMLInputElement
            if (el.value.trim() === '') return onReset()
            if (Number.isFinite(el.valueAsNumber)) onCommit(clamp(el.valueAsNumber))
          }}
        />
        {knob.unit && <span class="kn__unit">{knob.unit}</span>}
      </div>
      <div class="kn__scale">
        <span>{knob.min}</span>
        <span class="kn__dir">{knob.higherIsStricter ? 'raise → stricter' : 'raise → looser'}</span>
        <span>{knob.max}</span>
      </div>
      <p class="sc__why">{knob.why}</p>
    </div>
  )
}

// ── Scoring card ────────────────────────────────────────────────────────────
function ScoringCard() {
  // The stored stance, kept verbatim so we can show "customized" and so a preset
  // switch / reset clears overrides exactly. The displayed knob values come from
  // the RESOLVED config (preset baseline + clamped overrides), so what the user
  // sees is precisely what the engine will use.
  const [loaded, setLoaded] = useState(false)
  const [preset, setPreset] = useState<ScoringPreset>('balanced')
  const [overrides, setOverrides] = useState<Partial<ScoringConfig>>({})

  const reload = () =>
    getSettings()
      .then((s) => {
        setPreset(s.scoringPreset ?? 'balanced')
        setOverrides(s.scoringOverrides ?? {})
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  useEffect(() => {
    reload()
  }, [])

  const config = useMemo(
    () => resolveScoringConfig({ scoringPreset: preset, scoringOverrides: overrides }),
    [preset, overrides],
  )
  // The chosen preset's values with NO overrides — what each dial reverts to, and
  // the baseline a "changed from default" diff highlights against.
  const baseline = useMemo(() => resolveScoringConfig({ scoringPreset: preset }), [preset])
  const hasOverrides = Object.keys(overrides).length > 0

  const choosePreset = async (p: ScoringPreset) => {
    await setScoringPreset(p) // clears overrides
    await reload()
  }
  const override = async (partial: Partial<ScoringConfig>) => {
    await setScoringOverrides(partial)
    await reload()
  }
  const clearKnob = async (key: keyof ScoringConfig) => {
    await clearScoringOverride(key)
    await reload()
  }
  const reset = async () => {
    await resetScoring()
    await reload()
  }

  // Set-shaped knob edits (additive toggles, guard selects) replace a whole field
  // computed from its prior value, so they go through updateScoringOverrides — which
  // reads-resolves-computes-writes atomically inside the settings write queue. Two
  // rapid clicks can't read the same snapshot and clobber each other.
  const updateOverrides = async (compute: (current: ScoringConfig) => Partial<ScoringConfig>) => {
    await updateScoringOverrides(compute)
    await reload()
  }
  const toggleAdditive = (dim: DimensionKey, on: boolean) =>
    void updateOverrides((current) => {
      const set = current.additiveDimensions
      return { additiveDimensions: on ? [...set, dim] : set.filter((d) => d !== dim) }
    })
  const setGuard = (patch: Partial<ScoringConfig['manufacturedGuard']>) =>
    void updateOverrides((current) => ({
      manufacturedGuard: { ...current.manufacturedGuard, ...patch },
    }))

  if (!loaded) return null

  // Warnings derive from the option descriptors (the single source of truth for
  // "which choice weakens conservatism"), so the UI can't drift from the metadata.
  const gateOff = !config.provenanceGate
  const guardOff =
    GUARD_SENSITIVITY_OPTIONS.find((o) => o.value === config.manufacturedGuard.sensitivity)
      ?.weakens ?? false
  const guardCaution =
    GUARD_SEVERITY_OPTIONS.find((o) => o.value === config.manufacturedGuard.severity)?.emphasis ===
    'caution'
  const dimsWeaken = additiveWeakens(config.additiveDimensions)

  return (
    <div class="st__card">
      <h2>Scoring</h2>
      <p class="sc__sub">
        How the extension weighs the signals. Pick a stance, or open Advanced to tune individual
        dials. These are maintenance signals, not a safety review — loosening them widens what reads
        as “strong”.
      </p>

      <div class="sc__presets">
        {SCORING_PRESET_KEYS.map((p) => (
          <label key={p} class={`sc__preset${preset === p ? ' sc__preset--on' : ''}`}>
            <input
              type="radio"
              name="sc-preset"
              checked={preset === p}
              onChange={() => void choosePreset(p)}
            />
            <span>
              <span class="sc__preset-name">{PRESET_COPY[p].label}</span>
              <span class="sc__preset-why">{PRESET_COPY[p].why}</span>
            </span>
          </label>
        ))}
      </div>

      {hasOverrides && (
        <p class="sc__customized">
          Customized — advanced overrides are layered on the {PRESET_COPY[preset].label} preset.
          Selecting a preset above clears them.
        </p>
      )}

      <details class="sc__adv">
        <summary>Advanced — tune individual dials</summary>
        <div class="sc__adv-top">
          <p class="sc__adv-intro">
            Grouped by what each dial affects. Changes save immediately. A changed value shows a dot
            and its own reset.
          </p>
          <button
            type="button"
            class="sc__reset-all"
            onClick={() => void reset()}
            disabled={!hasOverrides && preset === 'balanced'}
          >
            ↺ Reset all to defaults
          </button>
        </div>

        {/* Threshold groups, one collapsible section per area (the verdict's own
            structure), so the user opens the dimension they care about. */}
        {KNOB_GROUPS.map((g) => (
          <details key={g.key} class="sc__grp" open>
            <summary class="sc__grp-sum">
              <span class="sc__grp-name">{g.label}</span>
              <span class="sc__grp-why">{g.why}</span>
            </summary>
            {NUMERIC_KNOBS.filter((k) => k.group === g.key).map((k) => (
              <KnobRow
                key={k.key}
                knob={k}
                value={config[k.key]}
                baseline={baseline[k.key]}
                onCommit={(v) => void override({ [k.key]: v })}
                onReset={() => void clearKnob(k.key)}
              />
            ))}
            {/* The provenance gate is a provenance-area policy, so it lives here. */}
            {g.key === 'provenance' && (
              <div class="sc__policy">
                <label class="sc__check">
                  <input
                    type="checkbox"
                    checked={config.provenanceGate}
                    onChange={(e) => void override({ provenanceGate: (e.target as HTMLInputElement).checked })}
                  />
                  Require strong provenance to reach “strong signals”
                </label>
                <p class="sc__why">
                  On, a newly-created, dormant, or unlicensed-but-active repo can’t earn the top
                  verdict on activity alone.
                </p>
                {gateOff && (
                  <p class="sc__warn">
                    ⚠ Off — a repo can read “strong” on activity alone, without established
                    provenance. This weakens the conservative guarantee.
                  </p>
                )}
              </div>
            )}
          </details>
        ))}

        {/* Manufactured-credibility guard */}
        <details class="sc__grp" open>
          <summary class="sc__grp-sum">
            <span class="sc__grp-name">Manufactured-credibility guard</span>
            <span class="sc__grp-why">Flags a very-new repo that already looks fully active.</span>
          </summary>
          <div class="sc__policy">
            <label class="sc__field">
              <span class="sc__field-label">Fires when this many maturity signals look strong</span>
              <select
                class="sc__select"
                value={config.manufacturedGuard.sensitivity}
                onChange={(e) =>
                  void setGuard({
                    sensitivity: (e.target as HTMLSelectElement)
                      .value as ScoringConfig['manufacturedGuard']['sensitivity'],
                  })
                }
              >
                {GUARD_SENSITIVITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <p class="sc__why">
              The pattern of a fabricated track record: a very-new repo already strong on release,
              governance, and responsiveness.
            </p>
            {guardOff && <p class="sc__warn">⚠ Off — the manufactured-credibility pattern is not flagged at all.</p>}

            <label class="sc__field">
              <span class="sc__field-label">How loudly it speaks when it fires</span>
              <select
                class="sc__select"
                value={config.manufacturedGuard.severity}
                onChange={(e) =>
                  void setGuard({
                    severity: (e.target as HTMLSelectElement)
                      .value as ScoringConfig['manufacturedGuard']['severity'],
                  })
                }
              >
                {GUARD_SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {guardCaution && (
              <p class="sc__warn sc__warn--loud">
                🔴 “Caution” overrides this tool’s rule that caution fires only on a high-severity
                signal (an archived repo). With this set, the manufactured-credibility pattern alone
                will read as CAUTION — a deliberate, stronger stance you are choosing.
              </p>
            )}
          </div>
        </details>

        {/* Dimension roles — the old "additive vs core" reframed as plain outcomes. */}
        <details class="sc__grp" open>
          <summary class="sc__grp-sum">
            <span class="sc__grp-name">What each dimension can do</span>
            <span class="sc__grp-why">Whether a weak result in an area can pull the verdict down.</span>
          </summary>
          <p class="sc__why sc__role-intro">On = this area can pull a verdict down (full weight). Off = lift-only.</p>
          {DIMENSION_KEYS.map((dim) => {
            const liftOnly = config.additiveDimensions.includes(dim)
            const role = dimensionRole(liftOnly)
            return (
              <div key={dim} class="sc__role">
                <div class="sc__role-body">
                  <span class="sc__role-name">{DIMENSION_LABELS[dim]}</span>
                  <span class="sc__role-impact">
                    {role.label} — {role.impact}.
                  </span>
                </div>
                <label class="sc__switch">
                  <input
                    type="checkbox"
                    checked={!liftOnly}
                    aria-label={`${DIMENSION_LABELS[dim]} can lower the verdict`}
                    onChange={(e) => void toggleAdditive(dim, !(e.target as HTMLInputElement).checked)}
                  />
                  <span class="sc__switch-track" aria-hidden="true">
                    <span class="sc__switch-thumb" />
                  </span>
                </label>
              </div>
            )
          })}
          {dimsWeaken && (
            <p class="sc__warn">
              ⚠ A dimension that can lower a verdict by default is now lift-only — it can no longer
              pull a verdict down. This weakens the conservative guarantee.
            </p>
          )}
        </details>
      </details>
    </div>
  )
}

function Settings() {
  return (
    <main class="st">
      <style>{STYLES}</style>
      <h1>Settings</h1>
      <p class="st__intro">Optional GitHub token, and how the extension scores repos.</p>
      <PatCard />
      <ScoringCard />
    </main>
  )
}

mountApp(<Settings />)
