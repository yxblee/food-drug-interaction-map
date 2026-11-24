import { expect, test, type Page } from '@playwright/test'

const LONG = ['warfarin', 'levothyroxine', 'ciprofloxacin', 'metformin']
const SHORT = ['metformin']

const rows = (page: Page) => page.locator('section[aria-labelledby^="sev-"] li.warning')
async function open(page: Page, meds: string[]) {
  await page.goto('./?tab=meds')
  const input = page.getByLabel('Add a medication')
  for (const m of meds) {
    await input.fill(m)
    await input.press('Enter')
  }
  await expect(rows(page).first()).toBeVisible()
}

test('a short list looks as it does today: no jump links, no collapsed rows', async ({ page }) => {
  await open(page, SHORT)
  expect(await rows(page).count()).toBeLessThanOrEqual(5)
  await expect(page.getByRole('navigation', { name: 'Jump to severity' })).toHaveCount(0)
  // Avoid and Caution keep their advice up front, not behind a summary.
  await expect(
    page.locator('.meds__sev:has(#sev-avoid, #sev-caution) li.warning > details'),
  ).toHaveCount(0)
})

test('a long list collapses every Food to one line that opens to its advice', async ({ page }) => {
  await open(page, LONG)
  expect(await rows(page).count()).toBeGreaterThan(5)
  const all = await rows(page).count()
  await expect(page.locator('section[aria-labelledby^="sev-"] li.warning > details')).toHaveCount(
    all,
  )
  await expect(
    page.locator('section[aria-labelledby^="sev-"] li.warning > details[open]'),
  ).toHaveCount(0)
  // Name, Drugs and Severity badge on the one line.
  const first = page
    .locator('section[aria-labelledby^="sev-"] li.warning > details > summary')
    .first()
  await expect(first.locator('.warning__name')).toBeVisible()
  await expect(first.locator('.warning__drugs')).toBeVisible()
  await expect(first.locator('.sev-badge, [class*="badge"]').first()).toBeVisible()
  // Opening shows the advice.
  await first.click()
  await expect(
    page.locator('section[aria-labelledby^="sev-"] li.warning > details[open] .irow').first(),
  ).toBeVisible()
})

test('a jump link moves focus to its Severity heading', async ({ page }) => {
  await open(page, LONG)
  const nav = page.getByRole('navigation', { name: 'Jump to severity' })
  await expect(nav).toBeVisible()
  const links = nav.getByRole('link')
  expect(await links.count()).toBeGreaterThanOrEqual(2)
  const last = links.last()
  const target = (await last.getAttribute('href'))!.slice(1)
  await last.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator(`#${target}`)).toBeFocused()
})

test('print keeps every row expanded', async ({ page }) => {
  await open(page, LONG)
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.warning')].every((w) => w.querySelector('.irow')),
  )
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await expect(
    page.locator('section[aria-labelledby^="sev-"] li.warning > details:not([open])'),
  ).toHaveCount(0)
})
