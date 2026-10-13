import { expect, test } from '@playwright/test'

test('add a brand-name med, see foods to watch, persist across reload', async ({ page }) => {
  const apiCalls: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/')) apiCalls.push(r.url())
  })

  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('Coumadin')
  await input.press('Enter')

  const chips = page.getByRole('list', { name: 'Your medications' })
  await expect(chips).toContainText('Warfarin (Coumadin)')
  const caution = page.locator('section.meds__sev', { has: page.locator('#sev-caution') })
  await expect(caution).toContainText('Leafy greens')

  await page.reload()
  await expect(page.getByRole('list', { name: 'Your medications' })).toContainText(
    'Warfarin (Coumadin)',
  )

  await page.getByRole('button', { name: 'Remove Warfarin' }).click()
  await input.fill('warfarin')
  await input.press('Enter')
  await expect(chips).not.toContainText('Coumadin')
  await page.reload()
  await expect(page.getByRole('list', { name: 'Your medications' })).not.toContainText('Coumadin')

  expect(apiCalls.some((u) => /warfarin|coumadin/i.test(u))).toBe(false)
})

test('each affected drug shows its own severity inside a food warning', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const med of ['simvastatin', 'amlodipine']) {
    await input.fill(med)
    await input.press('Enter')
  }

  const avoid = page.locator('section.meds__sev', { has: page.locator('#sev-avoid') })
  const grapefruit = avoid.locator('.warning__lead', { hasText: 'Grapefruit' })
  await expect(grapefruit.locator('.warning__drug', { hasText: 'Simvastatin' })).not.toContainText(
    'Minimal',
  )
  await expect(grapefruit.locator('.warning__drug', { hasText: 'Amlodipine' })).toContainText(
    'Minimal',
  )
  await expect(grapefruit.locator('.warning__drugs')).toContainText(
    'no meaningful effect on Amlodipine',
  )
  await expect(grapefruit.locator('.warning__drugs')).not.toContainText('affects Simvastatin, Amlo')
})

test('Avoid and Caution show advice up front, with one disclosure for the detail and one Severity badge per group', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const med of ['simvastatin', 'amlodipine']) {
    await input.fill(med)
    await input.press('Enter')
  }

  const avoid = page.locator('section.meds__sev', { has: page.locator('#sev-avoid') })
  const warning = avoid.locator('.warning', { hasText: 'Grapefruit' })
  const simva = warning.locator('li.irow', { hasText: 'Simvastatin' })
  await expect(simva.locator('.irow__advice')).toBeVisible()
  await expect(simva.locator('.irow__advice')).toContainText('What to do:')
  const more = simva.locator('details.irow__more')
  await expect(more.getByText('Sources', { exact: true })).toBeHidden()
  await expect(more.getByText('Mechanism', { exact: true })).toBeHidden()
  await more.locator('summary').click()
  await expect(more.getByText('Sources', { exact: true })).toBeVisible()
  await expect(more.getByText('Mechanism', { exact: true })).toBeVisible()
  // One level only: no disclosure inside the disclosure.
  await expect(more.locator('details')).toHaveCount(0)
  await expect(warning.locator('.warning > details')).toHaveCount(0)

  // "Avoid" once (the group heading); Amlodipine's own Minimal badge still shows.
  await expect(avoid.locator('.badge', { hasText: /^Avoid$/ })).toHaveCount(1)
  await expect(warning.locator('.badge', { hasText: /^Minimal$/ }).first()).toBeVisible()
  await expect(warning.locator('.badge', { hasText: /^Avoid$/ })).toHaveCount(0)

  // Monitor and Minimal rows stay collapsed.
  const collapsed = page.locator('section.meds__sev:has(#sev-minimal) .warning > details').first()
  if (await collapsed.count()) await expect(collapsed).not.toHaveAttribute('open', '')
})

test('no-match in My meds gives a next step and says absence is not safety', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  await page.getByLabel('Add a medication').fill('Eliquis')
  await expect(page.getByText('Check the spelling or try the generic name.')).toBeVisible()
  await expect(page.getByText("doesn't mean a combination is safe")).toBeVisible()
  await expect(page.getByRole('option', { name: 'Add “Eliquis” as not checked' })).toBeVisible()
})

test('a brand name for a med already listed says so instead of "no match"', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('warfarin')
  await input.press('Enter')

  await input.fill('Coumadin')
  await expect(page.getByText('No match in our dataset')).toHaveCount(0)
  await input.press('Enter')

  await expect(page.getByRole('status').filter({ hasText: 'already on your list' })).toContainText(
    'Warfarin (Coumadin) is already on your list',
  )
  const chips = page.getByRole('list', { name: 'Your medications' }).getByRole('listitem')
  await expect(chips).toHaveCount(1)
  await expect(chips.first()).toBeFocused()
})

test('results are announced and controls are readable and easy to hit', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const med of ['warfarin', 'simvastatin']) {
    await input.fill(med)
    await input.press('Enter')
  }

  await expect(page.getByRole('status').filter({ hasText: 'foods to watch' })).toHaveText(
    /^\d+ foods to watch, 1 to avoid$/,
  )

  const minHit = async (box: { width: number; height: number } | null, dims: 'h' | 'wh') => {
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    if (dims === 'wh') expect(box!.width).toBeGreaterThanOrEqual(44)
  }
  await minHit(await page.getByRole('button', { name: 'Remove Warfarin' }).boundingBox(), 'wh')
  await minHit(await page.locator('.warning summary').first().boundingBox(), 'h')

  const colors = await input.evaluate((el) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--muted)'
    document.body.append(probe)
    const muted = getComputedStyle(probe).color
    probe.remove()
    return {
      muted,
      border: getComputedStyle(el).borderTopColor,
      placeholder: getComputedStyle(el, '::placeholder').color,
    }
  })
  expect(colors.border).toBe(colors.muted)
  expect(colors.placeholder).toBe(colors.muted)
})

test('an unknown medicine is kept as "not checked", announced, and never sent to the API', async ({
  page,
}) => {
  const apiCalls: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/api/')) apiCalls.push(r.url())
  })
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('warfarin')
  await input.press('Enter')
  await input.fill('Eliquis')
  await input.press('Enter')

  await expect(page.getByRole('status').first()).toHaveText(
    'No match in our dataset. Eliquis added as not checked',
  )
  const chip = page
    .getByRole('list', { name: 'Your medications' })
    .getByRole('listitem')
    .filter({ hasText: 'Eliquis' })
  await expect(chip).toContainText('not checked')
  await expect(
    page.getByText("Not checked: Eliquis. Being missing here doesn't mean it's safe;"),
  ).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'foods to watch' })).toContainText(
    '1 not checked',
  )

  await page.reload()
  await expect(page.getByRole('list', { name: 'Your medications' })).toContainText('Eliquis')
  expect(apiCalls.some((u) => /eliquis/i.test(u))).toBe(false)

  await page.getByRole('button', { name: 'Remove Eliquis' }).click()
  await expect(page.getByText('Not checked: Eliquis')).toHaveCount(0)
})

test('an unknown name can be added from the suggestion list', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  await page.getByLabel('Add a medication').fill('Eliquis')
  await page.getByRole('option', { name: 'Add “Eliquis” as not checked' }).click()
  await expect(page.getByRole('list', { name: 'Your medications' })).toContainText('Eliquis')
  await expect(page.getByText('Not checked: Eliquis.')).toBeVisible()
})

test('Clear all announces, returns focus to the input, and Undo restores both lists', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('Coumadin')
  await input.press('Enter')
  await input.fill('Eliquis')
  await input.press('Enter')

  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page.getByRole('status').first()).toHaveText('List cleared · Undo')
  await expect(input).toBeFocused()
  await expect(page.getByRole('list', { name: 'Your medications' })).not.toContainText('Warfarin')

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(input).toBeFocused()
  const chips = page.getByRole('list', { name: 'Your medications' })
  await expect(chips).toContainText('Warfarin (Coumadin)')
  await expect(chips).toContainText('Eliquis')
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
})

test('Severity headings announce the word once', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('Coumadin')
  await input.press('Enter')
  const headings = page.getByRole('heading', { level: 3 })
  await expect(headings.first()).toBeVisible()
  for (const h of await headings.all()) {
    await expect(h).toHaveAccessibleName(/^(Avoid|Caution|Monitor|Minimal)$/)
  }
})

test('medication suggestions are a combobox over a listbox', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByRole('combobox', { name: 'Add a medication' })
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await input.fill('a')
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  const options = page.getByRole('listbox').getByRole('option')
  expect(await options.count()).toBeGreaterThan(1)
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  const second = options.nth(1)
  const secondId = await second.getAttribute('id')
  await input.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-activedescendant', secondId!)
  await expect(second).toHaveAttribute('aria-selected', 'true')
  const label = (await second.textContent())!.split('(')[0]!.replace('· on your list', '').trim()
  await input.press('Enter')
  await expect(page.getByRole('list', { name: 'Your medications' })).toContainText(label)

  await input.fill('a')
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
})

test('an expanded warning shows each Drug detail once', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('simvastatin')
  await input.press('Enter')
  const warning = page.locator('.warning', { hasText: 'Grapefruit' })
  const row = warning.locator('li.irow', { hasText: 'Simvastatin' })
  await expect(row).toBeVisible()
  const summary = (await row.locator('.irow__summary').textContent())!.trim()
  await expect(warning.getByText(summary, { exact: true })).toHaveCount(1)
})

test('type is readable: severity meaning is body text, footer is 14px+, chip Brand name is AA in both modes', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('Coumadin')
  await input.press('Enter')

  const meaning = page.locator('.meds__sev .sev-meaning').first()
  await expect(meaning).toBeVisible()
  const m = await meaning.evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      size: parseFloat(cs.fontSize),
      ratio: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize),
      transform: cs.textTransform,
    }
  })
  expect(m.size).toBeGreaterThanOrEqual(15)
  expect(m.ratio).toBeGreaterThanOrEqual(1.4)
  expect(m.transform).toBe('none')

  const footer = await page
    .locator('.app__footer')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(footer).toBeGreaterThanOrEqual(14)

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    const ratio = await page
      .locator('.chip__brand')
      .first()
      .evaluate((el) => {
        const lum = (rgb: string) => {
          const [r, g, b] = rgb
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map((v) => {
              const c = Number(v) / 255
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
            })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        const [hi, lo] = [
          lum(getComputedStyle(el).color),
          lum(getComputedStyle(el.closest('.chip')!).backgroundColor),
        ].sort((a, b) => b - a)
        return (hi + 0.05) / (lo + 0.05)
      })
    expect(ratio, scheme).toBeGreaterThanOrEqual(4.5)
  }
})

test('the Medication list survives leaving the site and coming back', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  await input.fill('warfarin')
  await input.press('Enter')
  const chips = page.getByRole('list', { name: 'Your medications' })
  await expect(chips).toContainText('Warfarin')
  const url = page.url()

  await page.goto('about:blank')
  await page.goBack()
  await page.getByRole('tab', { name: 'My meds' }).click()
  await expect(chips).toContainText('Warfarin')

  await page.goto('about:blank')
  await page.goto(url)
  await page.getByRole('tab', { name: 'My meds' }).click()
  await expect(chips).toContainText('Warfarin')
})

test('inputs are 16px and at least 44px tall', async ({ page }) => {
  await page.goto('./')
  const search = page.getByLabel('Search drugs, foods and mechanisms')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const med = page.getByLabel('Add a medication')
  for (const el of [med]) {
    const m = await el.evaluate((e) => ({
      size: getComputedStyle(e).fontSize,
      h: e.getBoundingClientRect().height,
    }))
    expect(m.size).toBe('16px')
    expect(m.h).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('tab', { name: 'Explore' }).click()
  const m = await search.evaluate((e) => ({
    size: getComputedStyle(e).fontSize,
    h: e.getBoundingClientRect().height,
  }))
  expect(m.size).toBe('16px')
  expect(m.h).toBeGreaterThanOrEqual(44)
})

test('See on map keeps the filter in the URL as a flag, moves focus to the map and announces', async ({
  page,
}) => {
  await page.goto('./')
  await page.getByRole('tab', { name: 'My meds' }).click()
  const input = page.getByLabel('Add a medication')
  for (const med of ['warfarin', 'simvastatin', 'amlodipine']) {
    await input.fill(med)
    await input.press('Enter')
  }
  await page.getByRole('button', { name: /See on map/ }).click()

  await expect(page).toHaveURL(/meds=1/)
  expect(new URL(page.url()).search).not.toMatch(/warfarin|simvastatin|amlodipine|drug/i)
  await expect(page.locator('.graph-host')).toBeFocused()
  await expect(
    page.getByRole('status').filter({ hasText: 'Showing your 3 medicines' }),
  ).toBeAttached()

  await page.reload()
  await expect(page.getByRole('button', { name: /Showing your meds/ })).toBeVisible()

  await page.getByRole('button', { name: /Showing your meds/ }).click()
  await expect(page.getByRole('button', { name: /Showing your meds/ })).toHaveCount(0)
  expect(page.url()).not.toContain('meds=1')
})
