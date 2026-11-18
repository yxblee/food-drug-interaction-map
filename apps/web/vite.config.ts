import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

// Static build for GitHub Pages: served from the repo subpath, reading pre-exported JSON.
const pages = process.env.VITE_STATIC_DATA === '1'

export default defineConfig({
  base: pages ? '/food-drug-interaction-map/' : '/',
  // No SPA fallback, so `vp preview` 404s missing node files like GitHub Pages does.
  appType: pages ? 'mpa' : 'spa',
  // Names the offline cache: a new build is a new worker URL and a new cache.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
