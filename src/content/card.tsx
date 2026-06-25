import type { SupportedRepo } from './parseRepoContext'

// Walking-skeleton card: proves the in-page mount works and shows the detected
// owner/repo with a placeholder state. Real trust/confidence arrives in issue 03.
// State is conveyed with an icon AND a text label (never color alone) — the
// accessibility posture is structural from the start.
export function TrustCard({ context }: { context: SupportedRepo }) {
  return (
    <section class="card" role="region" aria-label="Repo Trust summary">
      <header class="card__head">
        <span class="card__icon" aria-hidden="true">◌</span>
        <span class="card__state">Not yet analyzed</span>
      </header>
      <p class="card__repo">
        {context.owner}/{context.repo}
      </p>
    </section>
  )
}
