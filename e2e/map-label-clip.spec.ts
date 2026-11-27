import { expect, test } from '@playwright/test'

// #137: a 2D label clipped by the map edge reads as a different word, so it is hidden;
// the selected label is nudged inside instead. Compared against the container (CI fonts differ).
for (const size of [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
]) {
  for (const path of ['./?view=3d', './?view=3d&node=food:grapefruit']) {
    test(`visible 2D labels lie inside the map at ${size.width}x${size.height} (${path})`, async ({
      page,
    }) => {
      await page.setViewportSize(size)
      await page.goto(path)
      // Phones ignore ?view=3d; desktop opens 3D and has the 2D pill. Wait for whichever shows.
      const d2 = page.getByRole('button', { name: '2D', exact: true })
      await d2.or(page.locator('svg.graph2d')).first().waitFor()
      if (await d2.isVisible()) await d2.click()
      await expect(page.locator('svg.graph2d')).toBeVisible()
      await expect(page.locator('svg.graph2d text.label').first()).toBeAttached()
      // Let the fit and label pass settle.
      await page.waitForTimeout(800)
      const outside = await page.evaluate(() => {
        const host = document.querySelector('.graph-host')!.getBoundingClientRect()
        const slack = 2
        const bad: string[] = []
        let visible = 0
        for (const el of document.querySelectorAll<SVGTextElement>('svg.graph2d text.label')) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden') continue
          visible++
          const r = el.getBoundingClientRect()
          if (
            r.left < host.left - slack ||
            r.right > host.right + slack ||
            r.top < host.top - slack ||
            r.bottom > host.bottom + slack
          )
            bad.push(el.textContent ?? '')
        }
        return { bad, visible }
      })
      expect(outside.visible).toBeGreaterThan(0)
      expect(outside.bad).toEqual([])
    })
  }
}
