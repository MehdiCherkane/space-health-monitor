import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
  test: {
    // The check-in feature keeps dependency-free `node:test` files (*.test.mjs);
    // Vitest cannot collect those, so they run through `node --test` in `npm test`.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
