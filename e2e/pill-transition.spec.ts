import { expect, test } from '@playwright/test'

// #64: when a pill's selected state changes, its label must stay readable on its own fill
// at every frame. Colours go through a canvas so oklab / color-mix values parse to sRGB.
const sampleContrast = async (selector: string) => {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  const lum = (css: string, under: string) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = under
    ctx.fillRect(0, 0, 1, 1)
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const paper = getComputedStyle(document.body).backgroundColor
  const els = [...document.querySelectorAll(selector)]
  const start = performance.now()
  const frames: { t: number; ratios: number[] }[] = []
  for (const t of [0, 50, 100, 200]) {
    await new Promise((r) => setTimeout(r, Math.max(0, t - (performance.now() - start))))
    const ratios = els.map((el) => {
      const s = getComputedStyle(el)
      const bg = lum(s.backgroundColor, paper)
      const fg = lum(s.color, paper === s.backgroundColor ? paper : s.backgroundColor)
      return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05)
    })
    frames.push({ t, ratios })
  }
  return frames
}

test('tab pills stay readable at every frame of a selection change', async ({ page }) => {
  await page.goto('./')
  const meds = page.getByRole('tab', { name: 'My meds' })
  await expect(meds).toBeVisible()
  // Start sampling in the page, then click from inside it so frame 0 is the click frame.
  const frames = await page.evaluate(
    async ([fn, sel]) => {
      const run = (0, eval)(`(${fn})`) as (s: string) => ReturnType<typeof sampleContrast>
      const sampled = run(sel!)
      ;[...document.querySelectorAll<HTMLElement>(sel!)]
        .find((e) => e.textContent === 'My meds')!
        .click()
      return sampled
    },
    [sampleContrast.toString(), '[role=tab]'] as const,
  )
  await expect(meds).toHaveAttribute('aria-selected', 'true')
  for (const { t, ratios } of frames) {
    for (const r of ratios) expect(r, `contrast at ${t}ms`).toBeGreaterThanOrEqual(4.5)
  }
})

test('reduced motion switches the tab pills with no transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  const durations = await page
    .locator('[role=tab]')
    .evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionDuration))
  for (const d of durations) expect(d.split(',').every((v) => v.trim() === '0s')).toBe(true)
})
