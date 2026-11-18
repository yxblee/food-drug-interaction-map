import { expect, test } from '@playwright/test'

test('Try grapefruit is a 44px target', async ({ page }) => {
  await page.goto('./')
  const box = (await page.getByRole('button', { name: 'Try grapefruit' }).boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
})

test('360px: the Severity key sits beside Foods to watch and opens the four meanings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('./?tab=meds')
  const input = page.getByLabel('Add a medication')
  for (const m of ['simvastatin', 'warfarin']) {
    await input.fill(m)
    await input.press('Enter')
  }
  const footerTop = (await page.getByRole('contentinfo').boundingBox())!.y
  const heading = (await page.getByRole('heading', { name: 'Foods to watch' }).boundingBox())!
  const key = page.getByText('What the Severity words mean')
  const keyBox = (await key.boundingBox())!
  expect(keyBox.height).toBeGreaterThanOrEqual(44)
  expect(keyBox.y + keyBox.height).toBeLessThanOrEqual(footerTop)
  // Same row as the heading: it adds no line of its own, so the first Avoid lead keeps its headroom.
  expect(Math.abs(keyBox.y + keyBox.height / 2 - (heading.y + heading.height / 2))).toBeLessThan(16)
  const row = (await page.locator('.meds__resulthead').boundingBox())!
  expect(row.height).toBeLessThanOrEqual(heading.height + 2)
  await key.click()
  for (const w of ['Avoid', 'Caution', 'Monitor', 'Minimal'])
    await expect(page.locator('.severity-words .badge', { hasText: w })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})

test('360px: 12px labels do not wrap or overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('./?tab=meds')
  const input = page.getByLabel('Add a medication')
  await input.fill('Synthroid')
  await input.press('Enter')
  const label = page.locator('.mono-label').first()
  expect(await label.evaluate((e) => getComputedStyle(e).fontSize)).toBe('12px')
  // A Brand name keeps its case on the chip.
  await expect(page.locator('.chip__brand')).toHaveText(/\(Synthroid\)/)
  expect(
    await page.locator('.chip__brand').evaluate((e) => getComputedStyle(e).textTransform),
  ).toBe('none')
  // No single-line label is taller than two lines of itself.
  const tall = await page
    .locator('.app__bar .mono-label, label.mono-label')
    .evaluateAll(
      (els) => els.filter((e) => e.getBoundingClientRect().height > 2 * 12 * 1.2 + 1).length,
    )
  expect(tall).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})

test('a single-Drug warning does not repeat the Drug name under its lead', async ({ page }) => {
  await page.goto('./?tab=meds')
  const input = page.getByLabel('Add a medication')
  await input.fill('simvastatin')
  await input.press('Enter')
  const row = page.locator('.warning', { hasText: 'Grapefruit' }).first()
  await expect(row.locator('.warning__lead')).toContainText('Simvastatin')
  await expect(row.locator('.irow__name')).toHaveCount(0)
})
