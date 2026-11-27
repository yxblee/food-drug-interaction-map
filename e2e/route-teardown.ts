import { test } from '@playwright/test'

// For specs that call `page.route`; call it once at the top level of the spec.
// A test can finish while the app is still fetching (My meds loads one node payload per warning),
// leaving handlers in flight when the context closes. Wait for them, so their errors fail the test.
// unrouteAll empties the route list, and the first handler to return then switches interception off
// under the others. The pass-through route, added before any can return, keeps it on.
export function waitForRouteHandlersAtTeardown() {
  test.afterEach(async ({ page }) => {
    const settled = page.unrouteAll({ behavior: 'wait' })
    await page.route('**/*', (route) => route.fallback())
    await settled
  })
}
