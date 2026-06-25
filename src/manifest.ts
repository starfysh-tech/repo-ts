import { defineManifest } from '@crxjs/vite-plugin'

// Minimal MV3 manifest. Permissions are deliberately narrow (PRD): only
// `storage` plus host access to github.com and api.github.com. No `tabs`,
// `scripting`, `history`, `identity`, or broad host access.
export default defineManifest({
  manifest_version: 3,
  name: 'Repo Trust',
  version: '0.1.0',
  description: 'Explainable trust signals on public GitHub repository pages.',
  permissions: ['storage'],
  host_permissions: ['https://github.com/*', 'https://api.github.com/*'],
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'Repo Trust',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://github.com/*'],
      js: ['src/content/index.ts'],
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
