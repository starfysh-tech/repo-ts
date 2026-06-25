import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

// The popup HTML is discovered via the manifest's `action.default_popup`.
// The watchlist is an extension page not referenced by the manifest, so it is
// added as an explicit Rollup input to make it part of the build.
export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: { watchlist: 'src/watchlist/index.html' },
    },
  },
})
