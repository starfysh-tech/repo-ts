// User settings stored locally. Currently just an optional GitHub Personal
// Access Token (PAT) used only to raise the unauthenticated REST rate limit
// (60/hr → 5,000/hr). The token is read-only public access and never leaves
// this device except to api.github.com.
export interface Settings {
  pat?: string
}

const KEY = 'settings'

/** Read the stored settings, hardened against a corrupted/older-schema value.
 *  Storage is untrusted at read time (could be corrupted, manually edited, or
 *  written by a previous extension version), so reuse the single `readRaw`
 *  guard and only surface `pat` when it is a real non-empty string. */
export async function getSettings(): Promise<Settings> {
  const pat = (await readRaw()).pat
  // Only surface a usable, trimmed token; otherwise omit the field entirely.
  if (typeof pat === 'string' && pat.trim()) return { pat: pat.trim() }
  return {}
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
