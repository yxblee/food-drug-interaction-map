import { defineConfig, devices } from '@playwright/test'

const swiftshader = {
  launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173/food-drug-interaction-map/', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...swiftshader } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...swiftshader } },
  ],
  webServer: {
    // The static GitHub Pages build, served under its repo subpath.
    command:
      'node apps/api/scripts/build-db.ts data dist/data.db && node apps/api/scripts/export-static.ts dist/data.db apps/web/public && vp -C apps/web build && vp -C apps/web preview --port 4173 --strictPort',
    url: 'http://localhost:4173/food-drug-interaction-map/api/graph.json',
    env: { VITE_STATIC_DATA: '1' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
