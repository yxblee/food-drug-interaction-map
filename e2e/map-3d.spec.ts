import { expect, test } from '@playwright/test'

// #70: the 3D map (desktop only; phones get 2D). Asked for in the URL: software WebGL, as here,
// opens 2D by default (map-default.spec.ts).
test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'mobile', '3D is desktop only')
})

test('the view control is two pills with aria-pressed', async ({ page }) => {
  await page.goto('./?view=3d')
  const d2 = page.getByRole('button', { name: '2D', exact: true })
  const d3 = page.getByRole('button', { name: '3D', exact: true })
  await expect(d3).toHaveAttribute('aria-pressed', 'true')
  await expect(d2).toHaveAttribute('aria-pressed', 'false')
  await d2.click()
  await expect(page.locator('svg.graph2d')).toBeVisible()
  await expect(d2).toHaveAttribute('aria-pressed', 'true')
  await expect(d3).toHaveAttribute('aria-pressed', 'false')
  await d3.click()
  await expect(page.locator('.graph3d canvas')).toBeVisible()
})

test('the 3D canvas matches its host, also after a resize', async ({ page }) => {
  await page.goto('./?view=3d')
  const canvas = page.locator('.graph3d canvas')
  await expect(canvas).toBeVisible()
  const sizes = () =>
    page.evaluate(() => {
      const host = document.querySelector('.graph3d')!.getBoundingClientRect()
      const c = document.querySelector('.graph3d canvas')!.getBoundingClientRect()
      return { dw: Math.round(c.width - host.width), dh: Math.round(c.height - host.height) }
    })
  await expect.poll(sizes).toEqual({ dw: 0, dh: 0 })
  await page.setViewportSize({ width: 1000, height: 600 })
  await expect.poll(sizes).toEqual({ dw: 0, dh: 0 })
  // Coming back from another tab or from 2D must not leave a stale size either.
  await page.getByRole('tab', { name: 'My meds' }).click()
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByRole('tab', { name: 'Explore' }).click()
  await expect.poll(sizes).toEqual({ dw: 0, dh: 0 })
  await page.getByRole('button', { name: '2D', exact: true }).click()
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect(canvas).toBeVisible()
  await expect.poll(sizes).toEqual({ dw: 0, dh: 0 })
})

test('keyboard focus: an outline on the map, a ring on the active node', async ({ page }) => {
  await page.goto('./?view=3d')
  const host = page.locator('.graph-host')
  await expect(page.locator('.graph3d canvas')).toBeVisible()
  await host.focus()
  await expect(host).toHaveAttribute('data-active', '')
  // With a node active the ring carries focus; the host outline is for when none is.
  await host.evaluate((el) => el.removeAttribute('data-active'))
  const outline = await host.evaluate((el) => {
    const s = getComputedStyle(el)
    return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }
  })
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThanOrEqual(2)
})
