import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// No rule is excluded or disabled. Not covered: axe gives no contrast verdict ("incomplete") for
// text drawn over the 2D map (node labels, legend, frosted controls); theme/tokens.test.ts
// guards the colour pairs.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Fails with a "rule-id: target selector" entry per violating element. `content` is a selector for
 * the part under test, where contrast must have been measured.
 */
async function expectNoViolations(page: Page, content: string) {
  const { width } = page.viewportSize()!
  // First as the person lands on it. Then with every disclosure open, which axe otherwise skips,
  // on a screen tall enough to unclip scrolled text, which axe cannot measure for contrast.
  for (const expanded of [false, true]) {
    if (expanded) {
      await page
        .locator('details')
        .evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true)))
      await page.setViewportSize({ width, height: 20_000 })
    }
    const { violations, passes } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    expect(
      violations.flatMap((v) =>
        v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} (${n.failureSummary})`),
      ),
    ).toEqual([])
    if (!expanded) continue
    // Guards against a vacuous pass.
    const measured = passes.find((p) => p.id === 'color-contrast')?.nodes ?? []
    expect(
      await page.evaluate(
        ([selectors, within]) => selectors.some((s) => document.querySelector(s)?.closest(within)),
        [measured.map((n) => n.target.join(' ')), content] as const,
      ),
      `contrast measured inside ${content}`,
    ).toBe(true)
  }
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`axe WCAG 2.2 AA, ${colorScheme}`, () => {
    // Reduced motion: no colour is measured mid-transition.
    test.use({ colorScheme, contextOptions: { reducedMotion: 'reduce' } })
    // Two axe runs per view, the second over every row, are slow on CI.
    test.slow()

    test('My meds, empty', async ({ page }) => {
      await page.goto('./?tab=meds')
      await expect(page.getByLabel('Add a medication')).toBeEnabled()
      await expectNoViolations(page, '.meds__picker')
    })

    test('My meds, with a Medication list', async ({ page }) => {
      await page.goto('./?tab=meds')
      const input = page.getByLabel('Add a medication')
      // A Brand name, a Drug and a name outside the Dataset: every chip style.
      for (const name of ['Coumadin', 'Simvastatin', 'Notarealdrug']) {
        await input.fill(name)
        await input.press('Enter')
      }
      const chips = page.getByRole('list', { name: 'Your medications' })
      for (const name of ['Warfarin (Coumadin)', 'Simvastatin', 'Notarealdrug'])
        await expect(chips).toContainText(name)
      await expect(page.getByText('Not checked:')).toBeVisible()
      // Each Food warning loads its advice separately.
      await expect(page.locator('li.warning').first()).toBeVisible()
      await expect(page.locator('li.warning:not(:has(li.irow))')).toHaveCount(0)
      await expectNoViolations(page, 'li.irow')
    })

    test('Explore, 2D map with a Food panel', async ({ page }) => {
      // `view=2d`: the 3D canvas is out of scope for axe.
      await page.goto('./?view=2d&node=food:grapefruit')
      // The nodes land after the empty svg does, past the default 5 s on a loaded runner.
      await expect(page.locator('svg.graph2d g.node').first()).toBeAttached({ timeout: 20_000 })
      await expect(page.getByRole('complementary').locator('li.irow').first()).toBeVisible()
      await expectNoViolations(page, 'li.irow')
    })

    test('About the data', async ({ page }) => {
      await page.goto('./?view=2d')
      await page.getByRole('button', { name: 'About the data' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      // axe misreads the modal's top layer as overlapped and measures no contrast in it. The
      // page behind is inert and covered by the tests above.
      await page.addStyleTag({ content: '.app > :not(dialog) { visibility: hidden !important }' })
      await expectNoViolations(page, 'dialog')
    })
  })
}
