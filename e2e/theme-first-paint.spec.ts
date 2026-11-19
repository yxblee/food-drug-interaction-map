import { expect, test } from '@playwright/test'

// Untinted paper tokens (PALETTES.grey in apps/web/src/theme/tokens.ts).
const PAPER = { dark: 'rgb(27, 26, 24)', light: 'rgb(232, 230, 225)' }

for (const scheme of ['dark', 'light'] as const) {
  test(`${scheme}: body background is the ${scheme} paper at DOMContentLoaded and stays`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const bg = () => getComputedStyle(document.body).backgroundColor
        const w = window as unknown as { __bg: { early: string; later?: string } }
        w.__bg = { early: bg() }
        setTimeout(() => (w.__bg.later = bg()), 50)
      })
    })
    await page.goto('./')
    await page.waitForFunction(() => (window as any).__bg?.later)
    const bg = await page.evaluate(() => (window as any).__bg)
    expect(bg.early).toBe(PAPER[scheme])
    expect(bg.later).toBe(PAPER[scheme])
  })
}
