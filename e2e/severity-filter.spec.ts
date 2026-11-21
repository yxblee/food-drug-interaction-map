import { expect, test } from '@playwright/test'

// #161: Severity filter on the Explore map.
const group = (page: import('@playwright/test').Page) =>
  page.getByRole('group', { name: 'Show Severities' })

test('keyboard Avoid-only filter updates the map, the URL and the note; Show all restores it', async ({
  page,
}) => {
  await page.goto('./?view=2d')
  const sev = group(page)
  for (const name of ['Avoid', 'Caution', 'Monitor', 'Minimal'])
    await expect(sev.getByRole('button', { name, pressed: true })).toBeVisible()
  await expect(page.getByText('Filter on:')).toHaveCount(0)
  expect(new URL(page.url()).searchParams.has('sev')).toBe(false)
  await expect(page.locator('svg.graph2d .link.sev-caution').first()).toBeAttached()

  // Tab order: switch off the other three by keyboard.
  for (const name of ['Caution', 'Monitor', 'Minimal']) {
    const b = sev.getByRole('button', { name })
    await b.focus()
    await page.keyboard.press('Enter')
    await expect(b).toHaveAttribute('aria-pressed', 'false')
  }
  await expect(sev.getByRole('button', { name: 'Avoid' })).toHaveAttribute('aria-pressed', 'true')
  expect(new URL(page.url()).searchParams.get('sev')).toBe('avoid')
  await expect(page.getByText('Filter on: showing Avoid only.')).toBeVisible()
  await expect(page.locator('svg.graph2d .link.sev-avoid').first()).toBeAttached()
  await expect(page.locator('svg.graph2d .link.sev-caution')).toHaveCount(0)
  await expect(page.locator('svg.graph2d .link.sev-monitor')).toHaveCount(0)

  // The last Severity cannot be switched off.
  await sev.getByRole('button', { name: 'Avoid' }).click({ force: true })
  await expect(sev.getByRole('button', { name: 'Avoid' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Show all' }).click()
  await expect(page.getByText('Filter on:')).toHaveCount(0)
  expect(new URL(page.url()).searchParams.has('sev')).toBe(false)
  await expect(page.locator('svg.graph2d .link.sev-caution').first()).toBeAttached()
})

test('a shared link reproduces the filter, and a Severity button is at least 44px tall', async ({
  page,
}) => {
  await page.goto('./?view=2d&sev=avoid,caution')
  const sev = group(page)
  await expect(sev.getByRole('button', { name: 'Monitor' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(sev.getByRole('button', { name: 'Caution' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Filter on: showing Avoid, Caution only.')).toBeVisible()
  await expect(page.locator('svg.graph2d .link.sev-monitor')).toHaveCount(0)
  const box = await sev.getByRole('button', { name: 'Avoid' }).boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
})

test('the side panel still lists every Interaction while a filter is on', async ({ page }) => {
  await page.goto('./?view=2d&sev=avoid&node=food:grapefruit')
  await expect(page.getByText('Filter on: showing Avoid only.')).toBeVisible()
  const panel = page.locator('.panel')
  await expect(panel.getByRole('heading', { name: /Caution/ }).first()).toBeVisible()
})

test('fits at 360px without covering the zoom controls', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('./?view=2d&sev=avoid')
  const bar = page.locator('.sev-filter')
  const zoom = page.getByRole('group', { name: 'Map zoom' })
  await expect(bar).toBeVisible()
  const b = (await bar.boundingBox())!
  const z = (await zoom.boundingBox())!
  expect(b.x + b.width).toBeLessThanOrEqual(360)
  // Generous slack: CI fonts render about 20px taller than local.
  expect(b.y + b.height + 20).toBeLessThan(z.y)
})

test('the four pills stay on one row at 360px even with wider text, so the hint below never moves onto the map', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('./')
  // Slack for CI fonts, which render wider and taller than local ones.
  await page.addStyleTag({
    content: '.sev-filter__btn { letter-spacing: 0.06em }',
  })
  const tops = await group(page)
    .getByRole('button')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
  const last = (await group(page).getByRole('button').last().boundingBox())!
  expect(last.x + last.width).toBeLessThanOrEqual(360)
})
