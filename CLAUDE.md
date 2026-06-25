# repo-ts

## Agent skills

This repo vendors the [mattpocock/skills](https://github.com/mattpocock/skills) engineering, productivity, and misc skills under `.claude/skills/`. The settings below configure how those skills operate in this repo.

### Issue tracker

Issues and PRDs live as local markdown under `.scratch/<feature>/` (no remote issue tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
