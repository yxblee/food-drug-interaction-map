import { expect, test, type Page } from '@playwright/test'

async function addMeds(page: Page) {
  await page.goto('./?tab=meds')
  const input = page.getByLabel('Add a medication')
  for (const m of ['simvastatin', 'amlodipine', 'warfarin', 'Eliquis']) {
    await input.fill(m)
    await input.press('Enter')
  }
}

for (const [w, h] of [
  [360, 740],
  [320, 568],
] as const) {
  test(`${w}x${h}: header is one row, disclaimer one line, no sideways scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h })
    await addMeds(page)
    const header = (await page.locator('header').boundingBox())!
    const footer = (await page.getByRole('contentinfo').boundingBox())!
    expect(header.height).toBeLessThanOrEqual(64)
    expect(footer.height).toBeLessThanOrEqual(48)
    expect(header.height + footer.height).toBeLessThanOrEqual(112) // was 161
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w)
  })

  test(`${w}x${h}: Foods to watch heading and first Avoid lead are on the first screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h })
    await addMeds(page)
    const footerTop = (await page.getByRole('contentinfo').boundingBox())!.y
    const heading = (await page.getByRole('heading', { name: 'Foods to watch' }).boundingBox())!
    expect(heading.y).toBeGreaterThanOrEqual(0)
    expect(heading.y + heading.height).toBeLessThanOrEqual(footerTop)
    if (w === 360) {
      const lead = (await page
        .locator('section.meds__sev', { has: page.locator('#sev-avoid') })
        .locator('.warning__lead')
        .first()
        .boundingBox())!
      expect(lead.y + lead.height).toBeLessThanOrEqual(footerTop)
    }
  })
}

test('disclaimer is a one-line summary with the full text one tap away', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('./?tab=meds')
  const footer = page.getByRole('contentinfo')
  await expect(footer).toBeInViewport({ ratio: 1 })
  await expect(footer).toContainText('Not medical advice')
  expect((await footer.boundingBox())!.height).toBeLessThanOrEqual(48)
  const full = footer.getByText(/Talk to your pharmacist or doctor before changing/)
  await expect(full).toBeHidden()
  await footer.locator('summary').click()
  await expect(full).toBeVisible()
  await expect(footer).toBeInViewport({ ratio: 1 })
})

test('Can I have…? follows the results both in Tab order and on screen', async ({ page }) => {
  await addMeds(page)
  const r = await page.evaluate(() => {
    const results = document.querySelector('.meds__results')!
    const food =
      document.getElementById('food-input') ?? document.querySelector('.foodcheck input')!
    return {
      domAfter: !!(results.compareDocumentPosition(food) & Node.DOCUMENT_POSITION_FOLLOWING),
      resultsBottom: results.getBoundingClientRect().bottom + scrollY,
      foodTop: food.getBoundingClientRect().top + scrollY,
    }
  })
  expect(r.domAfter).toBe(true)
  expect(r.foodTop).toBeGreaterThanOrEqual(r.resultsBottom - 1)
})
