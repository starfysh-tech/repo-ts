// Always-visible framing shown alongside any verdict. The dimensions measure how
// a project is *maintained* (activity, governance, docs) — none of them inspect
// the code for safety, and every one can be inflated by a motivated bad actor. A
// non-expert reading a green "Strong signals" can easily over-trust, so this note
// (a) reframes the verdict as maintenance signals, not a security review, and
// (b) nudges toward the dominant lay-user risk: installing the wrong/forged
// source. Conservative vocabulary only (no "safe"/"trusted"/"malicious").
export const scopeNoteStyles = `
  .scopenote {
    margin: 10px 0 0; padding: 7px 9px; font-size: 11px; line-height: 1.45;
    color: #57606a; border-left: 3px solid #6e7781; background: rgba(110,119,129,0.06);
    border-radius: 0 6px 6px 0;
  }
  .scopenote strong { font-weight: 600; color: inherit; }
  .scopenote p { margin: 0; }
  .scopenote p + p { margin-top: 4px; }
  @media (prefers-color-scheme: dark) {
    .scopenote { color: #9198a1; background: rgba(255,255,255,0.04); }
  }
`

export function ScopeNote() {
  return (
    <aside class="scopenote" role="note">
      <p>
        <strong>Maintenance signals, not a security review.</strong> These describe how the project
        is run — they don't inspect the code itself.
      </p>
      <p>Before installing, confirm this is the official source and review it yourself.</p>
    </aside>
  )
}
