import { expect, test } from '@playwright/test'
import { waitForRouteHandlersAtTeardown } from './route-teardown.ts'

waitForRouteHandlersAtTeardown()

// #154: when the 3D chunk cannot load, the map falls back to 2D with a notice and a retry.
test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'mobile', '3D is desktop only')
})

test('a blocked 3D chunk shows the 2D map, a notice, and Try 3D again recovers', async ({
  page,
}) => {
  let blocked = true
  await page.route(/render3d/, (route) => (blocked ? route.abort() : route.continue()))
  await page.goto('./?view=3d')
  await expect(page.locator('svg.graph2d')).toBeVisible()
  const notice = page.getByRole('status').filter({ hasText: 'could not load' })
  await expect(notice).toBeVisible()
  // The URL's view preference is not rewritten by the fallback.
  expect(new URL(page.url()).searchParams.get('view')).toBe('3d')

  const retry = page.getByRole('button', { name: 'Try 3D again' })
  await retry.focus()
  await expect(retry).toBeFocused()

  blocked = false
  await retry.click()
  await expect(page.locator('.graph3d canvas')).toBeVisible()
  await expect(page.getByText('could not load')).toBeHidden()
})
