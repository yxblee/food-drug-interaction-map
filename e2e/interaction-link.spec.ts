import { expect, test } from '@playwright/test'

// A link to one Interaction: opens the panel it was copied from, expands the row, scrolls to it
// and focuses it, keeping the other view settings. Unknown ids say so and never leave a blank page.

const ID = 'grapefruit-relatives--simvastatin'

test('a link opens the row expanded and focused in the named panel, keeping view settings', async ({
  page,
}) => {
  await page.goto(
    `./?node=food%3Agrapefruit-relatives&interaction=${ID}&view=2d&sev=avoid%2Ccaution`,
  )
  const panel = page.getByRole('complementary')
  const row = panel.locator(`li[id="ixn-${ID}"]`)
  await expect(row).toBeFocused()
  await expect(row.locator('details.irow__more')).toHaveJSProperty('open', true)
  await expect(row.getByText('What to do:')).toBeVisible()
  await expect(row).toBeInViewport()
  const url = new URL(page.url())
  expect(url.searchParams.get('interaction')).toBe(ID)
  expect(url.searchParams.get('view')).toBe('2d')
  expect(url.searchParams.get('sev')).toBe('avoid,caution')
})

test('with no node, the link opens the Drug panel', async ({ page }) => {
  await page.goto(`./?interaction=${ID}`)
  const panel = page.getByRole('complementary')
  await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Simvastatin')
  await expect(panel.locator(`li[id="ixn-${ID}"]`)).toBeFocused()
})

test('an inherited row opens in the viewed member panel', async ({ page }) => {
  const inherited = 'potassium-salt-substitutes--ace-inhibitors'
  await page.goto(`./?node=drug%3Alisinopril&interaction=${inherited}`)
  const panel = page.getByRole('complementary')
  await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Lisinopril')
  await expect(panel.locator(`li[id="ixn-${inherited}"]`)).toBeFocused()
})

test('Copy link puts this row, in this panel, on the clipboard and says so politely', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('./?node=drug%3Awarfarin&view=2d')
  const panel = page.getByRole('complementary')
  const row = panel.locator('li.irow').first()
  await row.locator('details.irow__more > summary').click()
  const copy = row.getByRole('button', { name: 'Copy link to this Interaction' })
  const box = (await copy.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.x + box.width).toBeLessThanOrEqual(360)
  await copy.click()
  await expect(row.getByRole('status')).toHaveText('Link copied')
  await expect(copy).toBeFocused()
  const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()))
  expect(copied.searchParams.get('node')).toBe('drug:warfarin')
  expect(copied.searchParams.get('interaction')).toMatch(/^[a-z0-9-]+--warfarin$/)
  expect(copied.searchParams.has('view')).toBe(false)
})

test('an unknown id says so, keeps the map and drops the key', async ({ page }) => {
  await page.goto('./?interaction=nothing--here&view=2d')
  await expect(
    page.getByRole('status').filter({ hasText: "That interaction isn't in the dataset" }),
  ).toBeVisible()
  await expect(page.getByRole('complementary')).toHaveCount(0)
  await expect.poll(() => new URL(page.url()).searchParams.has('interaction')).toBe(false)
  expect(new URL(page.url()).searchParams.get('view')).toBe('2d')
})

test('a known id the named panel does not list says so inside the panel', async ({ page }) => {
  await page.goto(`./?node=drug%3Awarfarin&interaction=${ID}`)
  const panel = page.getByRole('complementary')
  await expect(panel.getByRole('heading', { level: 2 })).toHaveText('Warfarin')
  await expect(panel.getByRole('status').filter({ hasText: "isn't listed here" })).toBeVisible()
})
