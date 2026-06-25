import { describe, it, expect } from 'vitest'
import { parseRepoContext } from './parseRepoContext'

describe('parseRepoContext', () => {
  it('classifies a repository root page', () => {
    expect(parseRepoContext('https://github.com/facebook/react')).toEqual({
      kind: 'repo',
      owner: 'facebook',
      repo: 'react',
    })
  })

  it('classifies any repo subpage as the same owner/repo', () => {
    for (const sub of ['/tree/main/packages', '/blob/main/README.md', '/issues', '/pull/123', '/actions']) {
      expect(parseRepoContext(`https://github.com/facebook/react${sub}`)).toEqual({
        kind: 'repo',
        owner: 'facebook',
        repo: 'react',
      })
    }
  })

  it('ignores query string and hash fragments', () => {
    expect(parseRepoContext('https://github.com/tj/commander.js?tab=readme#install')).toEqual({
      kind: 'repo',
      owner: 'tj',
      repo: 'commander.js',
    })
  })

  it('handles a trailing slash on the repo root', () => {
    expect(parseRepoContext('https://github.com/sindresorhus/got/')).toEqual({
      kind: 'repo',
      owner: 'sindresorhus',
      repo: 'got',
    })
  })

  it('treats a bare owner/org profile page as unsupported', () => {
    expect(parseRepoContext('https://github.com/facebook')).toEqual({ kind: 'unsupported' })
  })

  it('treats reserved GitHub app routes as unsupported', () => {
    for (const url of [
      'https://github.com/',
      'https://github.com/settings/profile',
      'https://github.com/marketplace',
      'https://github.com/notifications',
      'https://github.com/orgs/facebook/repositories',
      'https://github.com/explore',
    ]) {
      expect(parseRepoContext(url)).toEqual({ kind: 'unsupported' })
    }
  })

  it('treats non-github.com hosts as unsupported', () => {
    expect(parseRepoContext('https://gist.github.com/foo/bar')).toEqual({ kind: 'unsupported' })
    expect(parseRepoContext('https://example.com/facebook/react')).toEqual({ kind: 'unsupported' })
  })

  it('treats a malformed URL as unsupported', () => {
    expect(parseRepoContext('not a url')).toEqual({ kind: 'unsupported' })
  })
})
