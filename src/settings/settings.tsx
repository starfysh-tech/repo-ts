import { useEffect, useMemo, useState } from 'preact/hooks'
import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'
import {
  clearPat,
  getSettings,
  resetScoring,
  resolveScoringConfig,
  setPat,
  setScoringOverrides,
  setScoringPreset,
} from '../shared/settings'
import { DIMENSION_KEYS, SCORING_PRESET_KEYS, type ScoringConfig, type ScoringPreset } from '../engine/config'
import type { DimensionKey } from '../engine/types'
import {
  additiveWeakens,
  DIMENSION_LABELS,
  GUARD_SENSITIVITY_OPTIONS,
  GUARD_SEVERITY_OPTIONS,
  NUMERIC_KNOBS,
  PRESET_COPY,
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
  .sc__adv-intro { font-size: 12px; color: ${SURFACE_MUTED}; margin: 8px 0 14px; line-height: 1.5; }
  .sc__knob { margin: 0 0 16px; }
  .sc__knob-head { display: flex; gap: 8px; align-items: baseline; justify-content: space-between; }
  .sc__knob-label { font-size: 13px; font-weight: 600; }
  .sc__knob input[type=number] { width: 96px; flex: 0 0 auto; text-align: right; }
  .sc__why { font-size: 12px; color: ${SURFACE_MUTED}; line-height: 1.45; margin: 4px 0 0; }
  .sc__select {
    font-size: 13px; padding: 5px 8px; border: 1px solid rgba(0,0,0,0.2);
    border-radius: 6px; background: transparent; color: inherit;
  }
  .sc__check { display: flex; gap: 8px; align-items: center; font-size: 13px; }
  .sc__dims { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-top: 6px; }
  .sc__group { margin: 0 0 18px; }
  .sc__group h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: ${SURFACE_MUTED}; margin: 0 0 10px; }
  .sc__warn { font-size: 12px; color: #9a6700; margin: 4px 0 0; line-height: 1.45; }
  .sc__warn--loud {
    color: #cf222e; font-weight: 600; background: rgba(207,34,46,0.07);
    border: 1px solid rgba(207,34,46,0.3); border-radius: 6px; padding: 8px 10px; margin-top: 6px;
  }
  .sc__reset { margin-top: 8px; }

  @media (prefers-color-scheme: dark) {
    body { background: #0d1117; color: #e6edf3; }
    .st__intro, .st__status, .st__guidance, .sc__sub, .sc__preset-why, .sc__adv-intro, .sc__why, .sc__group h3 { color: #9198a1; }
    .st__card { background: #161b22; border-color: rgba(255,255,255,0.1); }
    .st input, .st button, .sc__select { border-color: rgba(255,255,255,0.24); }
    .st__guidance a { color: #4493f8; }
    .sc__preset { border-color: rgba(255,255,255,0.16); }
    .sc__preset--on { border-color: #4493f8; box-shadow: inset 0 0 0 1px #4493f8; }
    .sc__adv { border-top-color: rgba(255,255,255,0.1); }
    .sc__customized, .sc__warn { color: #d4a72c; }
    .sc__warn--loud { color: #ff7b72; background: rgba(255,123,114,0.1); border-color: rgba(255,123,114,0.35); }
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
  const hasOverrides = Object.keys(overrides).length > 0

  const choosePreset = async (p: ScoringPreset) => {
    await setScoringPreset(p) // clears overrides
    await reload()
  }
  const override = async (partial: Partial<ScoringConfig>) => {
    await setScoringOverrides(partial)
    await reload()
  }
  const reset = async () => {
    await resetScoring()
    await reload()
  }

  const toggleAdditive = (dim: DimensionKey, on: boolean) => {
    const next = on
      ? [...config.additiveDimensions, dim]
      : config.additiveDimensions.filter((d) => d !== dim)
    void override({ additiveDimensions: next })
  }

  if (!loaded) return null

  const gateOff = !config.provenanceGate
  const guardOff = config.manufacturedGuard.sensitivity === 'off'
  const guardCaution = config.manufacturedGuard.severity === 'caution'
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
        <summary>Advanced — every dial</summary>
        <p class="sc__adv-intro">
          Each change saves immediately and applies to the next analysis. Values are bounded; an
          out-of-range entry is clamped. Use <strong>Reset to defaults</strong> to return to
          Balanced.
        </p>

        <div class="sc__group">
          <h3>Thresholds</h3>
          {NUMERIC_KNOBS.map((k) => (
            <div key={k.key} class="sc__knob">
              <div class="sc__knob-head">
                <label class="sc__knob-label" for={`knob-${k.key}`}>
                  {k.label}
                </label>
                <input
                  id={`knob-${k.key}`}
                  type="number"
                  min={k.min}
                  max={k.max}
                  step={k.step}
                  value={config[k.key]}
                  onChange={(e) => {
                    const v = (e.target as HTMLInputElement).valueAsNumber
                    if (Number.isFinite(v)) void override({ [k.key]: v })
                  }}
                />
              </div>
              <p class="sc__why">{k.why}</p>
            </div>
          ))}
        </div>

        <div class="sc__group">
          <h3>Policy</h3>

          <div class="sc__knob">
            <label class="sc__check">
              <input
                type="checkbox"
                checked={config.provenanceGate}
                onChange={(e) => void override({ provenanceGate: (e.target as HTMLInputElement).checked })}
              />
              Require strong provenance to reach “strong signals”
            </label>
            <p class="sc__why">
              On, a newly-created, dormant, or unlicensed-but-active repo can’t earn the top verdict
              on activity alone.
            </p>
            {gateOff && (
              <p class="sc__warn">
                ⚠ Off — a repo can read “strong” on activity alone, without established provenance.
                This weakens the conservative guarantee.
              </p>
            )}
          </div>

          <div class="sc__knob">
            <div class="sc__knob-head">
              <label class="sc__knob-label" for="knob-guard-sens">
                Manufactured-credibility guard
              </label>
              <select
                id="knob-guard-sens"
                class="sc__select"
                value={config.manufacturedGuard.sensitivity}
                onChange={(e) =>
                  void override({
                    manufacturedGuard: {
                      ...config.manufacturedGuard,
                      sensitivity: (e.target as HTMLSelectElement)
                        .value as ScoringConfig['manufacturedGuard']['sensitivity'],
                    },
                  })
                }
              >
                {GUARD_SENSITIVITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <p class="sc__why">
              Flags the “very new yet already fully active” pattern (a fabricated track record). How
              many of the three maturity signals — release, governance, responsiveness — must look
              strong on a very-new repo before it fires.
            </p>
            {guardOff && (
              <p class="sc__warn">
                ⚠ Off — the manufactured-credibility pattern is not flagged at all.
              </p>
            )}
          </div>

          <div class="sc__knob">
            <div class="sc__knob-head">
              <label class="sc__knob-label" for="knob-guard-sev">
                Guard severity
              </label>
              <select
                id="knob-guard-sev"
                class="sc__select"
                value={config.manufacturedGuard.severity}
                onChange={(e) =>
                  void override({
                    manufacturedGuard: {
                      ...config.manufacturedGuard,
                      severity: (e.target as HTMLSelectElement)
                        .value as ScoringConfig['manufacturedGuard']['severity'],
                    },
                  })
                }
              >
                {GUARD_SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <p class="sc__why">How loudly the guard speaks when it fires.</p>
            {guardCaution && (
              <p class="sc__warn sc__warn--loud">
                🔴 “Caution” overrides this tool’s rule that caution fires only on a high-severity
                signal (an archived repo). With this set, the manufactured-credibility pattern alone
                will read as CAUTION — a deliberate, stronger stance you are choosing.
              </p>
            )}
          </div>

          <div class="sc__knob">
            <span class="sc__knob-label">Additive dimensions</span>
            <p class="sc__why">
              An additive dimension can lift the verdict toward strong but never demote it. The rest
              are “core” and can pull a verdict down. Defaults: release and responsiveness.
            </p>
            <div class="sc__dims">
              {DIMENSION_KEYS.map((dim) => (
                <label key={dim} class="sc__check">
                  <input
                    type="checkbox"
                    checked={config.additiveDimensions.includes(dim)}
                    onChange={(e) => toggleAdditive(dim, (e.target as HTMLInputElement).checked)}
                  />
                  {DIMENSION_LABELS[dim]}
                </label>
              ))}
            </div>
            {dimsWeaken && (
              <p class="sc__warn">
                ⚠ A dimension that is core by default is now additive — it can no longer pull a
                verdict down. This weakens the conservative guarantee.
              </p>
            )}
          </div>
        </div>

        <button type="button" class="sc__reset" onClick={() => void reset()} disabled={!hasOverrides && preset === 'balanced'}>
          Reset to defaults
        </button>
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
