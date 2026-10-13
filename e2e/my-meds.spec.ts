import { expect, test } from '@playwright/test'

test('add a brand-name med, see foods to watch, persist across reload', async ({ page }) => {
  const apiCalls: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/')) apiCalls.push(r.url())
  })

  await page.goto('./')
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

test('each affected drug shows its own severity inside a food warning', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const med of ['simvastatin', 'amlodipine']) {
    await input.fill(med)
    await input.press('Enter')
  }

  const avoid = page.locator('section.meds__sev', { has: page.locator('#sev-avoid') })
  const grapefruit = avoid.locator('.warning summary', { hasText: 'Grapefruit' })
  await expect(grapefruit.locator('.warning__drug', { hasText: 'Simvastatin' })).not.toContainText(
    'Minimal',
  )
  await expect(grapefruit.locator('.warning__drug', { hasText: 'Amlodipine' })).toContainText(
    'Minimal',
  )
})

test('a brand name for a med already listed says so instead of "no match"', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('warfarin')
  await input.press('Enter')

  await input.fill('Coumadin')
  await expect(page.getByText('No match in our dataset')).toHaveCount(0)
  await input.press('Enter')

  await expect(page.getByRole('status').filter({ hasText: 'already on your list' })).toContainText(
    'Warfarin (Coumadin) is already on your list',
  )
  const chips = page.getByRole('list', { name: 'Your medications' }).getByRole('listitem')
  await expect(chips).toHaveCount(1)
  await expect(chips.first()).toBeFocused()
})

test('results are announced and controls are readable and easy to hit', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const med of ['warfarin', 'simvastatin']) {
    await input.fill(med)
    await input.press('Enter')
  }

  await expect(page.getByRole('status').filter({ hasText: 'foods to watch' })).toHaveText(
    /^\d+ foods to watch, 1 to avoid$/,
  )

  const minHit = async (box: { width: number; height: number } | null, dims: 'h' | 'wh') => {
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    if (dims === 'wh') expect(box!.width).toBeGreaterThanOrEqual(44)
  }
  await minHit(await page.getByRole('button', { name: 'Remove Warfarin' }).boundingBox(), 'wh')
  await minHit(await page.locator('.warning summary').first().boundingBox(), 'h')

  const colors = await input.evaluate((el) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--muted)'
    document.body.append(probe)
    const muted = getComputedStyle(probe).color
    probe.remove()
    return {
      muted,
      border: getComputedStyle(el).borderTopColor,
      placeholder: getComputedStyle(el, '::placeholder').color,
    }
  })
  expect(colors.border).toBe(colors.muted)
  expect(colors.placeholder).toBe(colors.muted)
})
