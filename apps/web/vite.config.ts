import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

// Static build for GitHub Pages: served from the repo subpath, reading pre-exported JSON.
const pages = process.env.VITE_STATIC_DATA === '1'

export default defineConfig({
  base: pages ? '/food-drug-interaction-map/' : '/',
  // No SPA fallback, so `vp preview` 404s missing node files like GitHub Pages does.
  appType: pages ? 'mpa' : 'spa',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
