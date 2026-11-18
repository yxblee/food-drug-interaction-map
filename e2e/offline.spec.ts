import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

const cachedUrls = (page: Page) =>
  page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys())
      for (const req of await (await caches.open(name)).keys()) urls.push(req.url)
    return urls.sort()
  })

test('after one visit, My meds still checks warfarin offline, and says the data is saved', async ({
  page,
  context,
}) => {
  await page.goto('./')
  await expect(page.getByRole('tab', { name: 'My meds' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Showing saved data' })).toHaveCount(0)
  // The worker is in control and has saved the page, a script, the Dataset and every node file.
  await page.evaluate(() => navigator.serviceWorker.ready)
  const { nodes } = await (await page.request.get('api/graph.json')).json()
  await expect
    .poll(async () => {
      const urls = await cachedUrls(page)
      return [
        urls.includes(new URL('./', page.url()).href),
        urls.some((u) => u.endsWith('.js')),
        urls.some((u) => u.endsWith('api/graph.json')),
        urls.filter((u) => u.includes('/api/node/')).length,
      ]
    })
    .toEqual([true, true, true, nodes.length])
  const before = await cachedUrls(page)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('status').filter({ hasText: 'Showing saved data' })).toBeVisible()
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('warfarin')
  await input.press('Enter')
  const caution = page.locator('section.meds__sev', { has: page.locator('#sev-caution') })
  await expect(caution).toContainText('Leafy greens')

  // Entering a medication adds nothing to the cache: the Medication list never leaves storage.
  expect(await cachedUrls(page)).toEqual(before)
})

test('a new worker removes old fdi- caches and leaves other sites caches alone', async ({
  page,
}) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.evaluate(async () => {
    await caches.open('fdi-old-build')
    await caches.open('other-site-cache')
    await (await navigator.serviceWorker.getRegistration())!.unregister()
    await navigator.serviceWorker.register('sw.js?v=next-build')
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain('fdi-old-build')
  expect(await page.evaluate(() => caches.keys())).toContain('other-site-cache')
})
