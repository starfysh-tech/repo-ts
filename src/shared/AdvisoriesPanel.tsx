import { useEffect, useState } from 'preact/hooks'
import type { SupportedRepo } from '../content/parseRepoContext'
import type { AdvisoriesResult, Advisory, AdvisorySeverity } from '../engine/advisoriesClient'
import { requestCheckAdvisories } from './messages'
import { readAdvisoriesCache } from '../background/advisoriesCache'
import { getSettings, setAdvisoriesConsentGiven } from './settings'

// The manual, opt-in "Known advisories" check. A SEPARATE panel (sibling of
// PackageSourceAction, NOT inside TrustDetails): advisories are a point-in-time
// security-DATA axis, not a maintenance dimension, so they never touch the verdict.
//
// Conservative language only: an empty result and a backend failure both read as
// non-events — never "safe"/"secure" and never an alarm. The first-ever check is
// gated behind a one-time, persisted consent because it is the first signal this
// extension sends off the device.

// Exported copy constants so the (no-DOM) copy test can assert the language
// without rendering. These are the user-facing strings the linter cares about.
export const CONSENT_BODY =
  "Checking sends only this repo's public owner/name to the Repo Trust backend — the first data this extension sends off your device. Nothing else is sent."
export const EMPTY_COPY = 'No known advisories found'
export const EMPTY_SUBNOTE =
  'Only resolved dependencies were checked, and only against known advisories — a point-in-time result, not a full audit.'
export const NO_DEP_COPY = 'No resolvable dependency graph to check.'
export const UNAVAILABLE_COPY = "Couldn't check right now — try again."

const SEVERITY_ORDER: readonly AdvisorySeverity[] = ['critical', 'high', 'medium', 'low']

/** Count advisories by severity, highest-first, dropping zero buckets. */
function severityCounts(advisories: Advisory[]): { severity: AdvisorySeverity; count: number }[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    count: advisories.filter((a) => a.severity === severity).length,
  })).filter((b) => b.count > 0)
}

/** Pure, testable headline for an `ok` result. For zero advisories it returns the
 *  empty-state copy (with `asOf` when present); otherwise a count summary like
 *  "3 known advisories across 142 dependencies — 1 critical, 2 high". */
export function advisoriesHeadline(result: Extract<AdvisoriesResult, { status: 'ok' }>): string {
  const { advisories, scanned } = result
  // Name the scanned count so a clean result reads as work done, not a no-op. The
  // "as of" time is shown by the re-check footer, not duplicated here.
  const depNoun = scanned === 1 ? 'dependency' : 'dependencies'
  if (advisories.length === 0) {
    return `${EMPTY_COPY} across ${scanned} ${depNoun}.`
  }
  const breakdown = severityCounts(advisories)
    .map(({ severity, count }) => `${count} ${severity}`)
    .join(', ')
  const noun = advisories.length === 1 ? 'advisory' : 'advisories'
  return `${advisories.length} known ${noun} across ${scanned} ${depNoun} — ${breakdown}`
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/** How fresh the advisory list is, relative to `now`: "just now" under an hour,
 *  then "Nh ago", then "Nd ago" through 3 days, then an absolute date (no time)
 *  once older than 3 days. '' for an absent or unparseable `asOf`. */
export function pulledLabel(asOf: string, now: Date): string {
  if (!asOf) return ''
  const t = new Date(asOf).getTime()
  if (Number.isNaN(t)) return ''
  const ms = now.getTime() - t
  if (ms < HOUR_MS) return 'just now'
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)}h ago`
  const days = Math.floor(ms / DAY_MS)
  if (days <= 3) return `${days}d ago`
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Co-located styles (see ConfidenceMeter for the rationale). Classes prefixed
// `.advisories`; mirrors PackageSourceAction's palette.
export const advisoriesPanelStyles = `
  .advisories { margin: 10px 0 0; }
  .advisories__btn {
    font-size: 12px; padding: 5px 10px; cursor: pointer;
    border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; background: transparent; color: inherit;
  }
  .advisories__btn:disabled { cursor: default; opacity: 0.6; }
  .advisories__why { margin: 4px 0 0; font-size: 11px; color: #57606a; line-height: 1.4; }
  .advisories__consent { margin: 6px 0 0; font-size: 11px; color: #57606a; line-height: 1.4; }
  .advisories__consent-actions { display: flex; gap: 8px; margin-top: 6px; }
  .advisories__headline { margin: 6px 0 0; font-size: 12px; font-weight: 600; }
  /* Bound a long list to its own scroll region so it can't push the card past the
     viewport; the count headline above stays visible and the rest of the card
     (Trust details) stays reachable. */
  .advisories__list {
    margin: 6px 0 0; padding: 0 6px 0 0; list-style: none;
    max-height: 220px; overflow-y: auto; overscroll-behavior: contain;
  }
  .advisories__item { margin-top: 4px; font-size: 11px; line-height: 1.4; }
  .advisories__sev { font-weight: 600; text-transform: capitalize; }
  .advisories__note { margin: 4px 0 0; font-size: 11px; color: #57606a; line-height: 1.4; }
  .advisories__recheck {
    font-size: 11px; padding: 0; cursor: pointer;
    border: none; background: transparent; color: inherit; text-decoration: underline;
  }
  .advisories__recheck:disabled { cursor: default; opacity: 0.6; }
  .advisories__footer { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin: 6px 0 0; }
  .advisories__pulled { font-size: 11px; color: #57606a; }
  @media (prefers-color-scheme: dark) {
    .advisories__btn { border-color: rgba(255,255,255,0.24); }
    .advisories__why, .advisories__consent, .advisories__note, .advisories__pulled { color: #9198a1; }
  }
`

type Phase = 'idle' | 'consent' | 'busy'

export function AdvisoriesPanel({ target }: { target: SupportedRepo }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [consentGiven, setConsentGiven] = useState(false)
  const [result, setResult] = useState<AdvisoriesResult | null>(null)

  // On mount: hydrate from the separate advisories cache and read the consent flag.
  useEffect(() => {
    let live = true
    void (async () => {
      const [cached, settings] = await Promise.all([readAdvisoriesCache(target), getSettings()])
      if (!live) return
      if (cached) setResult(cached)
      setConsentGiven(settings.advisoriesConsentGiven === true)
    })()
    return () => {
      live = false
    }
  }, [target])

  const runCheck = async () => {
    setPhase('busy')
    try {
      const res = await requestCheckAdvisories(target)
      // `undefined` (worker unreachable) collapses to the same "couldn't check"
      // non-event as a transient backend failure — never an alarm.
      setResult(res ?? { status: 'unavailable' })
    } finally {
      setPhase('idle')
    }
  }

  // The primary action: either run directly (consent already given) or open the
  // one-time consent gate first.
  const onPrimary = () => {
    if (consentGiven) void runCheck()
    else setPhase('consent')
  }

  const allow = async () => {
    await setAdvisoriesConsentGiven(true)
    setConsentGiven(true)
    await runCheck()
  }

  const busy = phase === 'busy'

  return (
    <div class="advisories">
      {phase === 'consent' ? (
        <ConsentGate onAllow={allow} onCancel={() => setPhase('idle')} />
      ) : result ? (
        <ResultView result={result} busy={busy} onRecheck={onPrimary} />
      ) : (
        <>
          <button type="button" class="advisories__btn" onClick={onPrimary} disabled={busy}>
            {busy ? 'Checking…' : 'Check known advisories'}
          </button>
          <p class="advisories__why">
            Looks up known advisories (GHSA/OSV) for the resolved dependencies via the Repo Trust
            backend. Checks known advisories only — not malware or dependency risk.
          </p>
        </>
      )}
    </div>
  )
}

function ConsentGate({ onAllow, onCancel }: { onAllow: () => void; onCancel: () => void }) {
  const [pending, setPending] = useState(false)
  const allow = async () => {
    setPending(true)
    // On success `onAllow` switches the panel to its busy/result phase, which
    // unmounts this gate — so reset `pending` only on failure, where the gate is
    // still mounted. (A finally here would set state on an unmounted component.)
    try {
      await onAllow()
    } catch {
      setPending(false)
    }
  }
  return (
    <div>
      <p class="advisories__consent">{CONSENT_BODY}</p>
      <div class="advisories__consent-actions">
        <button type="button" class="advisories__btn" onClick={allow} disabled={pending}>
          {pending ? 'Checking…' : 'Allow & check'}
        </button>
        <button type="button" class="advisories__btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ResultView({
  result,
  busy,
  onRecheck,
}: {
  result: AdvisoriesResult
  busy: boolean
  onRecheck: () => void
}) {
  const recheck = (
    <button type="button" class="advisories__recheck" onClick={onRecheck} disabled={busy}>
      {busy ? 'Checking…' : 'Re-check'}
    </button>
  )

  if (result.status === 'no_dependency_data') {
    return (
      <div>
        <p class="advisories__headline">{NO_DEP_COPY}</p>
        <div class="advisories__footer">{recheck}</div>
      </div>
    )
  }
  if (result.status === 'unavailable') {
    return (
      <div>
        <p class="advisories__headline">{UNAVAILABLE_COPY}</p>
        <div class="advisories__footer">{recheck}</div>
      </div>
    )
  }

  // status === 'ok'
  const headline = advisoriesHeadline(result)
  // Most-severe first, so criticals/highs sit at the top of the scroll region
  // rather than wherever the backend happened to return them.
  const ordered = [...result.advisories].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
  const pulled = pulledLabel(result.asOf, new Date())
  return (
    <div>
      <p class="advisories__headline">{headline}</p>
      {ordered.length === 0 ? (
        <p class="advisories__note">{EMPTY_SUBNOTE}</p>
      ) : (
        <ul class="advisories__list">
          {ordered.map((a) => (
            <li key={a.id} class="advisories__item">
              <span class="advisories__sev">{a.severity}</span>
              {' · '}
              {a.package}
              {a.version ? `@${a.version}` : ''}
              {' · '}
              {a.summary}
              {a.url ? (
                <>
                  {' · '}
                  <a href={a.url} target="_blank" rel="noopener noreferrer">
                    source
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div class="advisories__footer">
        {recheck}
        {pulled ? <span class="advisories__pulled">pulled {pulled}</span> : null}
      </div>
    </div>
  )
}
