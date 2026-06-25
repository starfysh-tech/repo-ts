// Shared headline: the trust icon (tinted by the --accent CSS var) + an
// uppercase state label, with an optional sub line. Used by the card and popup;
// co-located styles injected into both stylesheets (see ConfidenceMeter).
export const headlineStyles = `
  .rt-head { display: flex; align-items: center; gap: 8px; }
  .rt-head__icon { font-size: 16px; color: var(--accent, inherit); }
  .rt-head__state { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .rt-head__sub { margin: 4px 0 0; font-size: 12px; color: #57606a; }
  @media (prefers-color-scheme: dark) { .rt-head__sub { color: #9198a1; } }
`

export function Headline({ icon, label, sub }: { icon: string; label: string; sub?: string }) {
  return (
    <div>
      <div class="rt-head">
        <span class="rt-head__icon" aria-hidden="true">
          {icon}
        </span>
        <span class="rt-head__state">{label}</span>
      </div>
      {sub && <p class="rt-head__sub">{sub}</p>}
    </div>
  )
}
