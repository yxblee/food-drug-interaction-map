import { defineConfig, devices } from '@playwright/test'

const swiftshader = {
  launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...swiftshader } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...swiftshader } },
  ],
  webServer: {
    command:
      'node apps/api/scripts/build-db.ts data dist/data.db && vp -C apps/web build && node apps/api/src/server.ts',
    url: 'http://localhost:4173/api/graph',
    env: { PORT: '4173', DB_PATH: 'dist/data.db', STATIC_DIR: 'apps/web/dist' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
