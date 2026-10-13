import { expect, test } from '@playwright/test'

test('search, select and share a food', async ({ page }, info) => {
  await page.goto('./')
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
  await page.goto('./')
  const search = page.getByLabel('Search drugs, foods and mechanisms')
  await search.fill('grapefruit')
  await search.press('Enter')
  await expect(page).toHaveURL(/node=food%3Agrapefruit/)
  await page.goBack()
  await expect(page).not.toHaveURL(/node=/)
})

test('stale node links clear themselves', async ({ page }) => {
  await page.goto('./?node=drug:no-such-drug')
  await expect(page.locator('.notice')).toContainText('no longer in the dataset')
  await expect(page).not.toHaveURL(/node=/)
})

test('explore controls keep the 16px gutter and a readable search field', async ({ page }) => {
  await page.goto('./')
  const mechanisms = page.getByRole('button', { name: 'Mechanisms' })
  expect((await mechanisms.boundingBox())!.x).toBeGreaterThanOrEqual(16)

  const search = page.getByLabel('Search drugs, foods and mechanisms')
  const [border, placeholder, muted] = await search.evaluate((el) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--muted)'
    document.body.append(probe)
    const m = getComputedStyle(probe).color
    probe.remove()
    return [getComputedStyle(el).borderTopColor, getComputedStyle(el, '::placeholder').color, m]
  })
  expect(border).toBe(muted)
  expect(placeholder).toBe(muted)
})

test('a first visit explains the map and suggests where to start', async ({ page }) => {
  await page.goto('./')
  await page.getByText('How to read the map').click()
  const legend = page.locator('.legend')
  for (const term of ['Drug', 'Food', 'Mechanism', 'Avoid', 'Minimal', 'Color']) {
    await expect(legend).toContainText(term)
  }

  await page.getByRole('button', { name: 'Try grapefruit' }).click()
  await expect(
    page.getByRole('complementary').getByRole('heading', { name: 'Grapefruit', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveURL(/node=food%3Agrapefruit/)
  await expect(page.getByRole('button', { name: 'Try grapefruit' })).toHaveCount(0)
})

test('links carry severity ink before anything is selected', async ({ page }, info) => {
  await page.goto('./')
  if (info.project.name !== 'mobile') await page.getByRole('button', { name: '2D' }).click()
  const avoidLink = page.locator('svg.graph2d .link.sev-avoid').first()
  await expect(avoidLink).toBeAttached()
  await expect(avoidLink).toHaveCSS('stroke', 'rgb(122, 42, 28)')
})

test('keyboard users reach search before any graph node', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.graph-host')).toBeAttached()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const where = await page.evaluate(() => {
      const el = document.activeElement
      if (el?.closest('.graph-host')) return 'graph'
      return el?.getAttribute('aria-label') === 'Search drugs, foods and mechanisms' ? 'search' : ''
    })
    expect(where).not.toBe('graph')
    if (where === 'search') return
  }
  throw new Error('search not reached within 12 tabs')
})

test('picking a search result closes the list until you type again', async ({ page }) => {
  await page.goto('./')
  const search = page.getByLabel('Search drugs, foods and mechanisms')
  await search.fill('grapefruit')
  const results = page.locator('.search__results')
  await results
    .getByRole('button', { name: /Grapefruit$/ })
    .first()
    .click()
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(results).toHaveCount(0)

  await search.fill('grape')
  await expect(results).toBeVisible()
})
