import { expect, test } from '@playwright/test'

// Screen reader users jump between Interactions by heading (one level below the Severity
// group's h3) and hear which pair each "Details and sources" disclosure belongs to.

test('Drug panel (few rows, grouped): each Interaction name is an h4 and select buttons still work', async ({
  page,
}) => {
  await page.goto('./?node=drug%3Aisoniazid')
  const panel = page.getByRole('complementary')
  const rows = panel.locator('li.irow')
  await expect(rows.first()).toBeVisible()
  const h4 = panel.getByRole('heading', { level: 4 })
  await expect(h4).toHaveCount(await rows.count())
  const first = h4.first()
  const button = first.getByRole('button')
  const name = (await button.textContent())!.trim()
  await expect(first).toHaveAccessibleName(name)
  await button.click()
  await expect(panel.getByRole('heading', { level: 2 }).first()).toContainText(name)
})

test('Food panel (many rows, collapsible): each row has an h4 and a named disclosure', async ({
  page,
}) => {
  await page.goto('./?node=food%3Agrapefruit')
  const panel = page.getByRole('complementary')
  const rows = panel.locator('li.irow--collapsible')
  await expect(rows.first()).toBeVisible()
  await expect(panel.getByRole('heading', { level: 4 })).toHaveCount(await rows.count())
  const row = rows.first()
  const drug = (await row.getByRole('heading', { level: 4 }).textContent())!.trim()
  await row.locator('summary').first().click()
  const more = row.locator('details.irow__more > summary')
  await expect(more).toHaveText('Details and sources')
  const accessible = await more.evaluate((el) => el.getAttribute('aria-label'))
  expect(accessible).toBe(`Details and sources for Grapefruit and ${drug}`)
})

test('Inherited rows are headings too', async ({ page }) => {
  await page.goto('./?node=drug%3Asimvastatin')
  const panel = page.getByRole('complementary')
  await expect(panel.locator('li.irow').first()).toBeVisible()
  await expect(panel.getByRole('heading', { level: 4 })).toHaveCount(
    await panel.locator('li.irow').count(),
  )
})

test('headings add no tab stops', async ({ page }) => {
  await page.goto('./?node=drug%3Awarfarin')
  const h4 = page.getByRole('complementary').getByRole('heading', { level: 4 })
  await expect(h4.first()).toBeVisible()
  const tabindexes = await h4.evaluateAll((els) => els.map((e) => e.getAttribute('tabindex')))
  expect(tabindexes.every((t) => t === null)).toBe(true)
})

test('My meds: each Food warning starts with an h4 under its Severity h3', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('Coumadin')
  await input.press('Enter')
  const warnings = page.locator('li.warning')
  await expect(warnings.first()).toBeVisible()
  await expect(page.getByRole('heading', { level: 4 })).toHaveCount(await warnings.count())
  const food = (await page.getByRole('heading', { level: 4 }).first().textContent())!.trim()
  const more = warnings.first().locator('details.irow__more > summary').first()
  await expect(more).toHaveText('Details and sources')
  expect(await more.getAttribute('aria-label')).toMatch(
    new RegExp(`^Details and sources for ${food} and `),
  )
})
