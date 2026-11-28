import { createServer } from 'node:net'
import { defineConfig, devices } from '@playwright/test'

// SwiftShader for WebGL only. `--use-angle=swiftshader` would composite the whole page on it too,
// which stalls pages for seconds under load (#228, e2e/browser-flags.spec.ts).
const swiftshader = {
  launchOptions: {
    args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'],
  },
}

// CI uses a fixed port. Locally, pick a free one so a run never reuses another worktree's server.
// Stored in env so Playwright workers, which reload this file, agree on it.
const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = createServer().listen(0, () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
const port = (process.env.E2E_PORT ??= String(process.env.CI ? 4173 : await freePort()))
const base = `http://localhost:${port}/food-drug-interaction-map/`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Software-GL mobile tests time out under the default (CPU/2) workers on a laptop.
  workers: process.env.CI ? undefined : 2,
  retries: process.env.CI ? 1 : 0,
  // Blocked so `page.route` mocks see every request; e2e/offline.spec.ts allows the worker.
  use: { baseURL: base, trace: 'retain-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...swiftshader } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...swiftshader } },
  ],
  webServer: {
    // The static GitHub Pages build, served under its repo subpath.
    command: `node --run build:static && vp -C apps/web preview --port ${port} --strictPort`,
    url: `${base}api/graph.json`,
    env: { VITE_STATIC_DATA: '1' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
