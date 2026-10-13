import { expect, test } from '@playwright/test'

test('search, select and share a food', async ({ page }, info) => {
  await page.goto('./')
  const search = page.getByLabel('Search drugs, foods and mechanisms')
  await search.fill('grapefruit')
  await expect(page.getByText(/\d+ match/)).toBeVisible()
  await search.press('Enter')

  const panel = page.getByRole('complementary')
  await expect(panel.getByRole('heading', { name: 'Grapefruit', exact: true })).toBeVisible()
  const row = panel.locator('li.irow', { hasText: 'Simvastatin' })
  await expect(row.locator('.badge')).toHaveText('Avoid')
  await expect(page).toHaveURL(/node=food%3Agrapefruit/)

  await page.reload()
  await expect(
    page.getByRole('complementary').getByRole('heading', { name: 'Grapefruit', exact: true }),
  ).toBeVisible()

  if (info.project.name === 'mobile') {
    await expect(page.locator('svg.graph2d')).toBeVisible()
    await expect(page.getByRole('button', { name: /^(2D|3D)$/ })).toHaveCount(0)
  } else {
    await expect(page.locator('.graph3d canvas')).toBeVisible()
  }
})

test('search selections are history entries', async ({ page }) => {
  await page.goto('./')
  const search = page.getByLabel('Search drugs, foods and mechanisms')
  await search.fill('grapefruit')
  await search.press('Enter')
  await expect(page).toHaveURL(/node=food%3Agrapefruit/)
  await page.goBack()
  await expect(page).not.toHaveURL(/node=/)
})

test('stale node links clear themselves', async ({ page }) => {
  await page.goto('./?node=drug:no-such-drug')
  await expect(page.locator('.notice')).toContainText('no longer in the dataset')
  await expect(page).not.toHaveURL(/node=/)
})

test('explore controls keep the 16px gutter and a readable search field', async ({ page }) => {
  await page.goto('./')
  const mechanisms = page.getByRole('button', { name: 'Mechanisms' })
  expect((await mechanisms.boundingBox())!.x).toBeGreaterThanOrEqual(16)

  const search = page.getByLabel('Search drugs, foods and mechanisms')
  const [border, placeholder, muted] = await search.evaluate((el) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--muted)'
    document.body.append(probe)
    const m = getComputedStyle(probe).color
    probe.remove()
    return [getComputedStyle(el).borderTopColor, getComputedStyle(el, '::placeholder').color, m]
  })
  expect(border).toBe(muted)
  expect(placeholder).toBe(muted)
})

test('a first visit explains the map and suggests where to start', async ({ page }) => {
  await page.goto('./')
  await page.getByText('How to read the map').click()
  const legend = page.locator('.legend')
  for (const term of ['Drug', 'Food', 'Mechanism', 'Avoid', 'Minimal', 'Color']) {
    await expect(legend).toContainText(term)
  }

  await page.getByRole('button', { name: 'Try grapefruit' }).click()
  await expect(
    page.getByRole('complementary').getByRole('heading', { name: 'Grapefruit', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveURL(/node=food%3Agrapefruit/)
  await expect(page.getByRole('button', { name: 'Try grapefruit' })).toHaveCount(0)
})

test('links carry severity ink before anything is selected', async ({ page }, info) => {
  await page.goto('./')
  if (info.project.name !== 'mobile') await page.getByRole('button', { name: '2D' }).click()
  const avoidLink = page.locator('svg.graph2d .link.sev-avoid').first()
  await expect(avoidLink).toBeAttached()
  await expect(avoidLink).toHaveCSS('stroke', 'rgb(122, 42, 28)')
})

test('keyboard users reach search before any graph node', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.graph-host')).toBeAttached()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const where = await page.evaluate(() => {
      const el = document.activeElement
      if (el?.closest('.graph-host')) return 'graph'
      return el?.getAttribute('aria-label') === 'Search drugs, foods and mechanisms' ? 'search' : ''
    })
    expect(where).not.toBe('graph')
    if (where === 'search') return
  }
  throw new Error('search not reached within 12 tabs')
})

test('picking a search result closes the list until you type again', async ({ page }) => {
  await page.goto('./')
  const search = page.getByLabel('Search drugs, foods and mechanisms')
  await search.fill('grapefruit')
  const results = page.locator('.search__results')
  await results
    .getByRole('button', { name: /Grapefruit$/ })
    .first()
    .click()
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(results).toHaveCount(0)

  await search.fill('grape')
  await expect(results).toBeVisible()
})

test('a search with no match suggests a next step and says absence is not safety', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByLabel('Search drugs, foods and mechanisms').fill('Eliquis')
  await expect(page.getByText('0 matches')).toBeVisible()
  await expect(page.getByText('Check the spelling or try the generic name.')).toBeVisible()
  await expect(page.getByText("doesn't mean a combination is safe")).toBeVisible()
})

// Screen-space box of the nodes currently in focus, and the canvas area the panel leaves free.
async function framing(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const host = document.querySelector('.graph-host')!.getBoundingClientRect()
    const panel = document.querySelector('.panel')?.getBoundingClientRect()
    const wide = !panel || panel.width < host.width * 0.9
    const free = {
      left: host.left,
      top: host.top,
      right: panel && wide ? panel.left : host.right,
      bottom: panel && !wide ? panel.top : host.bottom,
    }
    const boxes = [...document.querySelectorAll('svg.graph2d g.node:not(.is-dim)')].map((n) =>
      n.querySelector('.shape')!.getBoundingClientRect(),
    )
    const box = {
      left: Math.min(...boxes.map((b) => b.left)),
      top: Math.min(...boxes.map((b) => b.top)),
      right: Math.max(...boxes.map((b) => b.right)),
      bottom: Math.max(...boxes.map((b) => b.bottom)),
    }
    return { free, box, count: boxes.length }
  })
}

async function expectFramed(page: import('@playwright/test').Page, minCount: number) {
  await expect
    .poll(
      async () => {
        const { free, box, count } = await framing(page)
        const inside =
          box.left >= free.left &&
          box.top >= free.top &&
          box.right <= free.right &&
          box.bottom <= free.bottom
        const share = Math.max(
          (box.right - box.left) / (free.right - free.left),
          (box.bottom - box.top) / (free.bottom - free.top),
        )
        return inside && share >= 0.5 && count >= minCount
      },
      { timeout: 15_000 },
    )
    .toBe(true)
}

test('selecting a food frames it and its neighbours beside the panel', async ({ page }, info) => {
  await page.goto('./')
  if (info.project.name !== 'mobile') await page.getByRole('button', { name: '2D' }).click()
  await page.getByRole('button', { name: 'Try grapefruit' }).click()
  await expect(page.getByRole('complementary')).toBeVisible()
  await expectFramed(page, 2)
})

test('See on map frames the filtered medicines', async ({ page }, info) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('warfarin')
  await input.press('Enter')
  await page.getByRole('button', { name: /See on map/ }).click()
  if (info.project.name !== 'mobile') await page.getByRole('button', { name: '2D' }).click()
  await expect(page.getByRole('button', { name: /Showing your meds/ })).toBeVisible()
  await expectFramed(page, 2)
})

test('the legend closes when the panel opens and can be reopened', async ({ page }, info) => {
  await page.goto('./')
  const legend = page.locator('.legend')
  await legend.getByText('How to read the map').click()
  await expect(legend).toHaveJSProperty('open', true)
  await page.getByRole('button', { name: 'Try grapefruit' }).click()
  await expect(page.getByRole('complementary')).toBeVisible()
  await expect(legend).toHaveJSProperty('open', false)
  if (info.project.name === 'mobile') return // the panel covers the legend there
  await legend.getByText('How to read the map').click()
  await expect(legend).toHaveJSProperty('open', true)
})

// Names of the 2D labels that are actually drawn (display: none removes them).
const shownLabels = (page: import('@playwright/test').Page, sel: string) =>
  page.evaluate(
    (s) =>
      [...document.querySelectorAll(`svg.graph2d g.node${s} .label`)]
        .filter((l) => getComputedStyle(l).display !== 'none')
        .map((l) => l.textContent),
    sel,
  )

test('2D labels show for groups at rest and for the selection with its neighbours', async ({
  page,
}, info) => {
  await page.goto('./')
  if (info.project.name !== 'mobile') await page.getByRole('button', { name: '2D' }).click()
  await expect(page.locator('svg.graph2d g.node').first()).toBeAttached()
  await expect.poll(() => shownLabels(page, '.node--group')).not.toHaveLength(0)
  expect(await shownLabels(page, ':not(.node--group)')).toHaveLength(0)
  // Names stay in the accessible names.
  await expect(page.getByRole('button', { name: 'Food: Grapefruit' })).toBeAttached()

  await page.getByRole('button', { name: 'Try grapefruit' }).click()
  await expect.poll(() => shownLabels(page, ':not(.node--group)')).toContain('GRAPEFRUIT')
  expect(await shownLabels(page, ':not(.node--group)')).toContain('SIMVASTATIN')
})

test('the mobile panel leaves room for the framed selection', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile')
  await page.goto('./')
  await page.getByRole('button', { name: 'Try grapefruit' }).click()
  const panel = page.getByRole('complementary')
  await expect(panel).toBeVisible()
  const h = await panel.evaluate((p) => p.getBoundingClientRect().height / innerHeight)
  expect(h).toBeLessThanOrEqual(0.6)
})

test('the grapefruit hint is hidden while showing your meds', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Try grapefruit' })).toBeVisible()
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('warfarin')
  await input.press('Enter')
  await page.getByRole('button', { name: /See on map/ }).click()
  await expect(page.getByRole('button', { name: /Showing your meds/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try grapefruit' })).toHaveCount(0)
})
