import { useEffect, useState } from 'preact/hooks'
import { mountApp, SURFACE_COLOR, SURFACE_FONT, SURFACE_MUTED } from '../shared/ui'
import { clearPat, getSettings, setPat } from '../shared/settings'

// Page-specific rules only; no shared components needed for this minimal page.
const STYLES = `
  body { margin: 0; font-family: ${SURFACE_FONT}; color: ${SURFACE_COLOR}; background: #f6f8fa; }
  .st { max-width: 560px; margin: 40px auto; padding: 0 16px; }
  .st h1 { font-size: 20px; margin: 0 0 6px; }
  .st__intro { margin: 0 0 18px; font-size: 12px; color: ${SURFACE_MUTED}; }
  .st__card {
    padding: 16px 18px; background: #fff;
    border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;
  }
  .st__label { display: block; font-size: 13px; font-weight: 600; margin: 0 0 8px; }
  .st__row { display: flex; gap: 8px; align-items: center; }
  .st input {
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
  @media (prefers-color-scheme: dark) {
    body { background: #0d1117; color: #e6edf3; }
    .st__intro, .st__status, .st__guidance { color: #9198a1; }
    .st__card { background: #161b22; border-color: rgba(255,255,255,0.1); }
    .st input, .st button { border-color: rgba(255,255,255,0.24); }
    .st__guidance a { color: #4493f8; }
  }
`

// Load state: 'loading' before the first read; 'error' if the read failed (so a
// transient storage hiccup isn't mistaken for "no token"); otherwise the last 4
// chars of a saved token, or '' for none.
type Loaded = 'loading' | 'error' | string

function Settings() {
  const [saved, setSaved] = useState<Loaded>('loading')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  // Never render the full token back; only keep its last 4 for a masked hint.
  const reload = () =>
    getSettings()
      .then((s) => setSaved(s.pat ? s.pat.slice(-4) : ''))
      .catch(() => setSaved('error'))
  useEffect(() => {
    reload()
  }, [])

  // try/finally so a storage-write rejection (quota, torn-down options page)
  // can't leave the buttons permanently disabled with no way to retry.
  const save = async () => {
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
    <main class="st">
      <style>{STYLES}</style>
      <h1>Settings</h1>
      <p class="st__intro">Optional GitHub token to raise the API rate limit.</p>

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
          <div class="st__row">
            <input
              type="password"
              value={draft}
              placeholder="ghp_… or github_pat_…"
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            />
            <button type="button" onClick={save} disabled={busy || !draft.trim()}>
              Save
            </button>
          </div>
        )}

        <div class="st__guidance">
          The token only raises the GitHub API rate limit (60/hr → 5,000/hr). It only needs to read
          public data, so grant <strong>no scopes</strong> (classic token) or read-only public
          access (fine-grained). It is stored locally on this device only and is never sent anywhere
          except api.github.com.
          <ul>
            <li>
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create a token
              </a>
            </li>
            <li>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
              >
                Manage or revoke tokens
              </a>
            </li>
          </ul>
        </div>
      </div>
    </main>
  )
}

mountApp(<Settings />)
