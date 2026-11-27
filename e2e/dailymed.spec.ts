import { expect, test, type Page } from '@playwright/test'
import { waitForRouteHandlersAtTeardown } from './route-teardown.ts'

waitForRouteHandlersAtTeardown()

// Simvastatin's payload gets a fixed setid so the href is stable whatever data/ holds.
const SETID = '1b4121ee-a733-4456-a917-be2603477839'
const URL = `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${SETID}`
type Body = { nodes: { id: string; dailymed?: string }[] }

async function simvastatinHasALabel(page: Page) {
  await page.route('**/api/graph.json', async (route) => {
    const body = (await (await route.fetch()).json()) as Body
    body.nodes.find((n) => n.id === 'simvastatin')!.dailymed = SETID
    await route.fulfill({ json: body })
  })
  await page.route('**/api/node/drug/simvastatin.json', async (route) => {
    const body = (await (await route.fetch()).json()) as { entity: { dailymed?: string } }
    body.entity.dailymed = SETID
    await route.fulfill({ json: body })
  })
}

test('the side panel for a Drug links to its DailyMed label', async ({ page }) => {
  await simvastatinHasALabel(page)
  await page.goto('./?node=drug:simvastatin')
  const link = page.getByRole('link', { name: /Read the label \(DailyMed\)/ })
  await expect(link).toHaveAttribute('href', URL)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
  await expect(link).toHaveAccessibleName(/opens in a new tab/i)
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await expect(page.locator('.panel')).toContainText('National Library of Medicine')
})

test('a Drug class and a Drug with no label get no DailyMed link', async ({ page }) => {
  for (const key of ['drug:statins', 'drug:nadolol']) {
    await page.goto(`./?node=${key}`)
    await expect(page.locator('.panel__title')).not.toHaveText('…')
    await expect(page.getByRole('link', { name: /DailyMed/ })).toHaveCount(0)
  }
})

test('My meds links each listed medication to its label', async ({ page }) => {
  await simvastatinHasALabel(page)
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('simvastatin')
  await input.press('Enter')
  const about = page.getByRole('region', { name: 'About your medications' })
  const link = about.getByRole('link', {
    name: /Read the label for Simvastatin.*DailyMed.*new tab/i,
  })
  await expect(link).toHaveAttribute('href', URL)
  await expect(link).toHaveAttribute('target', '_blank')
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await input.fill('nadolol')
  await input.press('Enter')
  await expect(about.getByRole('link', { name: /DailyMed/ })).toHaveCount(1)
})
