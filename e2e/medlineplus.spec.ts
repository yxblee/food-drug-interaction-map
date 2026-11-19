import { expect, test } from '@playwright/test'

const SIMVASTATIN = 'https://medlineplus.gov/druginfo/meds/a692030.html'

test('the side panel for a Drug links to its MedlinePlus page', async ({ page }) => {
  await page.goto('./?node=drug:simvastatin')
  const link = page.getByRole('link', { name: /About this medication \(MedlinePlus\)/ })
  await expect(link).toHaveAttribute('href', SIMVASTATIN)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
  await expect(link).toHaveAccessibleName(/opens in a new tab/i)
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await expect(page.locator('.panel')).toContainText(
    /Source: MedlinePlus.*National Library of Medicine/,
  )
  await link.focus()
  await expect(link).toBeFocused()
})

test('a Drug class and a Drug with no MedlinePlus page get no link', async ({ page }) => {
  for (const key of ['drug:statins', 'drug:adenosine']) {
    await page.goto(`./?node=${key}`)
    await expect(page.locator('.panel__title')).not.toHaveText('…')
    await expect(page.getByRole('link', { name: /MedlinePlus/ })).toHaveCount(0)
  }
})

test('My meds links each listed medication to MedlinePlus', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('simvastatin')
  await input.press('Enter')
  const chips = page.getByRole('list', { name: 'Your medications' })
  const about = page.getByRole('region', { name: 'About your medications' })
  const link = about.getByRole('link', { name: /About Simvastatin.*MedlinePlus.*new tab/i })
  await expect(link).toHaveAttribute('href', SIMVASTATIN)
  await expect(link).toHaveAttribute('target', '_blank')
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await input.fill('adenosine')
  await input.press('Enter')
  await expect(chips).toContainText('Adenosine')
  await expect(about.getByRole('link', { name: /MedlinePlus/ })).toHaveCount(1)
})

test('My meds shows the NLM attribution once for several listed medications', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const name of ['simvastatin', 'acetaminophen']) {
    await input.fill(name)
    await input.press('Enter')
  }
  const about = page.getByRole('region', { name: 'About your medications' })
  await expect(about.getByText('National Library of Medicine')).toHaveCount(1)
})
