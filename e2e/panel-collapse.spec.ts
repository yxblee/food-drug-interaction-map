import { expect, test } from '@playwright/test'

test('a panel with many rows collapses them and keeps Prev, Next and Close on top', async ({
  page,
}) => {
  await page.goto('./?node=food%3Agrapefruit')
  const panel = page.getByRole('complementary')
  const rows = panel.locator('li.irow--collapsible')
  await expect(rows.first()).toBeVisible()
  expect(await rows.count()).toBeGreaterThan(5)
  expect(await rows.evaluateAll((els) => els.some((e) => e.querySelector('details')!.open))).toBe(
    false,
  )
  const heights = await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44)
  await expect(panel.getByRole('heading', { level: 3, name: /^Avoid \(\d+\)/ })).toBeVisible()
  await expect(panel.getByText('Serious interaction.')).toBeVisible()

  // Focus order: top bar first, then rows; no Browse nav after the rows.
  const order = await panel
    .locator('button, summary')
    .evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute('aria-label')))
  expect(order).toEqual(['Previous food', 'Next food', 'Close panel'])
  await expect(panel.getByRole('navigation', { name: 'Browse' })).toHaveCount(0)
  await panel.evaluate((p) => (p.scrollTop = p.scrollHeight))
  await expect(panel.getByRole('button', { name: 'Next food' })).toBeInViewport()

  await panel.evaluate((p) => (p.scrollTop = 0))
  await rows.first().locator('summary').first().click()
  await expect(rows.first().getByText('What to do:')).toBeVisible()
  await expect(rows.first().getByText('Details and sources')).toBeVisible()
})

test('Avoid and Caution row names are within three screens of the panel on a phone', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile')
  await page.goto('./?node=food%3Agrapefruit')
  const panel = page.getByRole('complementary')
  await expect(panel.locator('li.irow--collapsible').first()).toBeVisible()
  const ok = await panel.evaluate((p) => {
    const caution = p.querySelector('#sev-caution')!.parentElement!
    const end = caution.getBoundingClientRect().bottom - p.getBoundingClientRect().top + p.scrollTop
    return end <= 3 * p.clientHeight
  })
  expect(ok).toBe(true)
})

test('a panel with few rows is unchanged', async ({ page }) => {
  await page.goto('./?node=food%3Aaged-cheeses')
  const panel = page.getByRole('complementary')
  await expect(panel.locator('li.irow').first()).toBeVisible()
  await expect(panel.locator('li.irow--collapsible')).toHaveCount(0)
  await expect(panel.getByText('What to do:').first()).toBeVisible()
})
