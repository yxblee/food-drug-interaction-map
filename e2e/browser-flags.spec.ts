import { expect, test } from '@playwright/test'

// #228: `--use-angle=swiftshader` also moved compositing onto SwiftShader. Under load the app's
// synchronous WebGL2 probe then queued behind those frames for seconds and e2e expects timed out.
// Only WebGL belongs on SwiftShader: see the launch flags in playwright.config.ts.
test('SwiftShader draws WebGL only, not the page', async ({ page, browser }) => {
  const cdp = await browser.newBrowserCDPSession()
  // The protocol types `featureStatus` as an untyped object.
  const { gpu } = (await cdp.send('SystemInfo.getInfo')) as unknown as {
    gpu: { featureStatus?: { gpu_compositing?: string } }
  }
  expect(gpu.featureStatus?.gpu_compositing).toBe('disabled_software')

  // 3D specs still need a WebGL2 context, and map-default.spec.ts needs it to be a software one.
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null
  })
  expect(renderer).toContain('SwiftShader')
})
