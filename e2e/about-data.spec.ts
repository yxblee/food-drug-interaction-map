import { expect, test } from '@playwright/test'

for (const tab of ['explore', 'meds'] as const) {
  test(`${tab}: About the data opens, shows Dataset facts, traps focus, Escape returns focus`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto(tab === 'meds' ? './?tab=meds' : './')
    const link = page.getByRole('button', { name: 'About the data' })
    await expect(link).toBeEnabled()
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await link.focus()
    await page.keyboard.press('Enter')
    const dlg = page.getByRole('dialog', { name: 'About the data' })
    await expect(dlg).toBeVisible()
    await expect(dlg).toContainText(/\d+ Drugs, \d+ Foods and \d+ Interactions/)
    await expect(dlg).toContainText(/reviewed on \w+ \d+, \d{4}/)
    await expect(dlg).toContainText('Drug labels')
    await expect(dlg).toContainText('US drug names only')
    await expect(dlg).toContainText('No result does not mean no interaction')
    await expect(dlg).toContainText('stays on this device')
    await expect(dlg).toContainText('not medical advice')
    await expect(dlg).toContainText('National Library of Medicine')
    // Modal: focus moves into the dialog (native modal: Tab cannot reach the page behind).
    await expect(page.getByRole('button', { name: 'Close' })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    expect(await dlg.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dlg).toBeHidden()
    await expect(link).toBeFocused()
  })
}

test('About the data: generic Report a mistake link', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'About the data' }).click()
  const a = page.getByRole('dialog', { name: 'About the data' }).getByRole('link', {
    name: /Report a mistake/,
  })
  await expect(a).toBeVisible()
  await expect(a).toHaveAttribute('target', '_blank')
  await expect(a).toHaveAttribute('rel', 'noopener noreferrer')
  expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(new URL((await a.getAttribute('href'))!).search).toBe('?template=wrong-interaction.yml')
})

test('About the data: downloads the Approved Interactions as a dated .csv, by keyboard', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'About the data' }).click()
  const btn = page.getByRole('button', { name: 'Download the interactions (CSV)' })
  await expect(btn).toBeVisible()
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await btn.focus()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.keyboard.press('Enter'),
  ])
  expect(download.suggestedFilename()).toMatch(/^food-drug-interactions-\d{4}-\d{2}-\d{2}\.csv$/)
  const path = await download.path()
  const text = (await import('node:fs')).readFileSync(path, 'utf8')
  expect(text).toContain('not medical advice')
  expect(text).toContain('Drug,Food,Severity,Effect,Mechanisms,Summary,Reviewed,Citation URLs')
})

test('About the data: Recently reviewed lists Interactions and a link selects that node on the map', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'About the data' }).click()
  const dlg = page.getByRole('dialog', { name: 'About the data' })
  await expect(dlg.getByRole('heading', { name: 'Recently reviewed' })).toBeVisible()
  const items = dlg.getByRole('list', { name: 'Recently reviewed' }).getByRole('listitem')
  expect(await items.count()).toBeGreaterThan(0)
  expect(await items.count()).toBeLessThanOrEqual(8)
  await expect(items.first()).toContainText(/(Avoid|Caution|Monitor|Minimal)/)
  await expect(items.first()).toContainText(/reviewed on \w+ \d{1,2}, \d{4}/)
  await expect(items.first().locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/)
  const link = items.first().getByRole('link').first()
  const href = (await link.getAttribute('href'))!
  const node = new URL(href, 'http://x/').searchParams.get('node')!
  await link.click()
  await expect(dlg).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`node=${node.replace(':', '(:|%3A)')}`))
  await expect(page.locator('aside.panel')).toBeVisible()
})
