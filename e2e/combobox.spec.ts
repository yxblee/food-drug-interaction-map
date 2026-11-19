import { expect, test, type Locator, type Page } from '@playwright/test'

/** Resolve any CSS colour (colour-mix, oklch, rgb) to [r,g,b] via a canvas. */
async function rgbOf(page: Page, css: string): Promise<number[]> {
  return page.evaluate((c) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = '#000'
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 1, 1)
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
  }, css)
}
const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a: number[], b: number[]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The active option's indicator (left bar) against the list, and its text against its fill. */
async function activeContrast(page: Page, option: Locator, list: Locator) {
  const s = await option.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { bg: cs.backgroundColor, color: cs.color, shadow: cs.boxShadow }
  })
  const listBg = await list.evaluate((el) => getComputedStyle(el).backgroundColor)
  const bar = /(rgba?\([^)]*\)|color\([^)]*\)|oklch\([^)]*\))/.exec(s.shadow)?.[1] ?? 'transparent'
  return {
    indicator: ratio(await rgbOf(page, bar), await rgbOf(page, listBg)),
    text: ratio(await rgbOf(page, s.color), await rgbOf(page, s.bg)),
  }
}

/** Polled: colours transition after a theme switch, so a single sample can land mid-fade. */
const expectContrast = (page: Page, option: Locator, list: Locator) =>
  expect
    .poll(async () => {
      const c = await activeContrast(page, option, list)
      return c.indicator >= 3 && c.text >= 4.5
    })
    .toBe(true)

const SETUPS: [string, (p: Page) => Promise<void>][] = [
  ['light', (p) => p.emulateMedia({ colorScheme: 'light' })],
  ['dark', (p) => p.emulateMedia({ colorScheme: 'dark' })],
  [
    'color palette',
    async (p) => {
      await p.emulateMedia({ colorScheme: 'light' })
      await p.getByRole('button', { name: 'Color', exact: true }).click()
    },
  ],
]

const exploreBox = (page: Page) => page.getByLabel('Search drugs, foods and mechanisms')

for (const [name, setup] of SETUPS) {
  test(`active option is visible in ${name}: Explore, Add a medication, Food check`, async ({
    page,
  }) => {
    await page.goto('./')
    await setup(page)
    await exploreBox(page).fill('gra')
    const list = page.getByRole('listbox', { name: 'Matching drugs, foods and mechanisms' })
    await expectContrast(page, list.getByRole('option').first(), list)

    await page.getByRole('tab', { name: 'My meds' }).click()
    for (const [label, q, listName] of [
      ['Add a medication', 'war', 'Matching medications'],
      ['Can I have…?', 'gra', 'Matching foods'],
    ]) {
      await page.getByLabel(label).fill(q)
      const l = page.getByRole('listbox', { name: listName })
      await expectContrast(page, l.getByRole('option').first(), l)
    }
  })
}

test('every option is at least 44px tall in all three boxes', async ({ page }) => {
  await page.goto('./')
  await exploreBox(page).fill('gra')
  for (const h of await page
    .getByRole('option')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height)))
    expect(h).toBeGreaterThanOrEqual(44)
  await page.getByRole('tab', { name: 'My meds' }).click()
  for (const [label, q] of [
    ['Add a medication', 'a'],
    ['Can I have…?', 'a'],
  ]) {
    await page.getByLabel(label).fill(q)
    const hs = await page
      .getByRole('option')
      .evaluateAll((els) =>
        els.filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().height),
      )
    expect(hs.length).toBeGreaterThan(0)
    for (const h of hs) expect(h).toBeGreaterThanOrEqual(44)
    await page.getByLabel(label).fill('')
  }
})

test('Explore results overlay the map and do not move the pills', async ({ page }) => {
  await page.goto('./')
  const pill = page.getByRole('button', { name: 'Mechanisms' })
  const before = (await pill.boundingBox())!.y
  await exploreBox(page).fill('a')
  await expect(page.getByRole('option').first()).toBeVisible()
  expect((await pill.boundingBox())!.y).toBe(before)
})

test('Escape closes the list first, clears on the second press; leaving closes it', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  for (const [label, q, listName] of [
    ['Add a medication', 'war', 'Matching medications'],
    ['Can I have…?', 'gra', 'Matching foods'],
  ]) {
    const input = page.getByLabel(label)
    const list = page.getByRole('listbox', { name: listName })
    await input.fill(q)
    await expect(list).toBeVisible()
    await input.press('Escape')
    await expect(list).toBeHidden()
    await expect(input).toHaveValue(q)
    await input.press('Escape')
    await expect(input).toHaveValue('')
    await input.fill(q)
    await expect(list).toBeVisible()
    await page.getByRole('heading', { name: 'Foods to watch' }).click()
    await expect(list).toBeHidden()
    await input.fill('')
  }
  await page.getByRole('tab', { name: 'Explore' }).click()
  const search = exploreBox(page)
  const list = page.getByRole('listbox', { name: 'Matching drugs, foods and mechanisms' })
  await search.fill('gra')
  await search.press('Escape')
  await expect(list).toBeHidden()
  await expect(search).toHaveValue('gra')
  await search.press('Escape')
  await expect(search).toHaveValue('')
})

test('clear button: named, ink, 44px, empties the box and keeps focus', async ({ page }) => {
  await page.goto('./')
  const search = exploreBox(page)
  await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCount(0)
  await search.fill('gra')
  const clear = page.getByRole('button', { name: 'Clear search' })
  const box = (await clear.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  const [color, ink] = await clear.evaluate((el) => {
    const p = document.createElement('i')
    p.style.color = 'var(--ink)'
    document.body.append(p)
    const i = getComputedStyle(p).color
    p.remove()
    return [getComputedStyle(el).color, i]
  })
  expect(color).toBe(ink)
  await clear.click()
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()
  await page.getByRole('tab', { name: 'My meds' }).click()
  await page.getByLabel('Add a medication').fill('war')
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByLabel('Add a medication')).toHaveValue('')
  await expect(page.getByLabel('Add a medication')).toBeFocused()
})

test('clicking an option with a mouse keeps focus in the input', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Can I have…?')
  await input.fill('grapefruit')
  await page.getByRole('option').first().click()
  await expect(input).toBeFocused()
  const meds = page.getByLabel('Add a medication')
  await meds.fill('warfarin')
  await page.getByRole('option').first().click()
  await expect(meds).toBeFocused()
  await expect(page.getByRole('list', { name: 'Your medications' })).toContainText('Warfarin')
})

test('the "/" hint shows only with a fine pointer', async ({ page }) => {
  await page.goto('./')
  const fine = await page.evaluate(() => matchMedia('(pointer: fine)').matches)
  const ph = await exploreBox(page).getAttribute('placeholder')
  expect(ph!.includes('/')).toBe(fine)
})

test('My meds: Tab from the last chip lands on Clear all; remove buttons never overlap', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const m of ['warfarin', 'simvastatin', 'amlodipine', 'metformin', 'lisinopril']) {
    await input.fill(m)
    await input.press('Enter')
  }
  const removes = page.getByRole('list', { name: 'Your medications' }).getByRole('button')
  const n = await removes.count()
  expect(n).toBeGreaterThan(2)
  const boxes = []
  for (let i = 0; i < n; i++) boxes.push((await removes.nth(i).boundingBox())!)
  for (const b of boxes) {
    expect(b.width).toBeGreaterThanOrEqual(44)
    expect(b.height).toBeGreaterThanOrEqual(44)
  }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const [a, b] = [boxes[i], boxes[j]]
      const overlap =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
      expect(overlap, `remove ${i} overlaps ${j}`).toBe(false)
    }
  await removes.nth(n - 1).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Clear all' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'See on map' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Print' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Copy' })).toBeFocused()
  await expect(page.locator('.meds__actions .pill-label')).toHaveCount(4)
})

test('empty Explore box browses every Drug and Food A-Z; keyboard opens one', async ({ page }) => {
  await page.goto('./')
  const search = exploreBox(page)
  const list = page.getByRole('listbox', { name: 'Matching drugs, foods and mechanisms' })
  await search.focus()
  await expect(list).toBeVisible()
  await expect(list.getByRole('group', { name: 'Drugs' })).toBeVisible()
  await expect(list.getByRole('group', { name: 'Foods' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /\d+ Drugs?, \d+ Foods?/ })).toBeVisible()
  const names = await list
    .getByRole('group', { name: 'Drugs' })
    .getByRole('option')
    .evaluateAll((els) => els.map((e) => e.querySelector('[data-name]')!.textContent!))
  expect(names.length).toBeGreaterThan(1)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  // Every row shows its Interaction count and is at least 44px tall.
  const first = list.getByRole('option').first()
  await expect(first).toContainText(/\d+ Interactions?/)
  expect((await first.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  await search.press('ArrowDown')
  await search.press('Enter')
  await expect(list).toBeHidden()
  await expect(page).toHaveURL(/node=drug(%3A|:)/)

  await search.press('ArrowDown')
  await expect(list).toBeVisible()
  await search.press('Escape')
  await expect(list).toBeHidden()
  await expect(search).toBeFocused()
})

test('browse list does not cover the Interactions panel controls', async ({ page }) => {
  await page.goto('./')
  await exploreBox(page).focus()
  const list = page.getByRole('listbox', { name: 'Matching drugs, foods and mechanisms' })
  const box = (await list.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
})
