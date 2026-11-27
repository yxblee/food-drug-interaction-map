import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// No rule is excluded or disabled.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Fails with one "rule-id: target selector" line per violation. */
async function expectNoViolations(page: Page) {
  // axe skips hidden content, so open every disclosure first.
  await page
    .locator('details')
    .evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true)))
  const { width, height } = page.viewportSize()!
  // Twice: the real screen, then one tall enough to unclip scrolled text, which axe cannot
  // measure for contrast.
  for (const h of [height, 20_000]) {
    await page.setViewportSize({ width, height: h })
    const { violations, passes } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(
      violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} (${n.failureSummary})`),
      ),
    ).toEqual([])
    // Guards against a vacuous pass: contrast must have been measured on something.
    if (h !== height) expect(passes.map((p) => p.id)).toContain('color-contrast')
  }
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe WCAG 2.2 AA, ${colorScheme}`, () => {
    // Reduced motion: no colour is measured mid-transition.
    test.use({ colorScheme, contextOptions: { reducedMotion: 'reduce' } })

    test('My meds, empty', async ({ page }) => {
      await page.goto('./?tab=meds')
      await expect(page.getByLabel('Add a medication')).toBeEnabled()
      await expectNoViolations(page)
    })

    test('My meds, with medications listed', async ({ page }) => {
      await page.goto('./?tab=meds')
      const input = page.getByLabel('Add a medication')
      // A brand name, a second Drug and an unknown name: every chip style.
      for (const name of ['Coumadin', 'Simvastatin', 'Notarealdrug']) {
        await input.fill(name)
        await input.press('Enter')
      }
      await expect(page.getByText('Not checked:')).toBeVisible()
      // Each warning row loads its advice separately.
      await expect(page.locator('li.warning').first()).toBeVisible()
      await expect(page.locator('li.warning:not(:has(li.irow))')).toHaveCount(0)
      await expectNoViolations(page)
    })

    test('Explore, 2D map with a Food panel', async ({ page }) => {
      // `view=2d`: the 3D canvas is out of scope for axe.
      await page.goto('./?view=2d&node=food:grapefruit')
      await expect(page.locator('svg.graph2d')).toBeVisible()
      await expect(page.getByRole('complementary').locator('li.irow').first()).toBeVisible()
      await expectNoViolations(page)
    })

    test('About the data', async ({ page }) => {
      await page.goto('./?view=2d')
      await page.getByRole('button', { name: 'About the data' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      // axe misreads the modal's top layer as overlapped and measures no contrast in it. The
      // page behind is inert and covered by the tests above.
      await page.addStyleTag({ content: '.app > :not(dialog) { visibility: hidden !important }' })
      await expectNoViolations(page)
    })
  })
}
