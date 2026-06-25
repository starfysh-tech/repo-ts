// Pure URL classification — the secondary test seam. Misclassifying the page
// (analyzing the wrong repo, or a non-repo route) is correctness-critical, so
// this is unit-tested directly.
//
// Note on "private": a private repo's page URL is indistinguishable from a
// public one, so private-ness CANNOT be derived here. It is an API-time
// classification — the unauthenticated `/repos` call returns 404 — handled in
// the analysis slice (issue 03), not in this function.

export type RepoContext =
  | { kind: 'repo'; owner: string; repo: string }
  | { kind: 'unsupported' }

/** A repository page the extension supports analyzing (the `repo` variant). */
export type SupportedRepo = Extract<RepoContext, { kind: 'repo' }>

const UNSUPPORTED: RepoContext = { kind: 'unsupported' }

// First path segment on github.com that is an app route, never a user/org that
// can own a repository. Anything here is classified unsupported.
const RESERVED_OWNERS = new Set([
  'settings', 'marketplace', 'notifications', 'explore', 'topics', 'trending',
  'collections', 'events', 'orgs', 'organizations', 'users', 'apps', 'sponsors',
  'pulls', 'issues', 'codespaces', 'new', 'login', 'logout', 'join', 'about',
  'pricing', 'features', 'team', 'enterprise', 'security', 'contact', 'site',
  'dashboard', 'watching', 'stars', 'search', 'account', 'copilot',
])

export function parseRepoContext(rawUrl: string): RepoContext {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return UNSUPPORTED
  }

  // The content script is registered for github.com only; gist/raw/other hosts
  // are not analyzable repository pages.
  if (url.hostname !== 'github.com') return UNSUPPORTED

  const segments = url.pathname.split('/').filter(Boolean)
  // Need at least `owner/repo`; a bare owner/org profile is not a repo.
  if (segments.length < 2) return UNSUPPORTED

  const [owner, repo] = segments
  if (RESERVED_OWNERS.has(owner.toLowerCase())) return UNSUPPORTED

  // Any deeper subpage (tree/blob/issues/pull/actions/…) still belongs to the
  // same owner/repo, so we only ever read the first two segments.
  return { kind: 'repo', owner, repo }
}
