import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
  },
  lint: {
    plugins: ['typescript', 'react'],
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ['**/dist/**', 'playwright-report/**', 'test-results/**'],
  },
  fmt: {
    singleQuote: true,
    semi: false,
    ignorePatterns: ['**/*.md', 'data/**', 'pnpm-lock.yaml'],
  },
  run: { cache: true },
})
