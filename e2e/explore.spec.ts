import { expect, test } from '@playwright/test'

test('search, select and share a food', async ({ page }, info) => {
  await page.goto('/')
  const search = page.getByLabel('Search drugs, foods and mechanisms')
  await search.fill('grapefruit')
  await expect(page.getByText(/\d+ match/)).toBeVisible()
  await search.press('Enter')

  const panel = page.getByRole('complementary')
  await expect(panel.getByRole('heading', { name: 'Grapefruit', exact: true })).toBeVisible()
  const row = panel.locator('li.irow', { hasText: 'Simvastatin' })
  await expect(row.locator('.badge')).toHaveText('Avoid')
  await expect(page).toHaveURL(/node=food%3Agrapefruit/)

  await page.reload()
  await expect(
    page.getByRole('complementary').getByRole('heading', { name: 'Grapefruit', exact: true }),
  ).toBeVisible()

  if (info.project.name === 'mobile') {
    await expect(page.locator('svg.graph2d')).toBeVisible()
    await expect(page.getByRole('button', { name: /^(2D|3D)$/ })).toHaveCount(0)
  } else {
    await expect(page.locator('.graph3d canvas')).toBeVisible()
  }
})

test('search selections are history entries', async ({ page }) => {
  await page.goto('/')
  const search = page.getByLabel('Search drugs, foods and mechanisms')
  await search.fill('grapefruit')
  await search.press('Enter')
  await expect(page).toHaveURL(/node=food%3Agrapefruit/)
  await page.goBack()
  await expect(page).not.toHaveURL(/node=/)
})

test('stale node links clear themselves', async ({ page }) => {
  await page.goto('/?node=drug:no-such-drug')
  await expect(page.locator('.notice')).toContainText('no longer in the dataset')
  await expect(page).not.toHaveURL(/node=/)
})
