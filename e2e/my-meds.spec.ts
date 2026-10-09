import { expect, test } from '@playwright/test'

test('add a brand-name med, see foods to watch, persist across reload', async ({ page }) => {
  const apiCalls: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/')) apiCalls.push(r.url())
  })

  await page.goto('/')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('Coumadin')
  await input.press('Enter')

  const chips = page.getByRole('list', { name: 'Your medications' })
  await expect(chips).toContainText('Warfarin')
  const caution = page.locator('section.meds__sev', { has: page.locator('#sev-caution') })
  await expect(caution).toContainText('Leafy greens')

  await page.reload()
  await expect(page.getByRole('list', { name: 'Your medications' })).toContainText('Warfarin')

  expect(apiCalls.some((u) => /warfarin|coumadin/i.test(u))).toBe(false)
})
