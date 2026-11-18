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
