import { expect, test, type Page } from '@playwright/test'
import { waitForRouteHandlersAtTeardown } from './route-teardown.ts'

waitForRouteHandlersAtTeardown()

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

test('360x740: Drug panel shows the first Severity badge above the fold', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  // Worst case: Simvastatin with both a MedlinePlus and a DailyMed link, whatever data/ holds.
  const SETID = '1b4121ee-a733-4456-a917-be2603477839'
  await page.route('**/api/graph.json', async (route) => {
    const body = await (await route.fetch()).json()
    body.nodes.find((n: { id: string }) => n.id === 'simvastatin').dailymed = SETID
    await route.fulfill({ json: body })
  })
  await page.route('**/api/node/drug/simvastatin.json', async (route) => {
    const body = await (await route.fetch()).json()
    body.entity.dailymed = SETID
    body.entity.medlineplus ??= 'https://medlineplus.gov/druginfo/meds/a692030.html'
    await route.fulfill({ json: body })
  })
  await page.goto('./?node=drug:simvastatin')
  const links = page.locator('.panel .extlink')
  await expect(links).toHaveCount(2)
  const [a, b] = await links.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))
  expect(a).toBe(b) // one row
  const badge = page.locator('.panel .panel__sev .badge').first()
  await expect(badge).toBeVisible()
  const box = (await badge.boundingBox())!
  // 40px margin: CI fonts render about 20px taller than local ones.
  const panel = (await page.locator('.panel').boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(740 - 40)
  expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height - 40)
})

test('Drug panel shows the NLM attribution once, naming each linked source', async ({ page }) => {
  await page.goto('./?node=drug:simvastatin')
  const note = page.locator('.panel').getByText('National Library of Medicine')
  await expect(note).toHaveCount(1)
  await expect(note).toContainText('Source: MedlinePlus and DailyMed, National Library of Medicine')
  await expect(page.locator('.panel__attribution')).toHaveCount(0)
})

test('a Drug with neither NLM link shows no attribution', async ({ page }) => {
  await page.goto('./?node=drug:statins')
  await expect(page.locator('.panel__title')).not.toHaveText('…')
  await expect(page.locator('.panel').getByText('National Library of Medicine')).toHaveCount(0)
})

test('the Explore key says what each Severity word means, as My meds does', async ({ page }) => {
  await page.goto('./?tab=meds')
  const medsKey = page.locator('.severity-key')
  await medsKey.locator('summary').click()
  const expected = await medsKey.locator('.severity-words li').allInnerTexts()
  expect(expected).toHaveLength(4)
  await page.goto('./')
  await page.getByText('How to read the map').click()
  expect(await page.locator('.legend .severity-words li').allInnerTexts()).toEqual(expected)
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
