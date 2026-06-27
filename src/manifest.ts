import { defineManifest } from '@crxjs/vite-plugin'

// Minimal MV3 manifest. Permissions are deliberately narrow (PRD): only
// `storage` plus host access to github.com and api.github.com. No `tabs`,
// `scripting`, `history`, `identity`, or broad host access.
export default defineManifest({
  manifest_version: 3,
  name: 'Repo Trust',
  version: '0.2.8',
  description: 'Explainable trust signals on public GitHub repository pages.',
  // `activeTab` lets the popup read the current tab's URL (granted on the user's
  // action click); narrower than `tabs`, which would expose every tab.
  permissions: ['storage', 'activeTab'],
  host_permissions: ['https://github.com/*', 'https://api.github.com/*'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Repo Trust',
  },
  // Standalone extension page for optional settings (e.g. the GitHub PAT).
  // Opened from the popup, not injected into github.com, so it is not a
  // web_accessible_resource.
  options_page: 'src/settings/index.html',
  // Entry basenames are deliberately distinct (not both `index.ts`): same-named
  // entries collide on the emitted `index.ts-<hash>.js` chunk and CRXJS can wire
  // the service-worker loader to the wrong one (loading the content script into
  // the worker → "window is not defined").
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://github.com/*'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/watchlist/index.html'],
      matches: ['https://github.com/*'],
    },
  ],
})
