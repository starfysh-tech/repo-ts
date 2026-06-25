import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so the CRXJS plugin (which expects a real
// extension build context) never runs during unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
