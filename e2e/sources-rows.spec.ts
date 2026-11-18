import { expect, test, type Locator, type Page } from '@playwright/test'

/** Open every "Details and sources" in scope, then check Source rows and link buttons. */
async function expectTargets(page: Page, scope: Locator) {
  await scope.locator('details.irow__more > summary').first().click()
  const cites = scope.locator('.irow__cites a')
  expect(await cites.count()).toBeGreaterThan(0)
  const boxes = await cites.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { h: r.height, w: r.width }
    }),
  )
  for (const b of boxes) expect(b.h).toBeGreaterThanOrEqual(44)
  // Whole row is the link: the anchor fills its list item.
  const fills = await scope
    .locator('.irow__cites li')
    .evaluateAll((els) =>
      els.map(
        (li) =>
          li.querySelector('a')!.getBoundingClientRect().width >=
          li.getBoundingClientRect().width - 1,
      ),
    )
  expect(fills.every(Boolean)).toBe(true)
  // Type is a label inside the link; SR text kept.
  await expect(cites.first().locator('.mono-label')).toHaveCount(1)
  await expect(cites.first().locator('.sr-only')).toHaveText(/opens in new tab/)
  await expect(cites.first().locator('svg[aria-hidden="true"]')).toHaveCount(1)
  await cites.first().focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  const outline = await cites.first().evaluate((e) => getComputedStyle(e).outlineStyle)
  expect(outline).not.toBe('none')
  await expect(scope.getByText('Sources', { exact: true }).first()).toBeVisible()
}

test('Explore: each Source is a 44px row link; link buttons get a 44px hit area', async ({
  page,
}) => {
  await page.goto('./?node=food%3Aaged-cheeses')
  const panel = page.getByRole('complementary')
  await expect(panel.locator('li.irow').first()).toBeVisible()
  await expectTargets(page, panel.locator('li.irow').first())
  const lb = panel.locator('.irow .link-button').first()
  const hit = await lb.evaluate((e) => {
    const s = getComputedStyle(e, '::after')
    const r = e.getBoundingClientRect()
    return { content: s.content, h: parseFloat(s.height) || 0, top: r.height }
  })
  expect(hit.content).not.toBe('none')
  expect(hit.h).toBeGreaterThanOrEqual(44)
})

test('My meds: Sources in a warning row are 44px row links', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const med = page.getByLabel('Add a medication')
  await med.fill('simvastatin')
  await med.press('Enter')
  const food = page.getByLabel('Can I have…?')
  await food.fill('grapefruit')
  await food.press('Enter')
  const row = page.locator('.warning').first()
  await expect(row.locator('li.irow').first()).toBeVisible()
  await expectTargets(page, row.locator('li.irow').first())
})
