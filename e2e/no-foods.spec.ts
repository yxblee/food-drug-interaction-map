import { expect, test, type Page } from '@playwright/test'

// Every Drug in the shipped Dataset has Foods to watch (itself or through its class), so the
// fixture takes Adenosine's Interactions away.
async function open(page: Page, meds: string[]) {
  await page.route('**/api/graph.json', async (route) => {
    const body = (await (await route.fetch()).json()) as { interactions: { drug: string }[] }
    body.interactions = body.interactions.filter((i) => i.drug !== 'adenosine')
    await route.fulfill({ json: body })
  })
  await page.goto('./?tab=meds')
  const input = page.getByLabel('Add a medication')
  for (const med of meds) {
    await input.fill(med)
    await input.press('Enter')
  }
}

const results = (page: Page) => page.getByRole('region', { name: 'Foods to watch' })
const line = (page: Page) => results(page).getByText(/^No Foods to watch in our dataset for/)
const allNone = (page: Page) => results(page).getByText(/^No food interactions in our dataset/)

for (const size of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: '375px', width: 375, height: 740 },
]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height } })

    test('a mixed list names only the Medications with no Foods to watch', async ({ page }) => {
      // Citalopram has only its class's (SSRIs) Interaction; Zzyzxine is not checked.
      await open(page, ['warfarin', 'adenosine', 'citalopram', 'Zzyzxine'])
      await expect(line(page)).toHaveText(
        "No Foods to watch in our dataset for Adenosine. Our dataset is not exhaustive. Ask your pharmacist if you're unsure.",
      )
      await expect(results(page).getByText(/^Not checked: Zzyzxine\./)).toBeVisible()
      await expect(allNone(page)).toHaveCount(0)

      // After the last Severity group, and inside the screen.
      const lastGroup = await results(page).locator('section.meds__sev').last().boundingBox()
      const box = (await line(page).boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(lastGroup!.y + lastGroup!.height)
      expect(box.x + box.width).toBeLessThanOrEqual(size.width)

      await page.emulateMedia({ media: 'print' })
      await expect(line(page)).toBeVisible()
    })

    test('a list where every Medication has none keeps only the one message', async ({ page }) => {
      await open(page, ['adenosine', 'Zzyzxine'])
      await expect(allNone(page)).toBeVisible()
      await expect(line(page)).toHaveCount(0)
    })

    test('a list where every Medication has Foods to watch shows no line', async ({ page }) => {
      await open(page, ['warfarin', 'citalopram'])
      await expect(results(page).locator('section.meds__sev').first()).toBeVisible()
      await expect(line(page)).toHaveCount(0)
    })
  })
}
