import { expect, test } from '@playwright/test'

const chips = (page: import('@playwright/test').Page) =>
  page.getByRole('list', { name: 'Your medications' })

test('opening a Share link asks, and Add merges both medications and clears the fragment', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('./#meds=warfarin,simvastatin')

  const prompt = page.getByRole('group', { name: /Add these 2 medications/ })
  await expect(prompt).toContainText('Warfarin')
  await expect(prompt).toContainText('Simvastatin')
  await prompt.getByRole('button', { name: 'Add' }).click()

  await expect(chips(page)).toContainText('Warfarin')
  await expect(chips(page)).toContainText('Simvastatin')
  await expect(prompt).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')
  expect(requests.some((u) => /warfarin|simvastatin/i.test(u) && !u.includes('/assets/'))).toBe(
    false,
  )
})

test('Not now leaves the list unchanged and clears the fragment; unknown ids are counted', async ({
  page,
}) => {
  await page.goto('./#meds=warfarin,not-a-drug')
  const prompt = page.getByRole('group', { name: /Add these 1 medication/ })
  await expect(prompt).toContainText("1 link item wasn't recognised")
  await prompt.getByRole('button', { name: 'Not now' }).click()

  await expect(prompt).toHaveCount(0)
  await expect(chips(page).getByRole('listitem')).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')
})

test('Share link pill fits the action row at 360px and announces the notice', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('./?tab=meds')
  const input = page.getByLabel('Add a medication')
  await input.fill('warfarin')
  await input.press('Enter')
  await input.fill('Mystery pill')
  await input.press('Enter')

  const pill = page.getByRole('button', { name: 'Share link' })
  await expect(pill).toBeVisible()
  const box = (await pill.boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.x + box.width).toBeLessThanOrEqual(360)
  await expect(page.getByText(/anyone with it can see them/)).toBeVisible()

  await pill.focus()
  await pill.press('Enter')
  await expect(pill).toBeFocused()
  await expect(
    page.getByRole('status').filter({ hasText: /1 medication not in our list was left out/ }),
  ).toBeVisible()
})

test('a Share link followed in a tab that already has the app asks, without a reload', async ({
  page,
}) => {
  await page.goto('./?tab=meds')
  await expect(page.getByLabel('Add a medication')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { stillHere: boolean }).stillHere = true
    location.hash = '#meds=warfarin,warfarin,not-a-drug,metformin'
  })

  const prompt = page.getByRole('group', { name: /Add these 2 medications/ })
  await expect(prompt).toContainText("1 link item wasn't recognised")
  await prompt.getByRole('button', { name: 'Add' }).click()

  await expect(chips(page)).toContainText('Warfarin')
  await expect(chips(page)).toContainText('Metformin')
  await expect(prompt).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')
  expect(await page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(
    true,
  )
  // a fragment with no usable list shows nothing
  await page.evaluate(() => (location.hash = '#nothing=here'))
  await expect(page.getByRole('group', { name: /Add these/ })).toHaveCount(0)
})

test('a Share link followed from another tab asks, and Not now clears it without re-asking', async ({
  page,
}) => {
  await page.goto('./')
  await page.evaluate(() => (location.hash = '#meds=warfarin'))
  const prompt = page.getByRole('group', { name: /Add these 1 medication/ })
  await prompt.getByRole('button', { name: 'Not now' }).click()

  await expect(prompt).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')
  await expect(chips(page).getByRole('listitem')).toHaveCount(0)
})
