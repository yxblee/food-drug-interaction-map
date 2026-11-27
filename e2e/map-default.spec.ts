import { expect, test, type Page } from '@playwright/test'

// #217: software-rendered WebGL2 opens the 2D map; a GPU still opens 3D. These browsers run on
// SwiftShader, so the first tests see software rendering for real.
test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'mobile', 'phones get 2D with no toggle')
})

const pill = (page: Page, name: '2D' | '3D') => page.getByRole('button', { name, exact: true })

/** Reports `renderer` as the GPU name, and whether the browser sees a major performance caveat. */
async function fakeWebgl(page: Page, renderer: string, caveat: boolean) {
  await page.addInitScript(
    ({ renderer, caveat }) => {
      const gl = WebGL2RenderingContext.prototype
      // oxlint-disable-next-line typescript/unbound-method -- called with .call(this)
      const getParameter = gl.getParameter
      gl.getParameter = function (this: WebGL2RenderingContext, p: number) {
        // 0x9246 is UNMASKED_RENDERER_WEBGL.
        return p === 0x9246 ? renderer : getParameter.call(this, p)
      }
      const canvas = HTMLCanvasElement.prototype as unknown as {
        getContext: (type: string, attrs?: WebGLContextAttributes) => unknown
      }
      // oxlint-disable-next-line typescript/unbound-method -- called with .call(this)
      const getContext = canvas.getContext
      canvas.getContext = function (type, attrs) {
        if (!attrs?.failIfMajorPerformanceCaveat) return getContext.call(this, type, attrs)
        if (caveat) return null
        return getContext.call(this, type, { ...attrs, failIfMajorPerformanceCaveat: false })
      }
    },
    { renderer, caveat },
  )
}

test('software rendering opens the 2D map and still offers 3D', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('svg.graph2d')).toBeVisible()
  await expect(pill(page, '2D')).toHaveAttribute('aria-pressed', 'true')
  await pill(page, '3D').click()
  await expect(page.locator('.graph3d canvas')).toBeVisible()
  await expect(page).toHaveURL(/view=3d/)
})

test('software rendering still gives 3D to a link that asks for it', async ({ page }) => {
  await page.goto('./?view=3d')
  await expect(page.locator('.graph3d canvas')).toBeVisible()
  await expect(pill(page, '3D')).toHaveAttribute('aria-pressed', 'true')
})

test('a GPU opens the 3D map', async ({ page }) => {
  await fakeWebgl(page, 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)', false)
  await page.goto('./')
  await expect(page.locator('.graph3d canvas')).toBeVisible()
  await expect(pill(page, '3D')).toHaveAttribute('aria-pressed', 'true')
})

for (const [how, renderer, caveat] of [
  ['an llvmpipe renderer name', 'llvmpipe (LLVM 15.0.7, 256 bits)', false],
  ['a performance caveat behind a hidden name', 'WebKit WebGL', true],
] as const) {
  test(`${how} counts as software rendering`, async ({ page }) => {
    await fakeWebgl(page, renderer, caveat)
    await page.goto('./')
    await expect(page.locator('svg.graph2d')).toBeVisible()
    await expect(pill(page, '2D')).toHaveAttribute('aria-pressed', 'true')
    await expect(pill(page, '3D')).toBeVisible()
  })
}
